# QA Sweep — Tier 3 (Admin Reliability) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 3 admin-reliability QA findings (#198 `token!` crash, #199 missing AbortController, #212 `useIsAdmin` delegation) across 2 PRs, hardening admin views (Herald, Squad, Settings) and Dashboard against auth-boundary races and view-switch unmount races.

**Architecture:** PR-A is a one-line hook delegation that consolidates the admin source-of-truth in `useAuthState`. PR-B refactors three admin/dashboard views to use AbortController-aware `load` functions (with `useCallback((signal?) => {...})` signature so action handlers can call without a signal), drops two `token!` non-null assertions in favor of silent early-return guards, and adds a `mountedRef` for HeraldView's post-action `load()`. Bundles opportunistic `makeFakeAuthState` migration in 3 admin-view test files to lock in the type-safe fixture pattern.

**Tech Stack:** React 19 + TypeScript (strict), Vitest, @testing-library/react. AbortController is browser-native; `apiFetch` already accepts `signal` via the spread `RequestInit`.

**Spec:** `docs/superpowers/specs/2026-05-11-qa-sweep-tier-3-design.md` (committed `4f3f96b`)

**Predecessor sprint memory:** `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/project_phase4b-redesign-sprint.md`

---

## Worktree setup (run BEFORE PR-A)

Each PR uses its own worktree per the Phase 4b convention. PR-A is INLINE (no subagent), PR-B is SUBAGENT-driven with two-stage review.

- [ ] **Sync local main + verify clean state**

```bash
cd ~/local-dev/sipher
git checkout main
git pull --ff-only
git status                    # expect: clean, on main, up to date
git log --oneline -3          # expect: 4f3f96b spec commit on top of ee0e50d
```

- [ ] **Verify @noble/ciphers symlink (Tier 2 carry-forward)**

```bash
ls app/node_modules/@noble/ | head -3   # expect: ciphers symlink present
# If missing: pnpm install --force
```

- [ ] **Verify baseline test count + tsc clean**

```bash
cd app
pnpm test --run src/ 2>&1 | tail -5     # expect: 456 passed across 74 files
pnpm exec tsc --noEmit                  # expect: clean exit, no output
cd ..
```

---

## PR-A — `fix/use-is-admin-delegate` (closes #212)

**Mode:** INLINE (mechanical, ~1-2h, single-file change)

### Task A0: Create worktree

**Files:**
- New: `.worktrees/feat-use-is-admin-delegate/`

- [ ] **Step 1: Create the worktree**

```bash
cd ~/local-dev/sipher
git worktree add .worktrees/feat-use-is-admin-delegate -b fix/use-is-admin-delegate main
cd .worktrees/feat-use-is-admin-delegate
```

- [ ] **Step 2: Verify @noble/ciphers symlink in worktree**

```bash
ls app/node_modules/@noble/ 2>/dev/null
# If empty or missing ciphers: pnpm install --force from worktree root
```

---

### Task A1: Update AdminOnly test to use useAuthState mock + makeFakeAuthState

**Files:**
- Modify: `app/src/components/__tests__/AdminOnly.test.tsx`

- [ ] **Step 1: Read the existing test file to understand the current shape**

```bash
cat app/src/components/__tests__/AdminOnly.test.tsx
```

Expected current pattern: 3 tests using `useAppStore.setState({ isAdmin: ... })`.

- [ ] **Step 2: Rewrite the test file**

Replace the file contents with:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAppStore } from '../../stores/app'
import { makeFakeAuthState } from '../../test-utils/makeFakeAuthState'
import AdminOnly from '../AdminOnly'

vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: vi.fn(),
}))

import { useAuthState } from '../../hooks/useAuthState'

describe('AdminOnly', () => {
  beforeEach(() => {
    useAppStore.setState({ token: null, isAdmin: false, messages: [], chatLoading: false })
    vi.mocked(useAuthState).mockReset()
  })

  it('renders children when admin', () => {
    vi.mocked(useAuthState).mockReturnValue(makeFakeAuthState({ isAdmin: true }))
    render(<AdminOnly>Admin content</AdminOnly>)
    expect(screen.getByText('Admin content')).toBeInTheDocument()
  })

  it('renders fallback when not admin', () => {
    vi.mocked(useAuthState).mockReturnValue(makeFakeAuthState({ isAdmin: false }))
    render(<AdminOnly fallback={<span>Restricted</span>}>Admin content</AdminOnly>)
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument()
    expect(screen.getByText('Restricted')).toBeInTheDocument()
  })

  it('renders nothing when not admin and no fallback', () => {
    vi.mocked(useAuthState).mockReturnValue(makeFakeAuthState({ isAdmin: false }))
    const { container } = render(<AdminOnly>Admin content</AdminOnly>)
    expect(container.textContent).toBe('')
  })
})
```

NOTE: If the existing test file has a different test signature (e.g., `AdminOnly` takes different props), preserve those signatures and only change the fixture pattern. Re-read the source `app/src/components/AdminOnly.tsx` first to confirm the actual prop shape.

- [ ] **Step 3: Run the test — expect 3 failures**

```bash
cd app
pnpm test --run src/components/__tests__/AdminOnly.test.tsx
```

Expected: tests fail because `useIsAdmin` still reads from `useAppStore` (so the `useAuthState` mock has no effect). Failure messages will assert the wrong renderings.

- [ ] **Step 4: Commit (red phase)**

```bash
cd ..
git add app/src/components/__tests__/AdminOnly.test.tsx
git commit -m "test(app): switch AdminOnly fixture to useAuthState mock"
```

---

### Task A2: Implement useIsAdmin delegation

**Files:**
- Modify: `app/src/hooks/useIsAdmin.ts`

- [ ] **Step 1: Replace the hook implementation**

Current `app/src/hooks/useIsAdmin.ts`:

```ts
import { useAppStore } from '../stores/app'

export function useIsAdmin() {
  return useAppStore((s) => s.isAdmin)
}
```

Replace with:

```ts
import { useAuthState } from './useAuthState'

export function useIsAdmin(): boolean {
  return useAuthState().isAdmin
}
```

- [ ] **Step 2: Run AdminOnly tests — expect 3 passes**

```bash
cd app
pnpm test --run src/components/__tests__/AdminOnly.test.tsx
```

Expected: all 3 tests pass.

- [ ] **Step 3: Run typecheck — expect clean**

```bash
pnpm exec tsc --noEmit
```

Expected: clean exit.

- [ ] **Step 4: Run full app test suite — expect 456 → 456 passing (no regression)**

```bash
pnpm test --run src/ 2>&1 | tail -5
```

Expected: same total count as baseline (no new tests added in PR-A).

- [ ] **Step 5: Commit**

```bash
cd ..
git add app/src/hooks/useIsAdmin.ts
git commit -m "fix(app): delegate useIsAdmin to useAuthState for single source of truth

Closes #212"
```

---

### Task A3: Push, open PR, merge

- [ ] **Step 1: Push the branch**

```bash
git push -u origin fix/use-is-admin-delegate
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --repo sip-protocol/sipher --base main --head fix/use-is-admin-delegate \
  --title "fix(app): delegate useIsAdmin to useAuthState (#212)" \
  --body "$(cat <<'EOF'
## Summary

Delegates `useIsAdmin` to `useAuthState().isAdmin` for a single admin source of truth. Currently the hook reads `isAdmin` from `useAppStore` directly while everything else flows through `useAuthState` (the AuthSyncProvider context). They happen to agree today because `useAuthState` selects from the same store, but the two hooks could drift if `useAuthState` ever derives `isAdmin` from JWT claims rather than the store slice.

## Change

`app/src/hooks/useIsAdmin.ts` — switch from `useAppStore((s) => s.isAdmin)` to `useAuthState().isAdmin`. Adds explicit `: boolean` return annotation.

`app/src/components/__tests__/AdminOnly.test.tsx` — migrate the 3 tests from `useAppStore.setState({ isAdmin: ... })` fixture pattern to the `useAuthState` mock + `makeFakeAuthState` factory pattern (matches existing PR 7+ convention).

## Test plan

- [x] AdminOnly tests green (3/3)
- [x] No app-tests regression (still 456 passing)
- [x] `pnpm exec tsc --noEmit` clean

Closes #212
EOF
)"
```

- [ ] **Step 3: Wait for CI green, then merge**

Wait for all required CI checks to pass (typically component, lint, e2e). If a check is flaky, retry once before investigating.

```bash
gh pr checks --repo sip-protocol/sipher --watch
```

Once green:

```bash
# Switch back to main BEFORE merging (avoids worktree-owns-branch local-cleanup quirk)
cd ~/local-dev/sipher
git checkout main
gh pr merge <pr-number> --merge --delete-branch
```

- [ ] **Step 4: Sync main + remove worktree**

```bash
git pull --ff-only
git worktree remove .worktrees/feat-use-is-admin-delegate
git branch -d fix/use-is-admin-delegate 2>/dev/null || true
gh issue view 212 --repo sip-protocol/sipher --json state | grep CLOSED
# expect: state CLOSED (auto-closed by PR merge via Closes #212)
```

---

## PR-B — `fix/admin-views-reliability` (closes #198 + #199)

**Mode:** SUBAGENT-driven w/ TDD; two-stage review (spec-compliance THEN code-quality) per task

### Task B0: Create worktree

**Files:**
- New: `.worktrees/feat-admin-views-reliability/`

- [ ] **Step 1: Sync main first**

```bash
cd ~/local-dev/sipher
git checkout main
git pull --ff-only        # pull PR-A merge
```

- [ ] **Step 2: Create the worktree**

```bash
git worktree add .worktrees/feat-admin-views-reliability -b fix/admin-views-reliability main
cd .worktrees/feat-admin-views-reliability
ls app/node_modules/@noble/ 2>/dev/null
# If empty or missing ciphers: pnpm install --force from worktree root
```

- [ ] **Step 3: Verify baseline in worktree**

```bash
cd app
pnpm test --run src/ 2>&1 | tail -5     # expect: 456 passed across 74 files (PR-A added no tests)
pnpm exec tsc --noEmit                  # expect: clean
cd ..
```

---

### Task B1: Add abort-on-unmount test for HeraldView (red)

**Files:**
- Modify: `app/src/views/__tests__/HeraldView.test.tsx`

- [ ] **Step 1: Add the test at the end of the existing test file**

Append a new `describe` block to `app/src/views/__tests__/HeraldView.test.tsx`:

```tsx
import { makeFakeAuthState } from '../../test-utils/makeFakeAuthState'

describe('HeraldView AbortController', () => {
  beforeEach(() => {
    vi.mocked(useAuthState).mockReturnValue(
      makeFakeAuthState({ status: 'authed', token: 't', publicKey: 'pk', isAdmin: true }),
    )
  })

  it('aborts in-flight /api/herald load on unmount', async () => {
    const { apiFetch } = await import('../../api/client')
    let capturedSignal: AbortSignal | undefined
    vi.mocked(apiFetch).mockImplementation((_path, opts) => {
      capturedSignal = (opts as { signal?: AbortSignal } | undefined)?.signal
      return new Promise(() => {}) // never resolves
    })
    const { unmount } = renderHerald()
    await waitFor(() => expect(capturedSignal).toBeDefined())
    expect(capturedSignal?.aborted).toBe(false)
    unmount()
    expect(capturedSignal?.aborted).toBe(true)
  })
})
```

NOTE: The existing test file already imports `useAuthState` and `apiFetch`. Reuse the existing `renderHerald` helper. Place the new `describe` after the existing two describe blocks. Add the `makeFakeAuthState` import at the top alongside other imports.

- [ ] **Step 2: Add the defensive token-null guard test in the same file**

Add a second test inside the `describe('HeraldView AbortController', ...)` block:

```tsx
it('does not call apiFetch when token prop is empty even with isAdmin', async () => {
  const { apiFetch } = await import('../../api/client')
  vi.mocked(apiFetch).mockClear()
  const { container } = renderHerald('')   // empty string token prop is falsy
  expect(container.textContent).toMatch(/Connect your wallet to view HERALD activity/i)
  expect(vi.mocked(apiFetch)).not.toHaveBeenCalled()
})
```

NOTE: The callback is `async` because of the dynamic `await import('../../api/client')`. The existing `renderHerald(token = 't')` accepts a string; passing `''` is type-safe and falsy.

- [ ] **Step 3: Run tests — expect failures**

```bash
cd app
pnpm test --run src/views/__tests__/HeraldView.test.tsx
```

Expected: 2 new tests FAIL — abort test fails because `apiFetch` is called without `signal`; defensive test fails because the existing `apiFetch` mock at top of file (mockResolvedValue with default queue/budget data) gets called regardless.

WAIT — the existing top-level `apiFetch` mock (`vi.mock('../../api/client', () => ({ apiFetch: vi.fn().mockResolvedValue({ ... }) }))`) means `apiFetch` is callable but never sees `signal`. The abort test's per-test `mockImplementation` will override; it should capture `undefined` for signal pre-fix. Assertion `expect(capturedSignal?.aborted).toBe(false)` would fail because `capturedSignal` is undefined. Pre-fix RED state confirmed.

- [ ] **Step 4: Commit (red phase)**

```bash
cd ..
git add app/src/views/__tests__/HeraldView.test.tsx
git commit -m "test(app): add HeraldView AbortController + token-guard tests (red)"
```

---

### Task B2: Implement HeraldView fixes (green)

**Files:**
- Modify: `app/src/views/HeraldView.tsx`

- [ ] **Step 1: Update React imports**

In `app/src/views/HeraldView.tsx:1`, change:

```tsx
import { useEffect, useState, useCallback } from 'react'
```

to:

```tsx
import { useEffect, useState, useCallback, useRef } from 'react'
```

- [ ] **Step 2: Add `mountedRef` and refactor `load` and useEffect**

Replace the current block (HeraldView.tsx:413-424):

```tsx
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
```

with:

```tsx
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

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

- [ ] **Step 3: Update handleApprove (HeraldView.tsx:426-433)**

Replace:

```tsx
  const handleApprove = async (id: string, action: 'approve' | 'reject') => {
    await apiFetch(`/api/herald/approve/${id}`, {
      method: 'POST',
      body: JSON.stringify({ action }),
      token: token!,
    })
    load()
  }
```

with:

```tsx
  const handleApprove = async (id: string, action: 'approve' | 'reject') => {
    if (!token) return
    await apiFetch(`/api/herald/approve/${id}`, {
      method: 'POST',
      body: JSON.stringify({ action }),
      token,
    })
    if (!mountedRef.current) return
    load()
  }
```

- [ ] **Step 4: Update handleEditSave (HeraldView.tsx:435-442)**

Replace:

```tsx
  const handleEditSave = async (id: string, content: string) => {
    await apiFetch(`/api/herald/queue/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
      token: token!,
    })
    load()
  }
```

with:

```tsx
  const handleEditSave = async (id: string, content: string) => {
    if (!token) return
    await apiFetch(`/api/herald/queue/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
      token,
    })
    if (!mountedRef.current) return
    load()
  }
```

- [ ] **Step 5: Run HeraldView tests — expect all pass**

```bash
cd app
pnpm test --run src/views/__tests__/HeraldView.test.tsx
pnpm test --run src/views/__tests__/HeraldView-edit.test.tsx
```

Expected: HeraldView.test.tsx — all tests pass (existing + 2 new). HeraldView-edit.test.tsx — still passes (uses global.fetch mock, unaffected by signal pass-through).

- [ ] **Step 6: Verify no `token!` callsites remain in source**

```bash
grep -rn "token!" app/src/ 2>/dev/null
```

Expected: no output (zero matches).

- [ ] **Step 7: Run typecheck — expect clean**

```bash
pnpm exec tsc --noEmit
```

Expected: clean exit.

- [ ] **Step 8: Commit (green phase)**

```bash
cd ..
git add app/src/views/HeraldView.tsx
git commit -m "fix(app): add AbortController + mountedRef + token guard to HeraldView

- Drop token! non-null assertions in handleApprove/handleEditSave;
  replace with silent early-return guards. Next render shows existing
  unauthed empty state.
- Refactor load to accept optional AbortSignal so the effect can pass
  one and action handlers can call without one.
- Add mountedRef so post-action load() is skipped after unmount.

Part of #198, #199"
```

---

### Task B3: Add abort-on-unmount test for SquadView (red)

**Files:**
- Modify: `app/src/views/__tests__/SquadView.test.tsx`

- [ ] **Step 1: Add the test at the end of the existing test file**

Append a new `describe` block to `app/src/views/__tests__/SquadView.test.tsx`:

```tsx
describe('SquadView AbortController', () => {
  beforeEach(() => {
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: true,
    } as ReturnType<typeof useAuthState>)
  })

  it('aborts in-flight /api/squad load on unmount', async () => {
    let capturedSignal: AbortSignal | undefined
    vi.mocked(apiFetch).mockImplementation((_path, opts) => {
      capturedSignal = (opts as { signal?: AbortSignal } | undefined)?.signal
      return new Promise(() => {}) // never resolves
    })
    const { unmount } = renderSquad()
    await waitFor(() => expect(capturedSignal).toBeDefined())
    expect(capturedSignal?.aborted).toBe(false)
    unmount()
    expect(capturedSignal?.aborted).toBe(true)
  })
})
```

NOTE: Inline `as ReturnType<typeof useAuthState>` cast is intentional here — Task B6 migrates ALL fixtures in this file to `makeFakeAuthState` in one pass. Keeping the cast in this red task isolates the test addition from the fixture migration.

- [ ] **Step 2: Run test — expect failure**

```bash
cd app
pnpm test --run src/views/__tests__/SquadView.test.tsx
```

Expected: new test FAILS because `apiFetch` is called without `signal` pre-fix; `capturedSignal` stays undefined; `expect(capturedSignal?.aborted).toBe(false)` fails.

- [ ] **Step 3: Commit (red phase)**

```bash
cd ..
git add app/src/views/__tests__/SquadView.test.tsx
git commit -m "test(app): add SquadView AbortController test (red)"
```

---

### Task B4: Implement SquadView fix (green)

**Files:**
- Modify: `app/src/views/SquadView.tsx`

- [ ] **Step 1: Refactor `load` and useEffect**

Replace the current block (SquadView.tsx:238-249):

```tsx
  const load = useCallback(() => {
    if (!token) return
    setError(null)
    apiFetch<SquadRaw>('/api/squad', { token })
      .then((raw) => setData(normalizeSquadData(raw)))
      .catch((err: Error) => setError(err.message))
  }, [token])

  useEffect(() => {
    if (!isAdmin) return
    load()
  }, [isAdmin, load])
```

with:

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

- [ ] **Step 2: Run SquadView tests — expect all pass**

```bash
cd app
pnpm test --run src/views/__tests__/SquadView.test.tsx
```

Expected: all tests pass (existing + 1 new).

- [ ] **Step 3: Run typecheck — expect clean**

```bash
pnpm exec tsc --noEmit
```

Expected: clean exit.

- [ ] **Step 4: Commit (green phase)**

```bash
cd ..
git add app/src/views/SquadView.tsx
git commit -m "fix(app): add AbortController to SquadView load

Refactor load to accept optional AbortSignal; useEffect creates a
controller and aborts on cleanup. Mirrors the pattern landed in
HeraldView and the existing VaultView reference.

Part of #199"
```

---

### Task B5: Add abort-on-unmount test for DashboardView (red)

**Files:**
- Modify: `app/src/views/__tests__/DashboardView.test.tsx`

- [ ] **Step 1: Add the test at the end of the existing describe block**

Append a new `it` to the existing `describe('DashboardView', ...)` block in `app/src/views/__tests__/DashboardView.test.tsx`:

```tsx
  it('aborts in-flight /api/vault and /api/activity on unmount', async () => {
    const capturedSignals: AbortSignal[] = []
    ;(apiFetch as ReturnType<typeof vi.fn>).mockImplementation((path: string, opts?: { signal?: AbortSignal }) => {
      if (path === '/api/vault' || path === '/api/activity') {
        if (opts?.signal) capturedSignals.push(opts.signal)
        return new Promise(() => {}) // never resolves so the signal stays in flight
      }
      // privacy-score and chains paths still resolve so the rest of the view mounts cleanly
      if (path === '/v1/privacy/score') return Promise.resolve(fakePrivacyScore)
      if (path === '/api/chains') return Promise.resolve({ chains: [] })
      if (path === '/api/chains/aggregate') {
        return Promise.resolve({ totalTvlSol: 0, chainCount: 0, liveChainCount: 0, asOf: 't' })
      }
      if (path === '/api/stealth/index') return Promise.resolve({ tree: [], rootWallet: 'W' })
      return Promise.reject(new Error('unexpected path: ' + path))
    })
    const { unmount } = render(
      <MemoryRouter>
        <DashboardView events={[]} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(capturedSignals.length).toBe(2))
    expect(capturedSignals.every((s) => s.aborted === false)).toBe(true)
    unmount()
    expect(capturedSignals.every((s) => s.aborted === true)).toBe(true)
  })
```

NOTE: `fakePrivacyScore` is already defined at the top of the test file (lines 20-33). The test reuses the existing `MemoryRouter` + `<DashboardView events={[]} />` render shape.

- [ ] **Step 2: Run test — expect failure**

```bash
cd app
pnpm test --run src/views/__tests__/DashboardView.test.tsx
```

Expected: new test FAILS because the `/api/vault` + `/api/activity` fetches at lines 104-121 don't pass `signal`; `capturedSignals.length` stays 0; `waitFor` times out.

- [ ] **Step 3: Commit (red phase)**

```bash
cd ..
git add app/src/views/__tests__/DashboardView.test.tsx
git commit -m "test(app): add DashboardView abort-on-unmount test (red)"
```

---

### Task B6: Implement DashboardView fix (green)

**Files:**
- Modify: `app/src/views/DashboardView.tsx`

- [ ] **Step 1: Wrap the second useEffect with AbortController**

Replace the current block (DashboardView.tsx:104-121):

```tsx
  useEffect(() => {
    if (!token) return
    apiFetch<VaultData>('/api/vault', { token }).then(setVault).catch(() => {})
    apiFetch<{ activity: ActivityRecord[] }>('/api/activity', { token })
      .then((data) => {
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
      })
      .catch(() => {})
  }, [token])
```

with:

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

- [ ] **Step 2: Run DashboardView tests — expect all pass**

```bash
cd app
pnpm test --run src/views/__tests__/DashboardView.test.tsx
```

Expected: all tests pass (existing + 1 new).

- [ ] **Step 3: Run typecheck — expect clean**

```bash
pnpm exec tsc --noEmit
```

Expected: clean exit.

- [ ] **Step 4: Commit (green phase)**

```bash
cd ..
git add app/src/views/DashboardView.tsx
git commit -m "fix(app): add AbortController to DashboardView vault+activity fetches

Wraps the second useEffect (vault + activity) with an AbortController so
in-flight fetches are cancelled on unmount or auth-clear. The existing
privacy-score useEffect was already AbortController-aware (PR-D).

Part of #199"
```

---

### Task B7: Delete dead aborterRef in SettingsView

**Files:**
- Modify: `app/src/views/SettingsView.tsx`

- [ ] **Step 1: Update React imports**

In `app/src/views/SettingsView.tsx:1`, change:

```tsx
import { useEffect, useRef, useState } from 'react'
```

to:

```tsx
import { useEffect, useState } from 'react'
```

- [ ] **Step 2: Delete the aborterRef declaration**

Delete line 45 entirely:

```tsx
  const aborterRef = useRef<AbortController | null>(null)
```

- [ ] **Step 3: Delete the aborterRef assignment**

Delete line 54 entirely:

```tsx
    aborterRef.current = controller
```

- [ ] **Step 4: Run SettingsView tests — expect all 5 still pass**

```bash
cd app
pnpm test --run src/views/__tests__/SettingsView.test.tsx
```

Expected: all 5 existing tests pass (the local `controller` already drove signal-passing and cleanup; the ref was dead).

- [ ] **Step 5: Verify no other references to aborterRef**

```bash
grep -rn "aborterRef" app/src/ 2>/dev/null
```

Expected: no output (zero matches).

- [ ] **Step 6: Run typecheck — expect clean**

```bash
pnpm exec tsc --noEmit
```

Expected: clean exit (TS catches the unused `useRef` import if Step 1 was missed).

- [ ] **Step 7: Commit**

```bash
cd ..
git add app/src/views/SettingsView.tsx
git commit -m "chore(app): delete dead aborterRef in SettingsView

The local controller already drives signal-passing and cleanup; the ref
was assigned but never read. Drop the useRef import too — it becomes
unused after the ref deletion.

Part of #199"
```

---

### Task B8: Migrate inline auth fixtures to makeFakeAuthState (D4 cleanup)

**Files:**
- Modify: `app/src/views/__tests__/HeraldView.test.tsx`
- Modify: `app/src/views/__tests__/HeraldView-edit.test.tsx`
- Modify: `app/src/views/__tests__/SquadView.test.tsx`

- [ ] **Step 1: Migrate HeraldView.test.tsx — admin-gating describe**

Replace the 3 `as ReturnType<typeof useAuthState>` casts in `app/src/views/__tests__/HeraldView.test.tsx`:

Lines 41-46 (inside "redirects to dashboard when !isAdmin"):

```tsx
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: false,
    } as ReturnType<typeof useAuthState>)
```

→

```tsx
    vi.mocked(useAuthState).mockReturnValue(
      makeFakeAuthState({ status: 'authed', token: 't', publicKey: 'pk', isAdmin: false }),
    )
```

Lines 53-58 (inside "does NOT redirect when isAdmin"):

```tsx
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: true,
    } as ReturnType<typeof useAuthState>)
```

→

```tsx
    vi.mocked(useAuthState).mockReturnValue(
      makeFakeAuthState({ status: 'authed', token: 't', publicKey: 'pk', isAdmin: true }),
    )
```

Lines 69-74 (inside "HeraldView budget bar colors" beforeEach):

```tsx
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: true,
    } as ReturnType<typeof useAuthState>)
```

→

```tsx
    vi.mocked(useAuthState).mockReturnValue(
      makeFakeAuthState({ status: 'authed', token: 't', publicKey: 'pk', isAdmin: true }),
    )
```

NOTE: `makeFakeAuthState` is already imported at top of file from Task B1; no new import needed.

- [ ] **Step 2: Migrate HeraldView-edit.test.tsx — module-level vi.mock factory**

Replace the inline factory (lines 16-23) in `app/src/views/__tests__/HeraldView-edit.test.tsx`:

```tsx
vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: vi.fn(() => ({
    status: 'authed',
    token: 'test-token',
    publicKey: 'pk',
    isAdmin: true,
  })),
}))
```

with the async-factory + dynamic-import pattern (matches PR-C convention from frontier_46):

```tsx
vi.mock('../../hooks/useAuthState', async () => {
  const { makeFakeAuthState } = await import('../../test-utils/makeFakeAuthState')
  return {
    useAuthState: vi.fn(() =>
      makeFakeAuthState({ status: 'authed', token: 'test-token', publicKey: 'pk', isAdmin: true }),
    ),
  }
})
```

NOTE: vi.mock is hoisted; the async factory is required to import sibling test utilities safely.

- [ ] **Step 3: Migrate SquadView.test.tsx — 4 inline casts**

Replace the 4 `as ReturnType<typeof useAuthState>` casts in `app/src/views/__tests__/SquadView.test.tsx`:

Lines 38-43 (inside "redirects to dashboard when !isAdmin") — change `isAdmin: false`:

```tsx
    vi.mocked(useAuthState).mockReturnValue(
      makeFakeAuthState({ status: 'authed', token: 't', publicKey: 'pk', isAdmin: false }),
    )
```

Lines 50-55, 72-77, 98-103 — change `isAdmin: true`:

```tsx
    vi.mocked(useAuthState).mockReturnValue(
      makeFakeAuthState({ status: 'authed', token: 't', publicKey: 'pk', isAdmin: true }),
    )
```

Also update Task B3's inline cast (lines added there had `as ReturnType<typeof useAuthState>` for isolation):

```tsx
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: true,
    } as ReturnType<typeof useAuthState>)
```

→

```tsx
    vi.mocked(useAuthState).mockReturnValue(
      makeFakeAuthState({ status: 'authed', token: 't', publicKey: 'pk', isAdmin: true }),
    )
```

- [ ] **Step 4: Add `makeFakeAuthState` import to SquadView.test.tsx**

Add at top of `app/src/views/__tests__/SquadView.test.tsx` (alongside other imports):

```tsx
import { makeFakeAuthState } from '../../test-utils/makeFakeAuthState'
```

- [ ] **Step 5: Run all 3 affected test files — expect green**

```bash
cd app
pnpm test --run src/views/__tests__/HeraldView.test.tsx
pnpm test --run src/views/__tests__/HeraldView-edit.test.tsx
pnpm test --run src/views/__tests__/SquadView.test.tsx
```

Expected: all green (the factory returns the same shape; type-safety improves but behavior identical).

- [ ] **Step 6: Run full app suite + typecheck**

```bash
pnpm test --run src/ 2>&1 | tail -5
pnpm exec tsc --noEmit
```

Expected: ~460 passing across 74 files (456 baseline + 4 new tests from B1, B3, B5). Clean tsc.

- [ ] **Step 7: Commit**

```bash
cd ..
git add app/src/views/__tests__/HeraldView.test.tsx \
        app/src/views/__tests__/HeraldView-edit.test.tsx \
        app/src/views/__tests__/SquadView.test.tsx
git commit -m "test(app): migrate admin-view test fixtures to makeFakeAuthState

Replaces inline { ... } as ReturnType<typeof useAuthState> casts with
the type-safe makeFakeAuthState factory. Locks the AuthState contract
in the admin views modified by this PR. WithdrawView/DepositView
fixtures stay in Tier 4 polish."
```

---

### Task B9: Final verification + push

- [ ] **Step 1: Run full app suite + typecheck one more time**

```bash
cd app
pnpm test --run src/ 2>&1 | tail -5
pnpm exec tsc --noEmit
cd ..
```

Expected: ~460 passing across 74 files. Clean tsc. (Exact final count depends on whether subagent added any extra coverage.)

- [ ] **Step 2: Verify no `token!` in source**

```bash
grep -rn "token!" app/src/ 2>/dev/null
```

Expected: no output.

- [ ] **Step 3: Verify no `aborterRef` in source**

```bash
grep -rn "aborterRef" app/src/ 2>/dev/null
```

Expected: no output.

- [ ] **Step 4: Push the branch**

```bash
git push -u origin fix/admin-views-reliability
```

---

### Task B10: Open PR-B with two-stage subagent review

- [ ] **Step 1: Open the PR**

```bash
gh pr create --repo sip-protocol/sipher --base main --head fix/admin-views-reliability \
  --title "fix(app): harden admin views (token guard + AbortController)" \
  --body "$(cat <<'EOF'
## Summary

Hardens the three admin views (Herald, Squad, Settings) and Dashboard against two latent defect classes.

### #198 — `token!` non-null assertion

`HeraldView.handleApprove` and `handleEditSave` used `token: token!` after the user clicked Approve/Save. If the JWT cleared between render and click (very possible given the 5min refresh window + tab inactivity), the assertion would crash with `TypeError: Cannot read properties of null` instead of doing the expected re-auth flow.

**Fix:** silent early-return guard at the top of each handler (`if (!token) return`). Next render naturally shows the existing "Connect your wallet to view HERALD activity" empty state. The global 401 interceptor still catches mid-action token expirations from the network round-trip.

### #199 — Missing AbortController on async fetches

`HeraldView.load`, the `handleApprove`/`handleEditSave` re-loads, `SquadView.load`, and the second useEffect in `DashboardView` for `/api/vault` + `/api/activity` all called `apiFetch` without `signal:`. If the user navigated away (or `clearAuth` fired) mid-fetch, `setData`/`setHistory` ran on an unmounted component (test noise + the ghost-state symptom from #189). Plus `aborterRef` in `SettingsView.tsx:45,54` was assigned but never read — dead state.

**Fix:**
- Refactored `load` in HeraldView and SquadView to accept an optional `AbortSignal`. The useEffect creates a controller, passes the signal, and aborts on cleanup.
- HeraldView's action handlers added a `mountedRef` so the post-action `load()` is skipped after unmount.
- DashboardView's second useEffect now uses an AbortController matching the existing privacy-score useEffect pattern.
- SettingsView's dead `aborterRef` and unused `useRef` import deleted.

### Bundled (D4) — opportunistic Tier 4 cleanup

Migrated inline `{ ... } as ReturnType<typeof useAuthState>` test fixtures in `HeraldView.test.tsx`, `HeraldView-edit.test.tsx`, `SquadView.test.tsx` to the type-safe `makeFakeAuthState` factory. Locks the AuthState contract in admin-view tests and cuts one Tier 4 polish item.

## Test plan

- [x] `grep -rn "token!" app/src/` — zero matches
- [x] `grep -rn "aborterRef" app/src/` — zero matches
- [x] HeraldView abort-on-unmount + defensive token-guard tests green
- [x] SquadView abort-on-unmount test green
- [x] DashboardView abort-on-unmount test green (vault + activity)
- [x] SettingsView 5 existing tests still pass after dead-ref cleanup
- [x] `pnpm exec tsc --noEmit` clean
- [x] App tests: 456 → ~460+ (+4 minimum), 74 files, no regressions
- [x] CI green

Closes #198
Closes #199
EOF
)"
```

NOTE: ONE `Closes #X` per line — `gh` only auto-closes the FIRST match in a comma-separated list.

- [ ] **Step 2: Dispatch spec-compliance review subagent**

Spawn a fresh subagent to verify the PR diff against the spec:

```
Use Agent tool with subagent_type=general-purpose:

Title: "Spec-compliance review for PR fix/admin-views-reliability"

Prompt: "Review the diff of PR fix/admin-views-reliability (sip-protocol/sipher) against the spec at docs/superpowers/specs/2026-05-11-qa-sweep-tier-3-design.md.

Focus on:
1. Does the implementation match every locked decision (D1-D6)? List any deviations.
2. Are all #198 + #199 acceptance criteria satisfied? (token! removal, silent early-return, AbortController in 3 views, mountedRef in HeraldView, SettingsView dead-ref cleanup, D4 fixture migration in 3 test files)
3. Files-modified list matches the spec's PR-B Files table?
4. Tests added match the spec's TDD order?

Report any spec drift inline with file:line citations. Do not propose new features. Do not run tests yourself — assume CI green is the test gate. Read the spec first, then `gh pr diff <pr-number> --repo sip-protocol/sipher` to see the changes."
```

Wait for the agent's report. Apply any spec-drift fixes inline (not in a fresh worktree); commit + push to the same branch. Re-dispatch if changes were significant.

- [ ] **Step 3: Dispatch code-quality review subagent**

After spec-compliance review passes, spawn a second fresh subagent for code quality:

```
Use Agent tool with subagent_type=general-purpose:

Title: "Code-quality review for PR fix/admin-views-reliability"

Prompt: "Review the code quality of PR fix/admin-views-reliability (sip-protocol/sipher).

Focus on:
1. AbortController integration correctness — are signals properly checked before setState? Does AbortError get filtered from setError to avoid spurious error toasts?
2. mountedRef lifecycle — does the cleanup useEffect correctly capture .current = false? Is mountedRef referenced after the component is unmounted (closure timing)?
3. Type safety — are signal?: AbortSignal narrowings correct? Any remaining `as ReturnType` casts that could be makeFakeAuthState?
4. Test quality — are the abort-on-unmount tests deterministic (waitFor used correctly)? Could they be flaky in CI?
5. Subtle UX regressions — does silent early-return in handleApprove leave the QueueTab editor in a bad state? Does the cancelEdit() after a no-op early-return cause user confusion?
6. Dead code — does deleting useRef from SettingsView leave any residual?

Report Important / Should-fix / Nice-to-have findings with file:line citations. Read the source files (HeraldView, SquadView, DashboardView, SettingsView, all test files) and the spec at docs/superpowers/specs/2026-05-11-qa-sweep-tier-3-design.md. Use `gh pr diff <pr-number> --repo sip-protocol/sipher` to see only the changed lines. Do not run tests."
```

Wait for the agent's report. Apply Important + Should-fix items inline; commit + push. Nice-to-have items file as Tier 4 followups (`gh issue create --label qa-skill:1778399617 --label tech-debt`).

After fix commits, ALWAYS re-run the code-quality review (skipping is the most common Phase 4b mistake).

- [ ] **Step 4: Wait for CI green, then merge**

```bash
gh pr checks --repo sip-protocol/sipher --watch
```

Once green:

```bash
# Switch back to main BEFORE merging
cd ~/local-dev/sipher
git checkout main
gh pr merge <pr-number> --merge --delete-branch
```

- [ ] **Step 5: Sync main + remove worktree + verify issue closures**

```bash
git pull --ff-only
git worktree remove .worktrees/feat-admin-views-reliability
git branch -d fix/admin-views-reliability 2>/dev/null || true
gh issue view 198 --repo sip-protocol/sipher --json state | grep CLOSED
gh issue view 199 --repo sip-protocol/sipher --json state | grep CLOSED
# expect: both state CLOSED (auto-closed by PR merge via per-line Closes #X)
```

If either issue did NOT auto-close:

```bash
gh issue close 198 --repo sip-protocol/sipher --reason completed --comment "Closed by PR-B (fix/admin-views-reliability)"
gh issue close 199 --repo sip-protocol/sipher --reason completed --comment "Closed by PR-B (fix/admin-views-reliability)"
```

---

## Post-Tier-3 sprint update

- [ ] **Step 1: Update sprint memory**

Append a new section to `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/project_phase4b-redesign-sprint.md` titled "QA Sweep — Tier 3 (Admin Reliability) shipped (frontier_48 session)" mirroring the Tier 0+1 and Tier 2 sections. Include:
- 2 PRs merged with PR numbers + closed issues + test deltas
- Test trajectory (456 → ~460+)
- Architecture landed (useIsAdmin delegation + load(signal?) pattern + mountedRef + dead-ref cleanup)
- Code-review fixes applied in-PR (if any)
- Carry-forward findings (e.g., load(signal?) pattern reusable for non-admin views)
- Updated Tier 3-4 starting state (3 issues closed → 18 leaves + 4 followups remain for Tier 4)
- Total sprint progress (15/33 closed = 45%, 18 + 4 = 22 issues to close before Phase D)

- [ ] **Step 2: Verify Tier 4 starting state**

```bash
gh issue list --repo sip-protocol/sipher --label "qa-skill:1778399617" --state open --limit 50
```

Expected: 18 open issues + 4 followups (#225-#228) = 22 issues before Phase D launches.

---

## Self-review notes

This plan covers every spec-listed file change, every TDD test, every commit. No placeholders. Type signatures are consistent (e.g., `load(signal?: AbortSignal)` appears identically in HeraldView and SquadView). The `mountedRef` cleanup pattern is shown verbatim where used.

Verification commands have explicit expected output. Risks from the spec's risks-table are mitigated by the test patterns (signal capture, never-resolving mock for unmount race) and the verify-no-residual greps (`token!`, `aborterRef`).

Worktree cleanup (`git worktree remove` + `git branch -d`) is in every PR's final task.

Cross-PR dependency: PR-B's worktree is created AFTER PR-A merges to main (Task B0 Step 1 syncs `git pull --ff-only` first). PR-A is independent of PR-B; no test contract changes.
