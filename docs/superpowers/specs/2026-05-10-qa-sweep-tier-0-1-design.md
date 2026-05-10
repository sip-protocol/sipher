# QA Sweep — Tier 0 + 1 (Auth Foundations) — Design

**Date:** 2026-05-10
**Session:** frontier_46
**Status:** Approved (RECTOR, this session)
**Predecessor:**
  - Handoff: `~/Documents/secret/claude-strategy/sip-protocol/sipher/session-handoff-2026-05-10-c.md`
  - QA report: `~/Documents/secret/qa-reports/sipher/1778399617-both-fresh+skeptic/report.md`
  - Sprint memory: `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/project_phase4b-redesign-sprint.md`
**Scope:** 6 issues (#193, #205, #202, #189, #191, #192) of 33-issue QA sweep — DAG Tier 0 + Tier 1
**Out of scope (this session):** #190 (Tier 2), all P1 except #189/#191/#192/#202, all P2 except #205, all P3, Phase D launch-gate close
**Estimated work-time:** 10-15h across 4 PRs

---

## Why this slice

The frontier_45 `/quality:qa` Phase 1 sweep filed 33 GitHub issues (`sip-protocol/sipher#189-#221`) under the `qa-skill:1778399617` label. RECTOR's directive: **zero open QA findings before Phase D launch**. The 33 issues span 60-90h of naive work-time.

A naive priority-ordered sprint (P0 → P1 → P2 → P3) ships unrelated files together within each tier. A family-grouped sprint preserves code cohesion but obscures dependency ordering. Both leave easy wins on the table.

This session adopts **DAG ordering** — foundations land first, downstream work builds on stable ground:

```
Tier 0 — Foundations (UNBLOCK everything below)
  #193 makeFakeAuthState test util ─────► honest tests for all auth work
  #205 Remove deprecated wallet adapters ──► clean console for QA

Tier 1 — Auth lifecycle core
  #202 onAuthClear registry ────────────► defines contract
  #189 Apply registry to 5 components ──► uses #202
  #191 Network-error branch + banner ──► api/client.ts + new component
  #192 ChatSidebar 401 interceptor ────► api/client.ts shared with #191
```

`#193` lands first so every subsequent test fixture is honest. `#202` lands before `#189` so consumers don't get rewritten when the registry contract arrives. `#191` and `#192` share `api/client.ts` so they ship together.

The remaining 27 issues — Tier 2 (Unauthed UX), Tier 3 (Admin reliability), Tier 4 (independent leaves) — are scoped in subsequent sessions, with brainstorming refreshed at each session start.

---

## PRs

### PR-A — `chore/test-util-make-fake-auth-state` (closes #193)

- **Mode:** INLINE w/ TDD
- **Estimated:** 1-2h
- **Why first:** Foundation for all subsequent auth-related tests. Every test fixture in PRs C/D needs an honest `AuthState` shape.
- **Files:**
  - `app/src/test-utils/makeFakeAuthState.ts` (new) — exports `makeFakeAuthState(overrides?: Partial<AuthState>): AuthState`
  - `app/src/test-utils/__tests__/makeFakeAuthState.test.ts` (new) — asserts return shape matches `AuthState` exactly via type-level + runtime checks
  - ~6 test files migrated (per QA finding D-3): files in `app/src/components/keys/__tests__/` and `app/src/views/__tests__/` that mock the non-existent `isAuthenticated` field
- **TDD order:**
  1. Write `makeFakeAuthState.test.ts` asserting return shape matches `AuthState` (status union, token, publicKey, isAdmin)
  2. Implement `makeFakeAuthState` to pass
  3. Migrate test files one at a time; each migration verifies tests still pass before moving on
- **Acceptance:**
  - `pnpm typecheck` clean
  - All migrated test files pass
  - No remaining `isAuthenticated:` references in test fixtures (`grep -r "isAuthenticated" app/src/**/__tests__/`)

### PR-B — `chore/remove-deprecated-wallet-adapters` (closes #205)

- **Mode:** INLINE
- **Estimated:** 30min-1h
- **Why second:** Independent of A; mechanical removal; clears console deprecation noise that shows up in subsequent QA runs.
- **Files:**
  - `app/package.json` — remove `@solana/wallet-adapter-phantom` + `@solana/wallet-adapter-solflare` (Phantom and Solflare both auto-detected via Wallet Standard now; explicit adapters deprecated since wallet-adapter@0.15)
  - Wallet provider config (likely `app/src/main.tsx` or `app/src/wallet/`) — remove explicit adapter imports + entries
  - Lockfile regenerated via `pnpm install`
- **Acceptance:**
  - No Phantom/Solflare deprecation warnings on production load (verified via console open in dev)
  - Phantom + Solflare connect flows still work end-to-end (manually verified via wallet test)
  - `pnpm typecheck` + `pnpm test --run` clean
- **Mitigation:** If grep-sweep reveals >5 stale references in tests/MWA flows, escalate to subagent mode rather than expanding inline scope.

### PR-C — `feat/on-auth-clear-registry` (closes #202 + #189)

- **Mode:** SUBAGENT-driven w/ TDD
- **Estimated:** 4-6h
- **Why third:** Bundles the cross-store cleanup contract (#202) with its first 5 consumers (#189). Shipping the registry without consumers leaves dead code on main; shipping consumers without the registry forces per-component duplication that #202 then refactors away.
- **Architecture:**
  - **New:** `app/src/store/onAuthClear.ts` — module-singleton registry (NOT a hook). Singleton because the auth store calls `clearAll()` from outside React render context (during state transition), so the registry must be callable without a hook context.
    ```ts
    type ClearCallback = () => void
    interface OnAuthClearRegistry {
      register(cb: ClearCallback): () => void   // returns unsubscribe
      clearAll(): void                           // fires all registered callbacks
    }
    export const onAuthClear: OnAuthClearRegistry = createRegistry()
    ```
  - **Optional thin hook wrapper:** `useOnAuthClear(callback)` — calls `register` in `useEffect` mount, stores unsubscribe in ref, calls it on unmount. Component consumers use the hook; auth store uses the module export directly.
  - **Auth store wiring:** existing auth store calls `onAuthClear.clearAll()` on transition `'authed' → 'unauthed' | 'expired'` (NOT on `'connecting' → *` or initial mount)
  - **Consumers (5):** PrivacyGraph.tsx, VaultView.tsx, StealthAddressBackup.tsx, DashboardView.tsx, useSSE.ts each use `useOnAuthClear(() => setStateThing(emptyValue))`
- **Files:**
  - `app/src/store/onAuthClear.ts` (new)
  - `app/src/store/__tests__/onAuthClear.test.ts` (new) — register/clearAll/unsubscribe behavior
  - `app/src/store/auth.ts` (or wherever auth state transitions happen) — wire `clearAll()` into the unauthed/expired branch
  - `app/src/components/PrivacyGraph.tsx` (modified — register cleanup for `useState<StealthNode[]>`)
  - `app/src/views/VaultView.tsx` (modified — register cleanup for vault state)
  - `app/src/components/keys/StealthAddressBackup.tsx` (modified — register cleanup for backup state)
  - `app/src/views/DashboardView.tsx` (modified — register cleanup for dashboard slices)
  - `app/src/hooks/useSSE.ts` (modified — register cleanup for events array)
  - 5 component-level unit tests (modified or new) asserting state clears on `'authed' → 'unauthed'` transition (use `makeFakeAuthState` from PR-A)
- **TDD order:**
  1. `onAuthClear.test.ts` — registry contract test (register returns unsubscribe; unsubscribed callbacks don't fire on clearAll; clearAll fires all subscribed callbacks)
  2. Implement registry to pass
  3. For each of the 5 consumers: write failing test asserting state empties on auth transition → wire registration → test passes
  4. Wire auth store's `clearAll()` call last (so consumer tests are honest before the integration point lands)
- **Acceptance:**
  - `pnpm typecheck` clean
  - All registry + consumer tests pass
  - Manual repro: open production-equivalent build, log in, populate Privacy Graph, force JWT expiry (clear `localStorage.token` in DevTools), trigger any state-checking action — Privacy Graph + Vault + StealthAddressBackup + Dashboard all show empty state, NOT stale rendering
  - Adversarial repro (skeptic pattern from QA report): React fiber `setState` injection on `PrivacyGraph` after auth transition shows zero stale render — though the registry's job is to clear on auth boundary, not to defend against state injection (state injection is observably-different bug; documented for context only)
- **Fallback:** If subagent surfaces ergonomic issues with the registry pattern (e.g., "all 5 consumers use the same `setState([])` shape — why centralize?"), fall back to per-component `setState` cleanup wired directly into auth-store transition (matches predecessor handoff's "5 file fixes" path). #189 still closes; #202 closes as "evaluated registry pattern, decided per-component cleanup is sufficient at current scale" with documented re-evaluation trigger (e.g., 10+ consumers).

### PR-D — `feat/auth-error-handling` (closes #191 + #192)

- **Mode:** SUBAGENT-driven w/ TDD
- **Estimated:** 4-6h
- **Why fourth:** Both fixes touch `app/src/api/client.ts` — same-file edits should ship together, not race separate PRs. Rebases on PR-C if `useSSE.ts` conflicts arise (PR-C touches the auth-clear registration; PR-D touches the EventSource error handler — should not collide, but rebase is the safe default).
- **Architecture:**
  - `app/src/api/client.ts`:
    - New `TypeError: Failed to fetch` branch in the fetch wrapper → emits `network-error` custom event on `window` (or a small in-memory bus)
    - Export `triggerAuthInterceptor()` so non-fetch paths (streaming) can hand off to the same 401 flow
  - `app/src/components/NetworkBanner.tsx` (new) — mounted in `App.tsx` shell, subscribes to `network-error` event, renders dismissable banner ("Network connection lost — checking…"), auto-dismisses on next successful fetch
  - `app/src/hooks/useSSE.ts`:
    - On EventSource `error` event → clear local events array (matches QA finding pattern: silent EventSource failures left stale data on screen)
  - `app/src/components/ChatSidebar.tsx` (lines 60-69):
    - In `sendMessage`, after `fetch` resolves, if `res.status === 401` → call `triggerAuthInterceptor()` before parsing the body (currently bypasses 401 because streaming responses skip the response-interceptor path)
- **Files:**
  - `app/src/api/client.ts` (modified)
  - `app/src/api/__tests__/client.test.ts` (modified — add network-error branch test + triggerAuthInterceptor export test)
  - `app/src/components/NetworkBanner.tsx` (new)
  - `app/src/components/__tests__/NetworkBanner.test.tsx` (new) — mounts banner on event, dismisses on success
  - `app/src/App.tsx` (modified — mount `<NetworkBanner />` in shell)
  - `app/src/hooks/useSSE.ts` (modified — clear events on EventSource error)
  - `app/src/hooks/__tests__/useSSE.test.ts` (modified — assert events clear on error)
  - `app/src/components/ChatSidebar.tsx` (modified)
  - `app/src/components/__tests__/ChatSidebar.test.tsx` (modified — assert 401 in stream triggers interceptor)
- **TDD order:**
  1. `client.test.ts` network-error branch — `vi.spyOn(window, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))` → assert `network-error` event fires
  2. Implement client branch
  3. `NetworkBanner.test.tsx` — banner appears on event, dismisses on success
  4. Implement NetworkBanner
  5. `client.test.ts` triggerAuthInterceptor export test — assert export exists + invoking it triggers same flow as response 401
  6. Wire `triggerAuthInterceptor` export
  7. `ChatSidebar.test.tsx` — fetch resolving with 401 status triggers interceptor
  8. Wire ChatSidebar 401 branch
  9. `useSSE.test.ts` — EventSource error event clears local events
  10. Wire useSSE error handler
  11. Mount `<NetworkBanner />` in App.tsx
- **Acceptance:**
  - `pnpm typecheck` clean
  - All new + modified tests pass
  - Manual repro 1: in DevTools, `window.fetch = () => Promise.reject(new TypeError('Failed to fetch'))` → banner appears on next request → restore fetch → banner dismisses on next success
  - Manual repro 2: simulate JWT expiry, open Ask SIPHER chat sidebar, send a message → 401 streaming response triggers session-expired flow + redirect to landing
  - Manual repro 3: open privacy view, force EventSource disconnect (block `*.sip-protocol.org` in DevTools Network tab) → events array clears (no stale rendering)
- **UX decision deferred to PR-D subagent (with RECTOR review of mock):** Whether `<NetworkBanner>` is a new component or reuses existing toast primitives. Default: new banner (top-of-shell, persistent, non-toast). Reason: network-loss is persistent state, toasts are ephemeral notifications. But if visual hierarchy gets crowded, evaluate toast-with-sticky-flag as alternative.

---

## Verification cadence

**Per-PR gate** (run before merging each PR):

```bash
git fetch --prune
pnpm typecheck                                # repo root
pnpm test --run                               # repo root agent + sdk + utils
cd app && pnpm test --run                     # app-only
gh pr checks <pr#> --watch                    # CI green
```

**Post-merge ritual** (every PR):

1. Switch to `main` BEFORE running `gh pr merge` (avoid worktree-owns-branch quirk — carry-forward gotcha)
2. `gh pr merge <pr#> --merge --delete-branch` (NOT squash — RECTOR's preferred merge style)
3. `git checkout main && git pull && git worktree remove <path> && git branch -d <branch>`
4. Verify HEAD on `gh run list --limit 1` is green

**Session-end checkpoint** (after PR-D merges):

- Run `/quality:qa --diff-from=1778399617-both-fresh+skeptic`
- Expect: #189, #191, #192, #193, #205 in "Resolved" trend; #190, #194-#204, #206-#221 still in "Open" trend
- This is a CHECKPOINT, not the launch gate — launch gate is post-Tier-4 (next next next session)

---

## Risks + mitigations

| # | Risk | Mitigation |
|---|------|------------|
| R1 | #189 + #191 both touch `app/src/hooks/useSSE.ts` (different concerns: PR-C registers auth-clear callback; PR-D handles EventSource error) | PR-D rebases on top of merged PR-C. Manual conflict resolution if needed. The two changes target different lifecycle hooks (mount/unmount vs. error handler) and should not collide |
| R2 | `onAuthClear` registry feels over-engineered for 5 consumers — could be inlined as direct `setState` calls in auth-store transition | Documented fallback in PR-C "Fallback" subsection. #202 closes either way (with or without registry) |
| R3 | Subagent dispatches feel too heavy (RECTOR's prior interruption of a 2-file fixup-subagent) | Pre-baked subagent prompts include narrow file scope + explicit acceptance criteria + "no exploratory tangents" framing. PR-A and PR-B are inline (mechanical); only PR-C and PR-D dispatch |
| R4 | PR-A test util migration breaks pre-existing tests | TDD discipline: write `makeFakeAuthState` shape test first. Migrate one test file at a time; verify each passes before moving on. If a migration reveals deeper test rot, file as a separate issue rather than expanding PR-A scope |
| R5 | `<NetworkBanner>` UX clashes with existing toast system | Defer mock review to RECTOR mid-PR-D. If visual hierarchy crowded, fall back to toast-with-sticky-flag |
| R6 | #205 reveals stale wallet adapter references in tests/MWA flows beyond the trivial removal scope | Subagent grep-sweep first. If ref count >5, escalate to subagent mode rather than expanding inline scope |
| R7 | Auth-store transition logic is more nuanced than expected (e.g., transient 'connecting' state firing clearAll prematurely) | TDD: registry test asserts clearAll only fires on `'authed' → 'unauthed' | 'expired'` (not on `'connecting' → *`). Auth-store wiring test asserts no clearAll on initial mount or transient connecting states |

---

## Carry-forward execution rules (apply to ALL 4 PRs)

1. NO AI attribution in commits/PRs/files
2. NO semicolons in TS/TSX, single quotes for imports
3. Conventional commits with appropriate scope (`fix(app)`, `chore(app)`, `test(app)`, `feat(app)`)
4. NEVER amend commits; create new ones
5. TDD discipline (failing test → implement → passing test) for code changes
6. CI must be green before merge
7. Use `superpowers:verification-before-completion` before claiming any task done
8. Switch to `main` BEFORE `gh pr merge` (worktree-owns-branch local-cleanup quirk)
9. Build `@sipher/sdk` (`pnpm --filter "@sipher/sdk" build`) before running agent tests in fresh worktree
10. Run app tests from inside `app/` directory: `cd app && pnpm test --run src/...`
11. `--merge --delete-branch` (NOT squash). After merge: sync local main, remove worktree, delete local branch

---

## Out of scope (this session)

- **#190** (Vault Withdraw unauthed) — Tier 2 with #201 + #215; bundles the `<UnauthedEmptyState>` primitive extraction. Splitting the primitive's consumers across sessions would force two PRs to coordinate
- All P1 except #189/#191/#192/#202 — Tier 2 or Tier 3
- All P2 except #205 — Tier 4
- All P3 — Tier 4
- Phase D launch-gate close (3-wallet manual QA, X thread copy review, final `/quality:qa` 🟢) — post-Tier-4

---

## Tier 2-4 outline (subsequent sessions — preview only, will brainstorm at start of each)

| Session | Tier | Scope | Issues | Estimated |
|---------|------|-------|--------|-----------|
| 2 (next) | Tier 2 — Unauthed UX | Extract `<UnauthedEmptyState>`, gate Vault Withdraw, wire URL router, onboarding, Keys page, breadcrumb, "View report" disable | #190, #194, #200, #201, #204, #215 | 12-18h |
| 3 | Tier 3 — Admin reliability | token! crash fix, AbortController, useIsAdmin delegate | #198, #199, #212 | 4-6h |
| 4 | Tier 4 — Independent leaves (parallel via subagent fanout) | Hardcoded values, A11y/SEO, polish, P3 delight gaps | #195-#197, #203, #206-#211, #213-#214, #216-#221 (19 issues) | 12-18h |
| 5 | Phase D launch | `/quality:qa --diff-from` zero open → 3-wallet QA → X thread → LAUNCH | — | 4-8h |

**Total sprint estimate:** 4-5 sessions, ~50-65h work-time.

**Why defer Tier 2 brainstorming until next session:** DAG ordering is locked; PR composition + acceptance criteria for Tier 2's 6 issues should be re-brainstormed once Tier 1's outcome is known (e.g., if `<UnauthedEmptyState>` ergonomics surface in PR-C/D unexpectedly, Tier 2's design adapts).

---

## Approval log

| Decision | Date | Source |
|----------|------|--------|
| Launch gate = zero open QA findings (all 33) | 2026-05-10 | RECTOR via AskUserQuestion |
| Chunking = DAG (foundations → core → UX → admin → leaves) | 2026-05-10 | RECTOR pushback "why not DAG?" |
| Pacing = Tier 0 + 1 this session, rest in subsequent sessions | 2026-05-10 | RECTOR via AskUserQuestion |
| PR shape = 4 PRs (A inline foundations, B inline cleanup, C subagent registry+consumers, D subagent error-handling) | 2026-05-10 | RECTOR via AskUserQuestion |
| Spec written + committed | 2026-05-10 | This document |
