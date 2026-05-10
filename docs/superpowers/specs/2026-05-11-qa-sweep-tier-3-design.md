# QA Sweep — Tier 3 (Admin Reliability) — Design

**Date:** 2026-05-11
**Session:** frontier_48
**Status:** Approved (RECTOR, this session)
**Predecessor:**
  - Handoff: `~/Documents/secret/claude-strategy/sip-protocol/sipher/session-handoff-2026-05-11.md`
  - Tier 2 spec: `docs/superpowers/specs/2026-05-10-qa-sweep-tier-2-design.md`
  - Tier 0+1 spec: `docs/superpowers/specs/2026-05-10-qa-sweep-tier-0-1-design.md`
  - QA report: `~/Documents/secret/qa-reports/sipher/1778399617-both-fresh+skeptic/report.md`
  - Sprint memory: `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/project_phase4b-redesign-sprint.md`
**Scope:** 3 issues (#198, #199, #212) of 33-issue QA sweep — DAG Tier 3
**Out of scope (this session):** Tier 4 (18 leaves + 4 followups #225-#228), Phase D launch-gate close
**Estimated work-time:** 4-6h across 2 PRs

---

## Why this slice

Tier 0+1 (frontier_46) shipped the auth-lifecycle foundations: test util, console cleanup, `onAuthClear` registry + 5 consumers, network-error banner, ChatSidebar 401 interceptor — 6 issues closed. Tier 2 (frontier_47) shipped unauthed UX: `<UnauthedEmptyState>` primitive, React Router 7 migration, onboarding content (Footer, Tooltip, JargonTerm, `/about`) — 6 more issues closed.

Tier 3 layers **admin-view reliability** on top: hardening the three admin views (Herald, Squad/SENTINEL, Settings) and the Dashboard against two latent defect classes — the `token!` non-null assertion that crashes mid-action when JWT clears, and missing `AbortController` cleanup that races with view switches. Plus a small foundational delegation (`useIsAdmin` → `useAuthState`) to consolidate the admin source-of-truth.

The three issues split cleanly into two dependent PRs:

```
PR-A — useIsAdmin delegation ──► foundational; AdminOnly is the lone consumer
  closes #212

PR-B — admin-view reliability ──► hardens HeraldView/SquadView/DashboardView async paths
  closes #198 + #199
```

PR-A ships first (foundational + small) so PR-B can lean on a single source of truth if needed (in practice, PR-B uses `useAuthState().isAdmin` directly per existing pattern). PR-B bundles #198 and #199 because they touch the same files and share the same `handleApprove`/`handleEditSave` code path — the `token!` removal pairs naturally with the `mountedRef` guard added for the post-action `load()`.

The remaining 18 leaves (Tier 4) + 4 followups (#225-#228) + Phase D launch close land in subsequent sessions.

---

## Locked decisions

| # | Decision | Source |
|---|----------|--------|
| D1 | 2 PRs in dependency order: PR-A delegation → PR-B reliability | RECTOR via AskUserQuestion |
| D2 | Silent early-return for `token == null` in HeraldView action handlers (no toast) | RECTOR via AskUserQuestion |
| D3 | `mountedRef` pattern for action-handler post-action reload | RECTOR via AskUserQuestion |
| D4 | Bundle inline-fixture → `makeFakeAuthState` migration in PR-B test files (opportunistic Tier 4 cleanup) | RECTOR via AskUserQuestion |
| D5 | `load` keeps `useCallback` and accepts optional signal — same callable used by useEffect (signal-passed) AND action handlers (no signal) | Spec — needed because action-driven reload uses fresh fetch with mountedRef guard, not the now-aborted effect controller |
| D6 | Both PRs: PR-A INLINE (mechanical, ~1-2h), PR-B SUBAGENT with two-stage review (multi-file, ~3-4h) | Spec — matches Phase 4b execution-mode pattern |

---

## PRs

### PR-A — `fix/use-is-admin-delegate` (closes #212)

- **Mode:** INLINE
- **Estimated:** 1-2h
- **Why first:** Single-file foundational change. Sets the pattern that `useIsAdmin` delegates to `useAuthState` (single source of truth). Independent of PR-B's view-level fixes; can ship first or in parallel.

**Architecture:**

```ts
// app/src/hooks/useIsAdmin.ts (current)
import { useAppStore } from '../stores/app'
export function useIsAdmin() {
  return useAppStore((s) => s.isAdmin)
}

// → after
import { useAuthState } from './useAuthState'
export function useIsAdmin(): boolean {
  return useAuthState().isAdmin
}
```

**Why this is safe:** `AuthSyncProvider` reads `isAdmin` from the same `useAppStore` slice (line 37 of `AuthSyncProvider.tsx`) and exposes it via the `AuthState` interface. The values are guaranteed identical at any render. The delegation collapses two paths to the same data into one source of truth — defends against future drift if `useAuthState` ever derives `isAdmin` from JWT claims rather than store.

**Consumer impact:**

Verified via `grep -rn "useIsAdmin" app/src/`:
- `app/src/components/AdminOnly.tsx` — only call site. No callsite change needed (return type stays `boolean`).
- `app/src/hooks/useIsAdmin.ts` — the hook itself.

**Test impact:**

`AdminOnly.test.tsx` currently sets admin via `useAppStore.setState({ isAdmin: true })`. After delegation, that store mutation no longer reaches the hook (the hook now reads through `AuthSyncProvider` context, not the store directly). Test rewrite:

```tsx
// before
useAppStore.setState({ isAdmin: true })

// → after
vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: vi.fn(),
}))
import { useAuthState } from '../../hooks/useAuthState'
import { makeFakeAuthState } from '../../test-utils/makeFakeAuthState'
// In each test:
vi.mocked(useAuthState).mockReturnValue(makeFakeAuthState({ isAdmin: true }))
```

**Files:**

- `app/src/hooks/useIsAdmin.ts` (modified — 4 lines)
- `app/src/components/__tests__/AdminOnly.test.tsx` (modified — switch fixture pattern)

**TDD order:**

1. Update `AdminOnly.test.tsx` to mock `useAuthState` + use `makeFakeAuthState`. Tests should fail (hook still reads from store).
2. Change `useIsAdmin.ts` to delegate. Tests pass.
3. `pnpm exec tsc --noEmit` clean.

**Acceptance:**

- All 3 existing AdminOnly tests pass with new fixture pattern
- `pnpm test --run src/components/__tests__/AdminOnly.test.tsx` green
- `pnpm exec tsc --noEmit` clean from `app/`
- No new tests needed (existing 3 cover admin/non-admin/missing branches)

---

### PR-B — `fix/admin-views-reliability` (closes #198 + #199)

- **Mode:** SUBAGENT-driven w/ TDD; two-stage review per task (spec-compliance THEN code-quality)
- **Estimated:** 3-4h
- **Why bundled:** #198 and #199 touch the same files (HeraldView, SquadView, DashboardView, SettingsView) and share the same `handleApprove`/`handleEditSave` code path. The `token!` removal pairs naturally with the `mountedRef` guard added for the post-action `load()`. Splitting into 2 sub-PRs would require touching the same lines twice.

**Architecture:**

#### #198 — silent early-return for `token!` removal

`HeraldView.tsx:430,439` are the only two `token!` callsites in `app/src/` (verified via `grep -rn "token!" app/src/`). Both are in `handleApprove` and `handleEditSave` action handlers passed down to `<QueueTab>`.

```tsx
// HeraldView.tsx — before (lines 426-442)
const handleApprove = async (id: string, action: 'approve' | 'reject') => {
  await apiFetch(`/api/herald/approve/${id}`, {
    method: 'POST',
    body: JSON.stringify({ action }),
    token: token!,                    // ← crash potential if cleared mid-render
  })
  load()
}

// → after
const handleApprove = async (id: string, action: 'approve' | 'reject') => {
  if (!token) return                  // ← silent early-return; next render shows unauthed empty state
  await apiFetch(`/api/herald/approve/${id}`, {
    method: 'POST',
    body: JSON.stringify({ action }),
    token,                            // ← narrowed to string by the guard
  })
  if (!mountedRef.current) return     // ← #199 fix below
  load()
}
```

Same shape for `handleEditSave`.

**Why silent (no toast):**

- Matches the global 401 interceptor pattern: `apiFetch` already surfaces a "Session expired — Sign in" toast on 401 (`AuthSyncProvider` lines 224-241). For the rare absolute JWT expiry case (5min watcher fires), the next render naturally shows the existing "Connect your wallet to view HERALD activity" empty state at `HeraldView.tsx:446-452`.
- Issue #198's own suggested fix calls out: "adding the local guard means we never reach the network with bad auth state" — i.e., the WIN is preventing a bad-token API call, not adding a duplicate toast.
- `<QueueTab>`'s `try/finally` and `cancelEdit()` after `await onEditSave` continue to work; `cancelEdit()` runs after a no-op early-return, but that's fine because the `token === null` next render swaps the whole queue UI for the unauthed empty state.

#### #199 — AbortController for effect-driven loads

**HeraldView.tsx — `load` and useEffect refactor:**

```tsx
// before (lines 413-424)
const load = useCallback(() => {
  if (!token) return
  setError(null)
  apiFetch<HeraldData>('/api/herald', { token })
    .then(setData)
    .catch((err: Error) => setError(err.message))
}, [token])

useEffect(() => {
  if (!isAdmin) return
  load()
}, [isAdmin, load])

// → after
const load = useCallback((signal?: AbortSignal) => {
  if (!token) return
  setError(null)
  apiFetch<HeraldData>('/api/herald', { token, signal })
    .then((data) => {
      if (!signal?.aborted) setData(data)
    })
    .catch((err: Error) => {
      if (err.name === 'AbortError') return
      if (!signal?.aborted) setError(err.message)
    })
}, [token])

useEffect(() => {
  if (!isAdmin) return
  const controller = new AbortController()
  load(controller.signal)
  return () => controller.abort()
}, [isAdmin, load])
```

**Why `load` keeps `useCallback` + accepts optional signal (D5):** action handlers (`handleApprove`, `handleEditSave`) need to call `load()` after a successful action **without** the effect's signal — they want a fresh fetch using the live `mountedRef` guard, not the now-aborted effect controller. Optional signal handles both call sites.

**SquadView.tsx — same pattern** (no action handlers reload, simpler):

```tsx
const load = useCallback((signal?: AbortSignal) => {
  if (!token) return
  setError(null)
  apiFetch<SquadRaw>('/api/squad', { token, signal })
    .then((raw) => {
      if (!signal?.aborted) setData(normalizeSquadData(raw))
    })
    .catch((err: Error) => {
      if (err.name === 'AbortError') return
      if (!signal?.aborted) setError(err.message)
    })
}, [token])

useEffect(() => {
  if (!isAdmin) return
  const controller = new AbortController()
  load(controller.signal)
  return () => controller.abort()
}, [isAdmin, load])
```

**DashboardView.tsx — wrap second useEffect (lines 104-121) with AbortController:**

```tsx
useEffect(() => {
  if (!token) return
  const controller = new AbortController()
  apiFetch<VaultData>('/api/vault', { token, signal: controller.signal })
    .then((data) => {
      if (!controller.signal.aborted) setVault(data)
    })
    .catch((err: Error) => {
      if (err.name === 'AbortError') return
      // network errors fall through to null vault state
    })
  apiFetch<{ activity: ActivityRecord[] }>('/api/activity', { token, signal: controller.signal })
    .then((data) => {
      if (!controller.signal.aborted) {
        setHistory(
          (data.activity ?? []).map((a: ActivityRecord): ActivityRow => ({
            id: a.id,
            agent: a.agent,
            type: a.type,
            level: a.level,
            data: parseDetail(a.detail),
            timestamp: a.created_at,
          })),
        )
      }
    })
    .catch((err: Error) => {
      if (err.name === 'AbortError') return
    })
  return () => controller.abort()
}, [token])
```

The existing privacy-score useEffect (lines 84-89) is already AbortController-aware and stays unchanged.

#### #199 — `mountedRef` for action-handler reloads

**HeraldView.tsx — add after the existing useEffects:**

```tsx
const mountedRef = useRef(true)
useEffect(() => () => { mountedRef.current = false }, [])
```

Used in `handleApprove` and `handleEditSave` to guard the post-action `load()` (see #198 code block above).

**Why mountedRef and not AbortController for action handlers (D3):**

- Action handlers run user-initiated work; the action's apiFetch should mostly be allowed to complete (rejecting halfway leaves UI in an inconsistent state — the server may have already processed the approve/edit).
- The post-action `load()` is the only call we want to skip on unmount.
- `mountedRef` directly answers "is the component still mounted?" without coupling to the abort lifecycle.
- Issue #199's own suggested fix uses this pattern verbatim.

#### #199 — SettingsView dead-state cleanup

`SettingsView.tsx` already does AbortController correctly (lines 53-66). The `aborterRef` at line 45 + assignment at line 54 is dead — never read. The cleanup at line 66 uses the local `controller`, not the ref.

**Delete:**
- `useRef` from React imports (becomes unused after ref removal)
- `const aborterRef = useRef<AbortController | null>(null)` (line 45)
- `aborterRef.current = controller` (line 54)

Verify TS check: `useRef` is the only React import that becomes unused; lint catches if any other code path still references it.

**Files (PR-B):**

| File | Issues | Change |
|---|---|---|
| `app/src/views/HeraldView.tsx` | #198 + #199 | Drop `token!` (lines 430, 439) → silent early-return; refactor `load` to accept optional signal; wrap useEffect with AbortController; add `mountedRef` for action-handler reloads |
| `app/src/views/SquadView.tsx` | #199 | Refactor `load` to accept optional signal; wrap useEffect with AbortController. KillSwitch handler unchanged (no post-action reload) |
| `app/src/views/DashboardView.tsx` | #199 | Wrap vault + activity useEffect (lines 104-121) with AbortController. Privacy-score useEffect (lines 84-89) unchanged |
| `app/src/views/SettingsView.tsx` | #199 | Delete dead `aborterRef` + unused `useRef` import |
| `app/src/views/__tests__/HeraldView.test.tsx` | tests + D4 | Add abort-on-unmount test; add defensive token-null guard test; migrate inline fixtures → `makeFakeAuthState` |
| `app/src/views/__tests__/HeraldView-edit.test.tsx` | D4 | Migrate inline `vi.fn(() => ({ ... }))` fixture → `makeFakeAuthState` |
| `app/src/views/__tests__/SquadView.test.tsx` | tests + D4 | Add abort-on-unmount test; migrate inline fixtures → `makeFakeAuthState` |
| `app/src/views/__tests__/DashboardView.test.tsx` | tests | Add abort-on-unmount test for vault + activity fetches (existing test already uses `makeFakeAuthState`) |

**TDD order (one-shot per file from a single subagent dispatch):**

1. Add new tests for HeraldView (abort-on-unmount + defensive guard) — should fail (current code has no AbortController, has `token!`).
2. Add new test for SquadView (abort-on-unmount) — should fail.
3. Add new test for DashboardView (abort-on-unmount for vault + activity) — should fail.
4. Implement HeraldView fixes — drop `token!`, add `mountedRef`, refactor `load`, wrap useEffect with AbortController. Tests 1+ pass.
5. Implement SquadView fixes — refactor `load` + AbortController in useEffect. Test 2 passes.
6. Implement DashboardView fix — wrap second useEffect with AbortController. Test 3 passes.
7. Implement SettingsView cleanup — delete dead `aborterRef` + `useRef` import. Existing 5 tests still pass.
8. Migrate D4 fixtures — inline `{ ... } as ReturnType<typeof useAuthState>` → `makeFakeAuthState({ ... })` in 3 test files.
9. `pnpm exec tsc --noEmit` clean from `app/`.

**Test pattern reference — abort-on-unmount:**

```tsx
it('aborts in-flight load on unmount', async () => {
  let capturedSignal: AbortSignal | undefined
  vi.mocked(apiFetch).mockImplementation((_path, opts) => {
    capturedSignal = (opts as { signal?: AbortSignal }).signal
    return new Promise(() => {}) // never resolves
  })
  vi.mocked(useAuthState).mockReturnValue(
    makeFakeAuthState({ status: 'authed', token: 't', isAdmin: true }),
  )
  const { unmount } = renderHerald()
  await waitFor(() => expect(capturedSignal).toBeDefined())
  expect(capturedSignal?.aborted).toBe(false)
  unmount()
  expect(capturedSignal?.aborted).toBe(true)
})
```

**Test pattern reference — defensive guard (HeraldView only):**

```tsx
it('does not call apiFetch when token is null even with isAdmin', () => {
  vi.mocked(useAuthState).mockReturnValue(
    makeFakeAuthState({ status: 'authed', token: null, isAdmin: true }),
  )
  renderHerald('')  // token prop = empty string, falsy
  expect(screen.getByText(/Connect your wallet to view HERALD activity/i)).toBeInTheDocument()
  expect(vi.mocked(apiFetch)).not.toHaveBeenCalled()
})
```

**Acceptance (PR-B):**

Behavioral:
- HeraldView: no `token!` in source. `grep -rn "token!" app/src/` returns zero results.
- HeraldView: `handleApprove` + `handleEditSave` silent-early-return when `token == null`. No `apiFetch` call, no crash.
- HeraldView/SquadView/DashboardView: in-flight loads abort on component unmount (verified by `signal.aborted === true` after `unmount()`).
- HeraldView: action-handler post-action `load()` skipped if `mountedRef.current === false`.
- SettingsView: dead `aborterRef` + unused `useRef` import deleted; existing AbortController behavior preserved.

Tests:
- App tests: 456 → ~462+ (3 new abort tests + 1 defensive guard test = +4 minimum)
- Test files: 74 → 74 (no new files)
- `pnpm exec tsc --noEmit` clean from `app/`

CI:
- All component, e2e, and lint workflows green
- No flaky retries needed; if flake recurs ≥2x, investigate

Manual smoke (optional, low value at this scope): load Vercel preview as admin → click Herald → see queue render → switch tab quickly → verify no console error or stale-state warning. Skipped if CI green; visual gate is the Vercel preview itself.

---

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Refactoring `load` from bare-then to AbortController-aware breaks `HeraldView-edit.test.tsx` | Medium | The edit test uses `global.fetch` mock (not `apiFetch` mock). Signal is passed through to `fetch` — `fetch` ignores unknown options. PATCH path doesn't use signal. Test should pass unchanged. |
| `mountedRef` cleanup runs in wrong order vs other useEffect cleanups | Low | `useEffect(() => () => { mountedRef.current = false }, [])` is independent of other effects, fires on unmount only. React guarantees cleanup function execution before component is fully removed. |
| `useIsAdmin` delegation changes the AdminOnly subscription pattern (zustand subscribes once vs context re-renders on every Auth value change) | Low | `useAuthState` already returns memoized value via `useMemo` (`AuthSyncProvider` line 244-253). Re-render frequency unchanged. |
| TS error after `useRef` removal from SettingsView if other code uses it | Low | `grep` verifies single-use; `tsc --noEmit` and lint catch unused imports |
| `apiFetch` doesn't actually pass `signal` through to fetch when omitted | Verified safe | `apiFetch` spreads `...fetchOpts` into `fetch` (line 54-57 of `api/client.ts`). When `signal` is undefined, it's spread as `signal: undefined` which `fetch` treats as no signal. |
| `AbortError` propagates and triggers global `sipher:network-error` event | Low | `apiFetch`'s `TypeError` catch is for `Failed to fetch` only. `AbortError` is a `DOMException`, not a `TypeError` — bypasses the network-error path. Verified via `app/src/api/client.ts:62`. |

---

## Sprint cadence

- PR-A: ~1-2h INLINE → merge → sync main → start PR-B
- PR-B: ~3-4h SUBAGENT w/ two-stage review → merge → sync main
- Total wall-clock: ~5-6h including reviews

---

## Out of scope (this session)

- All 18 Tier 4 leaves (#195-#197, #203, #206-#211, #213-#214, #216-#221) — independent fanout next session
- 4 followups from frontier_46 (#225 useSSE in-flight race, #226 dev-warn on swallowed throws, #227 TypeError narrowing, #228 event-spam dedup)
- Tier 2 deferred polish items other than the D4 `makeFakeAuthState` migration (Tooltip cloneElement footgun, Banner copy diff, VIEW_TO_PATH dedup, admin redirect `{ replace: true }`, Sheet `onClose` re-creation, UnauthedEmptyState static testid, Banner first-mount silence)
- Migration of WithdrawView/DepositView test fixtures to `makeFakeAuthState` — Tier 4 (D4 only covers admin views modified in this PR)
- Phase D launch close (3-wallet QA + X thread + final `/quality:qa --diff-from`) — RECTOR-driven gates after Tier 4

---

## Carry-forward conventions (from Phase 4b sprint, applies to both PRs)

1. NO AI attribution in commits/PRs/files
2. NO semicolons in TS/TSX (single quotes for imports)
3. Conventional commits with appropriate scope (`fix(app)`, `test(app)`, `chore(app)`, `refactor(app)`)
4. NEVER amend commits; create new ones
5. TDD discipline (failing test → implement → passing test) for code changes
6. CI must be green before merge; if flaky, retry once before investigating
7. `--merge --delete-branch` (NOT squash). After merge: sync local main, remove worktree, delete local branch
8. Multi-issue PRs: use one `Closes #X` per line in description (NOT comma-separated) — `gh` only auto-closes the FIRST match in a comma list
9. Subagent-driven for genuinely complex; INLINE for mechanical
10. Use `superpowers:verification-before-completion` before claiming any task done
11. Switch to main BEFORE running `gh pr merge` (avoid worktree-owns-branch local-cleanup quirk)
12. Build `@sipher/sdk` (`pnpm --filter "@sipher/sdk" build`) before running agent tests in a fresh worktree (NOT needed for app tests — pure FE)
13. Run app tests from inside `app/` directory: `cd app && pnpm test --run src/...`
14. Typecheck command is `pnpm exec tsc --noEmit` from `app/` (NOT `pnpm typecheck` — script doesn't exist)
