# SENTINEL Dual-Cancel Route Rename — Design Spec

**Date:** 2026-05-04
**Status:** Approved scope, ready for implementation plan
**Issue:** [#157 — SENTINEL: rename dual-cancel routes to disambiguate circuit-breaker vs promise-gate](https://github.com/sip-protocol/sipher/issues/157)
**Predecessor specs:** `2026-04-27-sentinel-surface-docs-design.md` (which surfaced the dual-cancel ambiguity), `2026-05-04-sentinel-error-envelope-design.md` (#158, sets the error-envelope contract this rename inherits)
**Related follow-ups:** #159 (mirror SENTINEL docs to docs.sip-protocol.org — captures the post-rename surface)

## Summary

Rename three SENTINEL admin routes so URL names announce which state store they touch. Today, two routes named `/cancel` sit on the same router and operate on different state stores (SQLite-backed circuit-breaker vs in-memory promise-gate). Rename:

- `POST /api/sentinel/pending/:id/cancel` → `POST /api/sentinel/circuit-breaker/:id/cancel`
- `POST /api/sentinel/override/:flagId` → `POST /api/sentinel/promise-gate/:flagId/resolve`
- `POST /api/sentinel/cancel/:flagId` → `POST /api/sentinel/promise-gate/:flagId/reject`

Clean cut migration — no compatibility layer, no redirects, single PR. Behavior, status codes, request/response bodies, and auth requirements unchanged. The error envelope contract from #158 carries over verbatim. Test count delta is zero (URL strings change, behavior does not).

## Context

The 2026-04-27 surface-docs cleanup (PR #160) had to ship a `WARNING` callout at the top of `docs/sentinel/rest-api.md` explaining that two routes named `/cancel` mean different things:

- `POST /api/sentinel/pending/:id/cancel` — circuit-breaker, SQLite-backed, durable
- `POST /api/sentinel/cancel/:flagId` — promise-gate, in-memory, process-local

The `WARNING` was a bandaid for a confusing API surface. #157 fixes the surface itself by renaming so the URLs encode the architectural distinction:

- `circuit-breaker/*` clearly means the durable SQLite-backed action queue
- `promise-gate/*` clearly means the in-memory pending-promise registry
- `resolve` vs `reject` matches the underlying `pending.ts` API verbs (`resolvePending`, `rejectPending`) and Promise lifecycle vocabulary

After the rename, the URL itself is self-documenting, and the `WARNING` becomes obsolete.

## Goals

1. **URL names mirror state stores** — `circuit-breaker/*` and `promise-gate/*` namespaces make the architectural distinction visible in the route.
2. **No behavior change** — handlers, status codes, response bodies, auth, error envelope from #158 all preserved.
3. **No compatibility layer** — clean cut, single release.
4. **Surface docs reflect reality** — delete the dual-cancel `WARNING`, update headings + curl examples.
5. **Test file naming follows the route namespace** — rename `pause-resume-routes.test.ts` to `promise-gate-routes.test.ts` so the file matches the namespace it exercises.
6. Land as **one PR**, with passing tests and clean typecheck.

## Non-goals

- Renaming `GET /api/sentinel/pending` (the listing route). Issue #157 names only the cancel routes; symmetric rename of the GET expands scope without solving the dual-cancel ambiguity, and the GET serves a different audience (anyone authed) than the admin POST routes.
- Fixing the `/v1/` vs `/api/` prefix mismatch in `CLAUDE.md`'s endpoint table. Pre-existing inconsistency; auditing the whole table is out of scope.
- Renaming user-facing button copy in `SentinelConfirm.tsx` ("Override & Send", "Cancel"). The rename is a backend/URL change; UX wording is a separate UX decision.
- E2E test updates beyond URL changes. `e2e/sentinel-flow.spec.ts` is `test.skip` (blocked on sip-protocol/sip-protocol#1077) and contains only user-facing button-label regex, no URLs.

## Decisions Locked

### Migration strategy: clean cut

Single PR ships the new routes, removes the old ones, updates the lone frontend caller and all internal callers in the same atomic change. No 308 redirects, no 410 Gone, no `Deprecation` header window.

**Justification:** No external SDK consumers. Single internal monorepo. Frontend caller (`SentinelConfirm.tsx`) is updated in the same PR. Same precedent set by #158 — keeping a compatibility layer means committing to deleting it next week, which is wasted work.

### `WARNING` block disposition: delete entirely

Remove `docs/sentinel/rest-api.md` lines 8-14 (the dual-cancel `WARNING`). No migration note, no slimmed-down architecture note.

**Justification:** The `WARNING` exists to disambiguate a confusing API surface. The rename fixes the surface, so the disambiguator is dead weight. The architectural distinction (durable vs in-memory) is already documented inline in each section's body and JSDoc; duplicating it at the top adds no value. Git history preserves the story for any reader curious about the path here.

### Test file rename: `pause-resume-routes.test.ts` → `promise-gate-routes.test.ts`

`git mv` the file. Update the inline `describe` block from `'SENTINEL pause/resume routes'` to `'SENTINEL promise-gate routes'`. Update URL strings inside.

**Justification:** Convention in `packages/agent/tests/sentinel/` is "test file matches what it tests" (`sentinel-api.test.ts`, `pending.test.ts`, `circuit-breaker.test.ts`). After the rename, both routes in this file live under the `promise-gate` namespace, so the file name should mirror that namespace. `git mv` preserves history at 100% similarity since only URL strings and the `describe` text change.

## Architecture

### Route map

| Old route | New route | Backed by | State store | Verb meaning |
|---|---|---|---|---|
| `POST /api/sentinel/pending/:id/cancel` | `POST /api/sentinel/circuit-breaker/:id/cancel` | `cancelCircuitBreakerAction` | SQLite, durable | Cancel a queued action before its scheduled fire time |
| `POST /api/sentinel/override/:flagId` | `POST /api/sentinel/promise-gate/:flagId/resolve` | `resolvePending` | In-memory `Map`, process-local | Resolve a paused promise (override the SENTINEL flag, allow the action to continue) |
| `POST /api/sentinel/cancel/:flagId` | `POST /api/sentinel/promise-gate/:flagId/reject` | `rejectPending` | In-memory `Map`, process-local | Reject a paused promise (honour the SENTINEL flag, surface a synthetic cancellation error) |

### Behavior preservation

- **Status codes**: 200/204/400/403/404 mappings unchanged per route.
- **Error envelope**: `{ error: { code, message } }` from #158 carries over. `circuit-breaker/:id/cancel` still returns 404 + `NOT_FOUND` on missing ID; `promise-gate/:flagId/{resolve,reject}` still return 404 + `NOT_FOUND` on missing flag.
- **Auth**: all three routes still require `verifyJwt + requireOwner` (admin-only).
- **Request bodies**: identical (cancel takes optional `reason`; resolve/reject take no body).
- **Response bodies**: identical (cancel returns `{success: true}`; resolve/reject return 204 No Content).

### Frontend dispatch

`SentinelConfirm.tsx` currently calls:

```ts
const dispatch = async (kind: 'override' | 'cancel') => {
  const res = await fetch(`${API_URL}/api/sentinel/${kind}/${encodeURIComponent(flagId)}`, ...)
}
```

After rename:

```ts
const dispatch = async (verb: 'resolve' | 'reject') => {
  const res = await fetch(`${API_URL}/api/sentinel/promise-gate/${encodeURIComponent(flagId)}/${verb}`, ...)
}
```

Internal vocabulary (`kind` → `verb`, `'override'|'cancel'` → `'resolve'|'reject'`) is renamed to match the new URL shape. User-facing button copy in the same component (`Override & Send`, `Cancel`) stays unchanged — that's UX wording, not API contract.

## Files In Scope

### Source code (3 files)

1. **`packages/agent/src/routes/sentinel-api.ts`**
   - Three `app.post(...)` first-arg URL strings (lines 141, 181, 200)
   - Three `@see` JSDoc anchor links (lines 138, 178, 197)
   - Inline JSDoc prose ("Mapped to `POST /api/sentinel/...`") above each handler
   - Inline `// NOTE: distinct from /pending/:id/cancel above` comment at line 169 — delete (becomes obsolete after rename)

2. **`packages/agent/src/sentinel/pending.ts`**
   - 5 JSDoc references (lines 42, 76, 80, 93, 98) — both prose ("Mapped to `POST /api/sentinel/override/:flagId`") and `@see` anchor links

3. **`packages/agent/src/agent.ts`**
   - 3 prose references in JSDoc (lines 240, 360, 361) — documentation only, no behavioral coupling

### Frontend (1 file)

4. **`app/src/components/SentinelConfirm.tsx`**
   - `dispatch` function: `kind: 'override' | 'cancel'` → `verb: 'resolve' | 'reject'`
   - Fetch URL template: `/api/sentinel/${kind}/${flagId}` → `/api/sentinel/promise-gate/${flagId}/${verb}`
   - Dispatch call sites at the two `Sentinel*` button handlers — update args to new verb names
   - Button copy unchanged (UX preserved)

### Tests (3 files)

5. **`packages/agent/tests/sentinel/sentinel-api.test.ts`**
   - Supertest URL strings at lines 130, 136, 144, 146 — old `/pending/:id/cancel` → new `/circuit-breaker/:id/cancel`
   - `it(...)` text describing the route — match new URL

6. **`packages/agent/tests/sentinel/pause-resume-routes.test.ts` → `promise-gate-routes.test.ts`**
   - `git mv` to preserve rename detection
   - `describe` block: `'SENTINEL pause/resume routes'` → `'SENTINEL promise-gate routes'`
   - Supertest URL strings inside: `/override/:flagId` → `/promise-gate/:flagId/resolve`, `/cancel/:flagId` → `/promise-gate/:flagId/reject`
   - `it(...)` text matching each URL

7. **`app/src/components/__tests__/SentinelConfirm.test.tsx`**
   - URL `expect.stringContaining` assertions at lines 40, 60 — old `/api/sentinel/override/abc` and `/api/sentinel/cancel/abc` → new `/api/sentinel/promise-gate/abc/resolve` and `/api/sentinel/promise-gate/abc/reject`

### Surface docs (2 files)

8. **`docs/sentinel/rest-api.md`**
   - Delete `WARNING` block (lines 8-14) entirely
   - Rename three section headings (lines 310, 388, 419) to new URLs
   - Update curl examples inside each renamed section
   - Update any cross-section references between the three sections (e.g., "see also `/cancel/:flagId`" prose in the override section)
   - Confirm the existing `Last verified: 2026-05-04` footer date remains accurate (no bump needed if PR ships today)

9. **`docs/sentinel/audit-log.md`**
   - Line 72 inline link: `[POST /api/sentinel/pending/:id/cancel](./rest-api.md#post-apisentinelpendingidcancel)` → `[POST /api/sentinel/circuit-breaker/:id/cancel](./rest-api.md#post-apisentinelcircuit-breakeridcancel)`

### Top-level (1 file)

10. **`CLAUDE.md`**
    - Line 487 endpoint-table row: `/v1/sentinel/pending/:id/cancel` → `/v1/sentinel/circuit-breaker/:id/cancel`
    - Path segment update only; `/v1/` prefix preserved per scope decision (pre-existing mismatch with code's `/api/` prefix is out of scope)

### Untouched (deliberate)

- `e2e/sentinel-flow.spec.ts` — only contains `test.skip` blocks with user-facing button-label regex (`/override & send/i`, `/^cancel$/i`). No URL references; button copy doesn't change.
- All historical `docs/superpowers/specs/*` and `docs/superpowers/plans/*` entries — these describe state at the time of writing and should not be retroactively edited.

## Anchor Format

GitHub heading-anchor rule (verified against existing anchors in `pending.ts`): lowercase, strip `/` and `:`, collapse word-boundary spaces to single dashes. Hyphens already present in words (`circuit-breaker`, `promise-gate`) are preserved.

| Heading | Anchor |
|---|---|
| `### POST /api/sentinel/circuit-breaker/:id/cancel` | `#post-apisentinelcircuit-breakeridcancel` |
| `### POST /api/sentinel/promise-gate/:flagId/resolve` | `#post-apisentinelpromise-gateflagidresolve` |
| `### POST /api/sentinel/promise-gate/:flagId/reject` | `#post-apisentinelpromise-gateflagidreject` |

Verification during implementation: render `rest-api.md` in the GitHub preview after the rename, click each TOC link, confirm the jumps land. If GitHub generates different anchors, update the JSDoc `@see` references to match what the renderer produced.

## Testing Strategy

- **TDD per route rename** (handoff convention): for each of tasks 1-3 below, update the supertest URL string first, watch the test fail with a 404, then update the route handler, watch it pass.
- **Coverage preserved, not extended**: this PR adds zero behavioral surface area. New URLs hit the same handlers as the old URLs. Test count remains 1300 agent / 46 app.
- **Per-task `pnpm typecheck`** after every commit.
- **Final whole-branch review** before push — same pattern as #158. Higher value here because cross-cutting doc surface (audit-log, CLAUDE.md, JSDoc anchors across three source files) is more spread out, so per-task review is more likely to miss inter-task drift.

## Commit Strategy / Task Plan

Eight tasks, eight commits. Order chosen so every commit lands with a green test suite — never a broken intermediate state. Tasks 1-3 each pair a handler change with its test (TDD-friendly). Task 4 (`git mv`) intentionally comes after content updates in 2 and 3 so the rename carries already-updated content.

| # | Task | Files | Commit subject |
|---|------|-------|----------------|
| 1 | Rename circuit-breaker cancel route | `sentinel-api.ts` (handler + JSDoc + delete inline NOTE) + `sentinel-api.test.ts` | `refactor(sentinel): rename POST /pending/:id/cancel → /circuit-breaker/:id/cancel (#157)` |
| 2 | Rename promise-gate override → resolve | `sentinel-api.ts` (handler + JSDoc) + `pause-resume-routes.test.ts` URLs | `refactor(sentinel): rename POST /override/:flagId → /promise-gate/:flagId/resolve (#157)` |
| 3 | Rename promise-gate cancel → reject | `sentinel-api.ts` (handler + JSDoc) + `pause-resume-routes.test.ts` URLs | `refactor(sentinel): rename POST /cancel/:flagId → /promise-gate/:flagId/reject (#157)` |
| 4 | `git mv` test file | `pause-resume-routes.test.ts` → `promise-gate-routes.test.ts` + `describe` block | `test(sentinel): rename pause-resume-routes.test.ts → promise-gate-routes.test.ts (#157)` |
| 5 | Update internal JSDoc | `pending.ts`, `agent.ts` (prose + `@see` anchors) | `docs(sentinel): update internal JSDoc for renamed routes (#157)` |
| 6 | Frontend caller update | `SentinelConfirm.tsx` + `SentinelConfirm.test.tsx` (verb rename + URL template) | `refactor(app): SentinelConfirm uses promise-gate route shape (#157)` |
| 7 | Surface docs update | `docs/sentinel/rest-api.md` (delete WARNING, three headings, curl) | `docs(sentinel): rename routes in rest-api.md + remove dual-cancel WARNING (#157)` |
| 8 | Cross-doc cleanup | `docs/sentinel/audit-log.md` + `CLAUDE.md` line 487 | `docs(sentinel): update audit-log + CLAUDE.md route references (#157)` |

## Verification Checklist

Before requesting merge:

- [ ] All eight commits land green (`pnpm --filter @sipher/agent test -- --run` after each task that touches agent; `pnpm --filter @sipher/app test -- --run` after frontend tasks)
- [ ] `pnpm typecheck` clean at every commit
- [ ] Final agent test count: 1300 (unchanged)
- [ ] Final agent suite count: 104 (unchanged — `pause-resume-routes.test.ts` renamed in place, not added/removed)
- [ ] Final app test count: 46 (unchanged)
- [ ] `grep -rn 'pending/:id/cancel\|cancel/:flagId\|override/:flagId\|/api/sentinel/pending\|/api/sentinel/cancel\|/api/sentinel/override' --include='*.ts' --include='*.tsx' --include='*.md' --exclude-dir=docs/superpowers` returns zero hits (historical specs/plans excluded — they describe the world at the time written)
- [ ] `docs/sentinel/rest-api.md` rendered in GitHub preview: WARNING block gone, three new section headings present, TOC anchors resolve
- [ ] Whole-branch review (one final agent dispatch) covering: stale prose, drift between source JSDoc and surface docs, missed call sites
- [ ] PR title and body do not mention AI / Co-Authored-By
