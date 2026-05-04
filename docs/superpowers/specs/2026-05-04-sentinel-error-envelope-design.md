# SENTINEL REST Error Envelope Normalization — Design Spec

**Date:** 2026-05-04
**Status:** Approved scope, ready for implementation plan
**Issue:** [#158 — SENTINEL: normalize REST error envelope shape across all routes](https://github.com/sip-protocol/sipher/issues/158)
**Predecessor specs:** `2026-04-27-sentinel-surface-docs-design.md` (Phase 3 — surface docs that exposed the envelope inconsistency)
**Related follow-ups:** #157 (rename dual-cancel routes — applies this contract), #159 (mirror docs — captures this contract)

## Summary

Standardize SENTINEL REST error responses on a single structured envelope: `{ error: { code, message } }`. Replace the four heterogeneous shapes that exist today (plain string `{error:"..."}`, partially-structured `{error:{code,message}}`, no-envelope `{success:false}`, no-error-path) with one consistent contract. Introduce a small typed helper `sendSentinelError(res, code, message)` that centralizes the status-code-to-error-code mapping. Five-code taxonomy: `VALIDATION_FAILED | NOT_FOUND | FORBIDDEN | UNAVAILABLE | INTERNAL`. Clean cut migration — no compatibility layer. Single PR. Behavior change: `POST /pending/:id/cancel` switches from "always 200" to "404 + NOT_FOUND" when the ID does not exist.

## Context

The 2026-04-27 SENTINEL surface-docs cleanup (PR #160) exposed inconsistent error envelopes across the 10 SENTINEL REST routes:

- `POST /assess` (400, 500, 503), `POST /blacklist` (400) → `{ error: "string message" }`
- `POST /override/:flagId` (404), `POST /cancel/:flagId` (404) → `{ error: { code: "NOT_FOUND", message: "..." } }`
- `POST /pending/:id/cancel` → returns 200 with `{ success: false }` even when the ID does not exist (no error envelope at all)

These shapes are documented honestly in `docs/sentinel/rest-api.md` but are confusing for any external integrator. The Phase 3 spec deferred normalization as follow-up issue #158.

The frontend caller `app/src/components/SentinelConfirm.tsx` only inspects `res.ok` and `res.status` — it never reads the response body. So the wire-shape change is backwards-compatible by accident for the existing UI, but the structured envelope is currently demonstrated by zero consumers.

With Superteam grant tranches landing and the dApp Store / Solana Foundation work ahead, integrators reading the surface docs will eventually call these routes and need a predictable error contract.

## Goals

1. **One envelope shape** for every SENTINEL REST error: `{ error: { code, message } }`.
2. **One status-code mapping** centralized in a helper, preventing `400 + NOT_FOUND` mismatches.
3. **One concrete consumer** of the envelope: `SentinelConfirm.tsx` displays `error.message` instead of generic `Action failed (404)`.
4. **No compatibility layer** — clean cut, single release.
5. **Surface docs reflect reality** — `docs/sentinel/rest-api.md` documents the new envelope at the top and updates each affected response example.
6. Land as **one PR**, with passing tests and clean typecheck.

## Non-goals

- Auth middleware (`verifyJwt`, `requireOwner`) envelope normalization. Those middlewares emit their own legacy `{error:"string"}` shape on 401/403 and protect the entire authenticated API (`/api/sentinel/*`, `/api/vault/*`, etc.). Renormalizing them is a broader, separate concern.
- `details?` field on the envelope. Omitted from v1; can be added later as a non-breaking optional field if a concrete consumer need arises.
- Additional error codes (`RATE_LIMITED`, `CONFLICT`, etc.). YAGNI — current SENTINEL routes have no error paths that need them.
- Issue #157 route renames (`/cancel/:flagId` → `/promise-gate/:flagId/reject`, etc.). Separate PR; this PR defines the error contract that #157 will then apply.
- Issue #159 mirror to `docs.sip-protocol.org`. Separate cross-repo PRs.
- OpenAPI schema. Out of scope until first SDK consumer.

## Architecture

### The helper file

**New file:** `packages/agent/src/routes/sentinel-errors.ts` (~25 lines)

```ts
import type { Response } from 'express'

export type SentinelErrorCode =
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'UNAVAILABLE'
  | 'INTERNAL'

const STATUS: Record<SentinelErrorCode, number> = {
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAVAILABLE: 503,
  INTERNAL: 500,
}

/**
 * Send a SENTINEL error envelope: { error: { code, message } }.
 * Status code derived from the SENTINEL code per the design doc.
 * @see docs/sentinel/rest-api.md#error-envelope
 */
export function sendSentinelError(
  res: Response,
  code: SentinelErrorCode,
  message: string,
): void {
  res.status(STATUS[code]).json({ error: { code, message } })
}
```

**Design rationale:**

- **Single source of truth:** the status mapping lives in one place. Impossible to send `404 + VALIDATION_FAILED`.
- **Type-safe:** TypeScript catches typos in code names at compile time.
- **Tests import the type:** the union type is exported so test files can assert against it.
- **Co-located:** lives next to `sentinel-api.ts` and is named `sentinel-errors.ts` so the SENTINEL scope is explicit. Function is named `sendSentinelError` (not just `sendError`) for the same reason.
- **No middleware:** rejected the Express error-middleware approach because it requires polyfills for async-error handling and touches router-mount setup. The helper is the smallest viable abstraction.

### Error code taxonomy

| Code | HTTP status | Meaning | Triggered by (current SENTINEL routes) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | Required fields missing or malformed | `POST /assess` missing `action`/`wallet`; `POST /blacklist` missing `address`/`reason`/`severity` |
| `NOT_FOUND` | 404 | Resource ID does not exist | `POST /override/:flagId`, `POST /cancel/:flagId`, `POST /pending/:id/cancel` |
| `FORBIDDEN` | 403 | Authenticated but not allowed | Reserved (auth middleware emits own legacy shape) |
| `UNAVAILABLE` | 503 | Server up, dependency unconfigured | `POST /assess` when no assessor registered |
| `INTERNAL` | 500 | Unexpected server-side failure | `POST /assess` when assessor throws |

`FORBIDDEN` is reserved-but-unused by SENTINEL handlers today. Keeping it in the taxonomy from v1 means we don't have to widen the union later if/when middleware normalization happens.

## Per-handler migration

Every error response in `packages/agent/src/routes/sentinel-api.ts`:

| # | Route | Line | Change | Type |
|---|---|---:|---|---|
| 1 | `POST /assess` 400 | 26 | `sendSentinelError(res, 'VALIDATION_FAILED', 'action and wallet are required strings')` | shape only |
| 2 | `POST /assess` 503 | 31 | `sendSentinelError(res, 'UNAVAILABLE', 'SENTINEL assessor not configured')` | shape only |
| 3 | `POST /assess` 500 | 38 | `sendSentinelError(res, 'INTERNAL', e instanceof Error ? e.message : 'assess failed')` | shape only |
| 4 | `POST /blacklist` 400 | 98 | `sendSentinelError(res, 'VALIDATION_FAILED', 'address, reason, severity required')` | shape only |
| 5 | `POST /pending/:id/cancel` | 137-145 | If `cancelCircuitBreakerAction` returns `false`: `sendSentinelError(res, 'NOT_FOUND', 'pending action not found or already resolved')`. If `true`: `res.json({ success: true })` | **BEHAVIOR CHANGE** |
| 6 | `POST /override/:flagId` 404 | 176 | `sendSentinelError(res, 'NOT_FOUND', 'flag not found or expired')` | refactor to helper |
| 7 | `POST /cancel/:flagId` 404 | 194 | `sendSentinelError(res, 'NOT_FOUND', 'flag not found or expired')` | refactor to helper |

Routes that don't change (no error paths exist today): `GET /blacklist`, `GET /pending`, `GET /status`, `GET /decisions`, `DELETE /blacklist/:id`.

### Notes on the behavior change (#5)

`cancelCircuitBreakerAction` returns `false` for two cases: (a) the ID does not exist, OR (b) the ID exists but is already settled/cancelled. Both collapse into `NOT_FOUND` with the message `"pending action not found or already resolved"`. The message disambiguates well enough; adding a `CONFLICT` code to differentiate would bloat the taxonomy with no concrete consumer benefit.

The success path stays `200 + { success: true }` — unchanged response body so any future caller relying on truthiness isn't broken. The shape difference is only on the failure branch.

### JSDoc updates

Per-handler `@returns` updates in `packages/agent/src/routes/sentinel-api.ts`:

| Handler | Before | After |
|---|---|---|
| `POST /assess` | `@returns 200 RiskReport \| 400 { error } \| 503 { error }` (500 unmentioned) | `@returns 200 RiskReport \| 400 ErrorEnvelope \| 500 ErrorEnvelope \| 503 ErrorEnvelope` |
| `POST /blacklist` | `@returns 200 { success: true, entryId } \| 400 { error }` | `@returns 200 { success: true, entryId } \| 400 ErrorEnvelope` |
| `POST /pending/:id/cancel` | `@returns 200 { success: boolean }` | `@returns 200 { success: true } \| 404 ErrorEnvelope` |
| `POST /override/:flagId` | `@returns 204 \| 404 { error }` | `@returns 204 \| 404 ErrorEnvelope` |
| `POST /cancel/:flagId` | `@returns 204 \| 404 { error }` | `@returns 204 \| 404 ErrorEnvelope` |

Add `@see docs/sentinel/rest-api.md#error-envelope` cross-link on each of the 5 handlers above.

Routes that emit no errors (`GET /blacklist`, `GET /pending`, `GET /status`, `GET /decisions`, `DELETE /blacklist/:id`) get no JSDoc changes.

## Frontend implications

**File:** `app/src/components/SentinelConfirm.tsx`

Today the component only checks `res.ok` and displays `Action failed (${res.status})`. With the new envelope it can display the `message` field instead, providing a real UX win.

```ts
if (!res.ok) {
  let message = `Action failed (${res.status})`
  try {
    const body = await res.json()
    if (body?.error?.message) message = body.error.message
  } catch { /* fall back to status */ }
  setError(message)
  return
}
```

Wired in this PR (not deferred) because:

- It demonstrates the envelope is consumed end-to-end — proves the contract works.
- It's the sole frontend caller of these admin endpoints.
- ~5 lines of code + 1 new test.

## Testing

### New file: `packages/agent/tests/sentinel/sentinel-errors.test.ts` (~50 lines, 6 tests)

Unit tests for the helper. Mock Express `Response` via `{ status: vi.fn().mockReturnThis(), json: vi.fn() }`.

| Test | Asserts |
|---|---|
| `VALIDATION_FAILED → 400` | status + `toStrictEqual({error:{code:'VALIDATION_FAILED', message:'msg'}})` |
| `NOT_FOUND → 404` | same shape |
| `FORBIDDEN → 403` | same shape |
| `UNAVAILABLE → 503` | same shape |
| `INTERNAL → 500` | same shape |
| `message field is preserved verbatim` | passes a long string with quotes/special chars |

### Modify: `packages/agent/tests/sentinel/sentinel-api.test.ts`

| Test | Change |
|---|---|
| `POST /assess returns 400 on missing required fields` | Add `expect(res.body).toStrictEqual({error:{code:'VALIDATION_FAILED', message:'action and wallet are required strings'}})` |
| **NEW:** `POST /assess returns 503 + UNAVAILABLE when assessor not configured` | Build app without calling `setSentinelAssessor`; assert 503 + envelope |
| **NEW:** `POST /assess returns 500 + INTERNAL when assessor throws` | Mock assessor `mockRejectedValue(new Error('boom'))`; assert 500 + envelope with `message:'boom'` |
| `POST /blacklist` add 400 case | Currently only happy path. Add: missing fields → 400 + VALIDATION_FAILED envelope |
| **NEW:** `POST /pending/:id/cancel returns 404 + NOT_FOUND when ID does not exist` | Post to non-existent ID; assert 404 + envelope `code:'NOT_FOUND', message:'pending action not found or already resolved'` |

The existing `POST /pending/:id/cancel cancels an action` test stays as-is — regression guard for the success path.

### Unchanged: `packages/agent/tests/sentinel/pause-resume-routes.test.ts`

Already asserts `res.body.error.code === 'NOT_FOUND'` (line 89). Refactoring the routes to use the helper produces an identical wire response. Zero changes — proves backward-compat of the refactor.

### Modify: `app/src/components/__tests__/SentinelConfirm.test.tsx`

| Change | Detail |
|---|---|
| Update fixture on line 88 | `new Response('{"error":{"code":"NOT_FOUND","message":"flag not found or expired"}}', { status: 404 })` |
| **NEW test:** `displays error envelope message instead of generic status` | Mock 404 with envelope; assert "flag not found or expired" appears in the rendered output |

### Test count delta

- Agent: **+10** (1290 → 1300) — 6 helper + 4 new error-path
- App: **+1** (45 → 46)

## Documentation

### `docs/sentinel/rest-api.md`

1. **Add a top-level "Error Envelope" section** after the auth intro (around line 16):

   ```markdown
   ## Error Envelope

   All SENTINEL routes that emit errors return a structured envelope:

   { "error": { "code": "<CODE>", "message": "<human-readable>" } }

   | Code | HTTP status | Meaning |
   |---|---|---|
   | VALIDATION_FAILED | 400 | Required fields missing or malformed |
   | NOT_FOUND | 404 | Resource ID does not exist |
   | FORBIDDEN | 403 | Reserved (auth middleware emits its own legacy shape today) |
   | UNAVAILABLE | 503 | Server up but a dependency is unconfigured |
   | INTERNAL | 500 | Unexpected server-side failure |

   **Note on auth errors:** 401/403 responses from `verifyJwt` and `requireOwner` middleware still use the legacy `{error: "string"}` shape. Normalizing those is tracked separately as a future API-wide cleanup.
   ```

2. **Update Response sections** for affected routes:
   - `POST /assess` 400, 500, 503 (lines 60-82) — replace string examples with envelope
   - `POST /blacklist` 400 (lines 234-238)
   - `POST /pending/:id/cancel` (lines 290-328) — **rewrite**: now 200 `{success: true}` on success, 404 `NOT_FOUND` envelope on missing. **Remove the stale `> [!NOTE]` callout** about "does not return 404 for missing IDs"
   - `POST /override/:flagId` 404 (line 380-384) — confirm shape (already aligned)
   - `POST /cancel/:flagId` 404 (line 414-418) — confirm shape (already aligned)

3. **Update `Last verified: YYYY-MM-DD` footer** to today's date.

### `CLAUDE.md`

- Bump test counts: agent 1290 → 1300, suite 103 → 104 (only the new helper file `sentinel-errors.test.ts` adds a suite; new tests inside `sentinel-api.test.ts` and `SentinelConfirm.test.tsx` go into existing suites)
- (No description changes needed — error envelope is a contract detail, not a CLAUDE.md-tier fact)

## Files touched

| File | Status | Approximate LOC |
|---|---|---:|
| `packages/agent/src/routes/sentinel-errors.ts` | NEW | +25 |
| `packages/agent/src/routes/sentinel-api.ts` | MODIFY | ~10 changes |
| `packages/agent/tests/sentinel/sentinel-errors.test.ts` | NEW | +50 (6 tests) |
| `packages/agent/tests/sentinel/sentinel-api.test.ts` | MODIFY | +4 tests, ~5 mods |
| `app/src/components/SentinelConfirm.tsx` | MODIFY | +5 |
| `app/src/components/__tests__/SentinelConfirm.test.tsx` | MODIFY | +1 test, 1 fixture update |
| `docs/sentinel/rest-api.md` | MODIFY | +20 envelope section, ~30 line replacements |
| `CLAUDE.md` | MODIFY | Test counts |

## Success criteria

- [ ] `packages/agent/src/routes/sentinel-errors.ts` exists with `SentinelErrorCode` union and `sendSentinelError` helper
- [ ] All 5 codes have unit tests asserting status + envelope shape via `toStrictEqual`
- [ ] All 4 error paths in `sentinel-api.ts` (assess 400/500/503, blacklist 400) have integration tests asserting envelope
- [ ] `POST /pending/:id/cancel` returns 404 + NOT_FOUND when ID does not exist (new behavior, tested)
- [ ] `pause-resume-routes.test.ts` still passes with zero modifications (backward-compat proof)
- [ ] `SentinelConfirm.tsx` displays `error.message` from envelope on failure (tested)
- [ ] `docs/sentinel/rest-api.md` has a top-level Error Envelope section, all examples updated, stale `/pending/:id/cancel` note removed, `Last verified` footer updated
- [ ] JSDoc `@returns` annotations updated on all 5 affected handlers (assess, blacklist POST, pending cancel, override, cancel); `@see` links point at the new envelope section
- [ ] CLAUDE.md test counts updated (agent 1290→1300, suite 103→104)
- [ ] `pnpm typecheck` clean (workspace + agent)
- [ ] `pnpm --filter @sipher/agent test -- --run` shows 1300 green
- [ ] `pnpm --filter @sipher/app test -- --run` shows 46 green

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| External integrator scraping the old string error format breaks | No known external consumers. Frontend reads HTTP status, not body. Surface-docs documented as "two shapes" so the contract was never authoritative. Acceptable to break. |
| `POST /pending/:id/cancel` consumer relying on `{success: false}` breaks | No frontend caller exists for this admin endpoint. Backend itself does not call it. Risk ≈ 0. |
| Helper file becomes a god-object as more codes are added | Codes are explicit additions to a TypeScript union; cannot grow accidentally. Status-mapping table forces a deliberate update. YAGNI keeps the surface tight. |
| Confusion between SENTINEL handler envelope and auth-middleware legacy shape | Documented explicitly in the new Error Envelope section ("Note on auth errors") |
| Status-code/error-code drift if helper is bypassed | Code review catches direct `res.status(N).json({error:...})` calls. Could add a lint rule later if drift becomes real. |

## Rollback

Single PR, single revert. No DB migrations, no env changes, no route changes. The behavior change to `POST /pending/:id/cancel` (200 → 404 on missing) is the only thing that affects the wire contract; rolling back restores the prior "always 200" behavior.

## Out of scope (deferred)

- Auth middleware envelope (separate API-wide concern)
- `details?` field (non-breaking add later)
- `RATE_LIMITED`, `CONFLICT` codes (YAGNI)
- Issue #157 dual-cancel route renames (separate PR; this PR defines the contract that #157 applies)
- Issue #159 docs mirror to `docs.sip-protocol.org` (separate cross-repo PRs; this PR's docs are the source of truth)
- OpenAPI / Swagger spec (until first SDK consumer)
- Lint rule enforcing helper usage (add later if drift becomes real)
