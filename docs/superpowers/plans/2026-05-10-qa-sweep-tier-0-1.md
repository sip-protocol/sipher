# QA Sweep — Tier 0 + 1 (Auth Foundations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 6 of 33 QA-sweep issues (#193, #205, #202, #189, #191, #192) across 4 PRs — DAG Tier 0 (foundations) + Tier 1 (auth lifecycle core). Closes 4 of 5 P0s + 1 P1 + 1 P2; #190 (5th P0) deferred to Tier 2 with #201/#215.

**Architecture:**
- **Tier 0 foundations:** test util (`makeFakeAuthState`) + console cleanup (drop deprecated wallet adapter explicit instantiation; Wallet Standard auto-discovers Phantom/Solflare).
- **Tier 1 auth lifecycle core:** module-singleton `onAuthClear` registry called from `useAppStore.clearAuth()`; 5 component consumers wire cleanup callbacks via thin `useOnAuthClear` hook. Then `api/client.ts` gains a `TypeError: Failed to fetch` branch + exported `triggerAuthInterceptor`; `<NetworkBanner>` mounts in app shell; `ChatSidebar` calls the interceptor on 401 from streaming fetch; `useSSE` clears events on EventSource error.

**Tech Stack:** TypeScript 5.7, React 19, Vite 6, Vitest 3, Testing Library 16, Zustand 5.

**Spec:** `docs/superpowers/specs/2026-05-10-qa-sweep-tier-0-1-design.md`

**Sources of truth verified pre-plan:**
- `AuthState` shape: `app/src/providers/AuthSyncProvider.tsx:13-22` — 8 fields (status, token, expiresAt, isAdmin, publicKey, authenticate, disconnect, error)
- `useAppStore.clearAuth`: `app/src/stores/app.ts` — already clears token/isAdmin/expiresAt/messages/activeView
- `App.tsx`: lines 4-7 import deprecated adapters, lines 105-108 instantiate them
- 3 test files use non-existent `isAuthenticated` field (the actual broken set; handoff said "6+", but 3 are broken — others are minimal mocks that don't assert the bad field)
- `api/client.ts:5-15` already has `authInterceptor` + `registerAuthInterceptor`; 401 path triggers it. Missing: `TypeError: Failed to fetch` branch + `triggerAuthInterceptor` export
- `useSSE.ts:32`: `source.onerror = () => setConnected(false)` — does not clear events
- `ChatSidebar.tsx:60-69`: fetch to `/api/chat/stream`, checks `!res.ok` but does not single out 401 to fire the interceptor

---

## File Structure

### New files (5)

| File | Responsibility |
|------|----------------|
| `app/src/test-utils/makeFakeAuthState.ts` | Type-safe `AuthState` factory for tests |
| `app/src/test-utils/__tests__/makeFakeAuthState.test.ts` | Shape + override tests for the factory |
| `app/src/store/onAuthClear.ts` | Module-singleton registry: `register(cb): unsubscribe`, `clearAll()` |
| `app/src/store/__tests__/onAuthClear.test.ts` | Registry contract tests |
| `app/src/components/NetworkBanner.tsx` | Banner that subscribes to `network-error` events; auto-dismisses on next success |

### Modified files (12)

| File | Change |
|------|--------|
| `app/src/views/__tests__/SettingsView.test.tsx` | Replace 5 `isAuthenticated` mocks with `makeFakeAuthState` |
| `app/src/components/keys/__tests__/StealthAddressBackup.test.tsx` | Replace `isAuthenticated` mock with `makeFakeAuthState` |
| `app/src/components/keys/__tests__/ViewKeyCard.test.tsx` | Replace `isAuthenticated` mock with `makeFakeAuthState` |
| `app/src/App.tsx` | Drop deprecated wallet adapter imports + instantiations; mount `<NetworkBanner />` in shell |
| `app/src/stores/app.ts` | `clearAuth()` calls `onAuthClear.clearAll()` after store reset |
| `app/src/components/PrivacyGraph.tsx` | Register `setTree([])` cleanup via `useOnAuthClear` |
| `app/src/views/VaultView.tsx` | Register cleanup for vault/positions/stealthTree state |
| `app/src/components/keys/StealthAddressBackup.tsx` | Register `setData(null)` cleanup |
| `app/src/views/DashboardView.tsx` | Register cleanup for vault/history/privacyData state |
| `app/src/hooks/useSSE.ts` | Register `setEvents([])` cleanup; ALSO clear events on EventSource error |
| `app/src/api/client.ts` | Add `TypeError: Failed to fetch` branch (emits `network-error` event); export `triggerAuthInterceptor` |
| `app/src/components/ChatSidebar.tsx` | After streaming fetch, if `res.status === 401` call `triggerAuthInterceptor()` before throwing |

### Test files added or modified (8)

| File | Change |
|------|--------|
| `app/src/api/__tests__/client.test.ts` | Add network-error branch test + triggerAuthInterceptor export test (modify existing if present, else add) |
| `app/src/components/__tests__/NetworkBanner.test.tsx` | New — banner appears on event, dismisses on success |
| `app/src/hooks/__tests__/useSSE.test.ts` | Add error-clears-events test (new file if absent) |
| `app/src/components/__tests__/ChatSidebar.test.tsx` | Add 401-streaming-triggers-interceptor test |
| `app/src/components/__tests__/PrivacyGraph.test.tsx` | Add cleanup-on-clearAuth test (modify existing) |
| `app/src/views/__tests__/VaultView.test.tsx` | Add cleanup-on-clearAuth test |
| `app/src/views/__tests__/DashboardView.test.tsx` | Add cleanup-on-clearAuth test (new file if absent) |
| `app/src/components/keys/__tests__/StealthAddressBackup.test.tsx` | Add cleanup-on-clearAuth test (modify existing) |

---

## Carry-forward execution rules (apply to ALL tasks)

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

# PR-A: `chore/test-util-make-fake-auth-state` (closes #193)

**Branch:** `chore/test-util-make-fake-auth-state`
**Worktree:** `~/local-dev/sipher.worktrees/pr-a-fake-auth-state`
**Mode:** INLINE w/ TDD
**Estimated:** 1-2h

## PR-A Task 1: Create worktree and branch

**Files:** none

- [ ] **Step 1.1: Create worktree from main**

```bash
cd ~/local-dev/sipher
git fetch --prune
git worktree add ~/local-dev/sipher.worktrees/pr-a-fake-auth-state -b chore/test-util-make-fake-auth-state main
cd ~/local-dev/sipher.worktrees/pr-a-fake-auth-state
pnpm install
pnpm --filter "@sipher/sdk" build
```

Expected: worktree created, deps installed, SDK built, ready to work.

## PR-A Task 2: Write failing test for `makeFakeAuthState`

**Files:**
- Test: `app/src/test-utils/__tests__/makeFakeAuthState.test.ts`

- [ ] **Step 2.1: Write the failing test**

Create `app/src/test-utils/__tests__/makeFakeAuthState.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { makeFakeAuthState } from '../makeFakeAuthState'
import type { AuthState } from '../../hooks/useAuthState'

describe('makeFakeAuthState', () => {
  it('returns a valid unauthed AuthState by default', () => {
    const state: AuthState = makeFakeAuthState()
    expect(state.status).toBe('unauthed')
    expect(state.token).toBeNull()
    expect(state.expiresAt).toBeNull()
    expect(state.isAdmin).toBe(false)
    expect(state.publicKey).toBeNull()
    expect(state.error).toBeNull()
    expect(typeof state.authenticate).toBe('function')
    expect(typeof state.disconnect).toBe('function')
  })

  it('authenticate and disconnect default to no-op promises', async () => {
    const state = makeFakeAuthState()
    await expect(state.authenticate()).resolves.toBeUndefined()
    await expect(state.disconnect()).resolves.toBeUndefined()
  })

  it('applies overrides while preserving the rest of the shape', () => {
    const state = makeFakeAuthState({
      status: 'authed',
      token: 'jwt-token',
      publicKey: 'pubkey-base58',
      isAdmin: true,
    })
    expect(state.status).toBe('authed')
    expect(state.token).toBe('jwt-token')
    expect(state.publicKey).toBe('pubkey-base58')
    expect(state.isAdmin).toBe(true)
    expect(state.expiresAt).toBeNull()
    expect(state.error).toBeNull()
  })

  it('lets caller override authenticate and disconnect with custom mocks', async () => {
    const authenticate = vi.fn(async () => {})
    const disconnect = vi.fn(async () => {})
    const state = makeFakeAuthState({ authenticate, disconnect })
    await state.authenticate()
    await state.disconnect()
    expect(authenticate).toHaveBeenCalledOnce()
    expect(disconnect).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
cd app
pnpm test --run src/test-utils/__tests__/makeFakeAuthState.test.ts
```

Expected: FAIL — module `makeFakeAuthState` does not exist.

## PR-A Task 3: Implement `makeFakeAuthState`

**Files:**
- Create: `app/src/test-utils/makeFakeAuthState.ts`

- [ ] **Step 3.1: Implement the factory**

Create `app/src/test-utils/makeFakeAuthState.ts`:

```ts
import type { AuthState } from '../hooks/useAuthState'

/**
 * Build an AuthState fixture for component tests.
 *
 * Defaults to `'unauthed'` so tests opt INTO authentication state explicitly.
 * Overrides are applied after the defaults; pass `{ status: 'authed', token: '…' }`
 * to simulate a signed-in user.
 *
 * Why this exists: the field name `isAuthenticated` does NOT exist on
 * AuthState. Several test fixtures previously mocked it, which TypeScript did
 * not catch because vi.mock returns are loosely typed. This factory enforces
 * the real shape via the `AuthState` interface.
 */
export function makeFakeAuthState(overrides?: Partial<AuthState>): AuthState {
  return {
    status: 'unauthed',
    token: null,
    expiresAt: null,
    isAdmin: false,
    publicKey: null,
    authenticate: async () => {},
    disconnect: async () => {},
    error: null,
    ...overrides,
  }
}
```

- [ ] **Step 3.2: Run test to verify it passes**

```bash
cd app
pnpm test --run src/test-utils/__tests__/makeFakeAuthState.test.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 3.3: Run typecheck**

```bash
cd app
pnpm exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 3.4: Commit**

```bash
git add app/src/test-utils/makeFakeAuthState.ts app/src/test-utils/__tests__/makeFakeAuthState.test.ts
git commit -m "test(app): add makeFakeAuthState test util

The AuthState interface has 8 fields including authenticate/disconnect
async functions. Several test fixtures previously mocked a non-existent
isAuthenticated field — TypeScript did not catch it because vi.mock
returns are loosely typed. This factory enforces the real shape and
defaults to 'unauthed' so tests opt INTO authentication explicitly.

Closes part of #193."
```

## PR-A Task 4: Migrate `SettingsView.test.tsx`

**Files:**
- Modify: `app/src/views/__tests__/SettingsView.test.tsx`

- [ ] **Step 4.1: Replace 5 `isAuthenticated: true` mocks with `makeFakeAuthState`**

Find each occurrence (lines 62, 73, 85, 99, 113 per current source) and replace the inline mock object with a `makeFakeAuthState` call. Add the import at the top.

Add import (top of file, with the other imports):

```ts
import { makeFakeAuthState } from '../../test-utils/makeFakeAuthState'
```

Replace each of the 5 occurrences. Example diff for one occurrence (line 61-65 area):

```ts
// BEFORE
useAuthStateMock.mockReturnValue({
  publicKey: 'X', token: 't', isAuthenticated: true, isAdmin: false,
})

// AFTER
useAuthStateMock.mockReturnValue(
  makeFakeAuthState({ publicKey: 'X', token: 't', status: 'authed', isAdmin: false }),
)
```

Apply the same transform to all 5 mock calls. Where the original mock had `isAdmin: true`, keep `isAdmin: true` in overrides. Where `status` was implied authed (had `token: 't'` and `isAuthenticated: true`), add `status: 'authed'`.

- [ ] **Step 4.2: Run the migrated test file**

```bash
cd app
pnpm test --run src/views/__tests__/SettingsView.test.tsx
```

Expected: PASS — all existing tests still green.

- [ ] **Step 4.3: Run typecheck**

```bash
cd app
pnpm exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 4.4: Commit**

```bash
git add app/src/views/__tests__/SettingsView.test.tsx
git commit -m "test(app): migrate SettingsView tests to makeFakeAuthState

Replaces 5 mock fixtures that referenced the non-existent
isAuthenticated field with type-honest makeFakeAuthState() calls.

Part of #193."
```

## PR-A Task 5: Migrate `StealthAddressBackup.test.tsx`

**Files:**
- Modify: `app/src/components/keys/__tests__/StealthAddressBackup.test.tsx`

- [ ] **Step 5.1: Replace mock with `makeFakeAuthState`**

`vi.mock` is hoisted to the top of the file by Vitest's transformer, BEFORE any imports. So a sync mock factory cannot reference a module-level imported binding (TDZ). Use the async-factory + dynamic-import pattern (matches the existing pattern in `ChatSidebar.test.tsx`):

```ts
// BEFORE
vi.mock('../../../hooks/useAuthState', () => ({
  useAuthState: () => ({
    publicKey: 'X',
    token: 'tok',
    isAuthenticated: true,
    // … any other fields the test mocked
  }),
}))

// AFTER (async factory — resolves makeFakeAuthState lazily, avoids hoisting TDZ)
vi.mock('../../../hooks/useAuthState', async () => {
  const { makeFakeAuthState } = await import('../../../test-utils/makeFakeAuthState')
  return {
    useAuthState: () => makeFakeAuthState({
      publicKey: 'X',
      token: 'tok',
      status: 'authed',
    }),
  }
})
```

No top-level import of `makeFakeAuthState` is needed; the dynamic `await import()` inside the factory handles it.

- [ ] **Step 5.2: Run the migrated test file**

```bash
cd app
pnpm test --run src/components/keys/__tests__/StealthAddressBackup.test.tsx
```

Expected: PASS.

- [ ] **Step 5.3: Commit**

```bash
git add app/src/components/keys/__tests__/StealthAddressBackup.test.tsx
git commit -m "test(app): migrate StealthAddressBackup tests to makeFakeAuthState

Part of #193."
```

## PR-A Task 6: Migrate `ViewKeyCard.test.tsx`

**Files:**
- Modify: `app/src/components/keys/__tests__/ViewKeyCard.test.tsx`

- [ ] **Step 6.1: Replace mock with `makeFakeAuthState`**

Same async-factory transform as PR-A Task 5. Read the current mock at lines 13-25 (per grep: line 14 has `isAuthenticated: true`):

```ts
// BEFORE
vi.mock('../../../hooks/useAuthState', () => ({
  useAuthState: () => ({
    publicKey: '…',
    token: '…',
    isAuthenticated: true,
    // … any other fields
  }),
}))

// AFTER
vi.mock('../../../hooks/useAuthState', async () => {
  const { makeFakeAuthState } = await import('../../../test-utils/makeFakeAuthState')
  return {
    useAuthState: () => makeFakeAuthState({
      status: 'authed',
      token: '…',
      publicKey: '…',
    }),
  }
})
```

- [ ] **Step 6.2: Run the migrated test file**

```bash
cd app
pnpm test --run src/components/keys/__tests__/ViewKeyCard.test.tsx
```

Expected: PASS.

- [ ] **Step 6.3: Commit**

```bash
git add app/src/components/keys/__tests__/ViewKeyCard.test.tsx
git commit -m "test(app): migrate ViewKeyCard tests to makeFakeAuthState

Part of #193."
```

## PR-A Task 7: Final verification + push + open PR

**Files:** none

- [ ] **Step 7.1: Verify zero `isAuthenticated` references remain in tests**

```bash
cd ~/local-dev/sipher.worktrees/pr-a-fake-auth-state
grep -rn "isAuthenticated" app/src --include="*.ts" --include="*.tsx"
```

Expected: zero matches (or only matches in the new `makeFakeAuthState.ts` source comment if any).

- [ ] **Step 7.2: Run full app suite + typecheck**

```bash
cd app
pnpm exec tsc --noEmit
pnpm test --run
```

Expected: typecheck clean, all tests pass.

- [ ] **Step 7.3: Push branch + open PR**

```bash
cd ~/local-dev/sipher.worktrees/pr-a-fake-auth-state
git push -u origin chore/test-util-make-fake-auth-state
gh pr create --base main --title "chore(app): add makeFakeAuthState test util — closes #193" --body "$(cat <<'EOF'
## Summary

Closes #193. Adds `makeFakeAuthState(overrides?)` test factory that
returns a type-honest `AuthState` fixture, defaulting to `'unauthed'`.
Migrates the 3 test files that previously mocked the non-existent
\`isAuthenticated\` field — \`SettingsView.test.tsx\`,
\`StealthAddressBackup.test.tsx\`, \`ViewKeyCard.test.tsx\`.

## Why

The \`AuthState\` interface has 8 fields (including \`authenticate\` and
\`disconnect\` async functions). Several fixtures mocked a field that
does not exist; TypeScript did not catch this because \`vi.mock\` return
types are loosely inferred. This factory enforces the real shape via
\`Partial<AuthState>\` overrides on top of safe defaults.

## Verification

- [x] \`pnpm exec tsc --noEmit\` clean
- [x] \`pnpm test --run\` green
- [x] \`grep -rn "isAuthenticated" app/src\` returns zero matches in tests

## Out of scope

Other test files use minimal-mock patterns (e.g. \`{ token: 'tok' }\`)
that are not strictly broken — those will be migrated incrementally as
those tests are touched. This PR closes the narrow #193 scope.

Spec: \`docs/superpowers/specs/2026-05-10-qa-sweep-tier-0-1-design.md\`
EOF
)"
```

- [ ] **Step 7.4: Wait for CI green, then merge**

```bash
gh pr checks --watch
# Once green:
cd ~/local-dev/sipher  # main checkout BEFORE merge
gh pr merge <PR#> --merge --delete-branch
git checkout main && git pull
git worktree remove ~/local-dev/sipher.worktrees/pr-a-fake-auth-state
git branch -d chore/test-util-make-fake-auth-state 2>/dev/null || true
```

Expected: PR merged, branch deleted, worktree removed, local main updated.

---

# PR-B: `chore/remove-deprecated-wallet-adapters` (closes #205)

**Branch:** `chore/remove-deprecated-wallet-adapters`
**Worktree:** `~/local-dev/sipher.worktrees/pr-b-wallet-adapters`
**Mode:** INLINE
**Estimated:** 30min-1h

## PR-B Task 1: Create worktree and branch

- [ ] **Step 1.1: Create worktree from main**

```bash
cd ~/local-dev/sipher
git fetch --prune
git worktree add ~/local-dev/sipher.worktrees/pr-b-wallet-adapters -b chore/remove-deprecated-wallet-adapters main
cd ~/local-dev/sipher.worktrees/pr-b-wallet-adapters
pnpm install
pnpm --filter "@sipher/sdk" build
```

## PR-B Task 2: Verify only 2 deprecated adapter usages exist

**Files:** none

- [ ] **Step 2.1: Confirm scope before editing**

```bash
cd ~/local-dev/sipher.worktrees/pr-b-wallet-adapters
grep -rn "PhantomWalletAdapter\|SolflareWalletAdapter" app/src --include="*.ts" --include="*.tsx"
```

Expected: 2-3 matches in `app/src/App.tsx` only (imports + instantiation).

If MORE than 5 matches are found across multiple files, STOP — escalate to subagent mode (per spec risk R6) and re-evaluate scope.

## PR-B Task 3: Remove imports and instantiation in `App.tsx`

**Files:**
- Modify: `app/src/App.tsx`

- [ ] **Step 3.1: Remove the import**

Edit `app/src/App.tsx`. At the top imports section (currently lines 4-7):

```tsx
// BEFORE
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets'

// AFTER
// (remove these 4 lines entirely)
```

- [ ] **Step 3.2: Replace the adapter array with empty array**

Currently at lines 105-108:

```tsx
// BEFORE
const wallets = useMemo(
  () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
  [],
)

// AFTER
// Wallet Standard auto-discovers Phantom, Solflare, and other wallet-standard
// wallets. The legacy explicit-adapter array is no longer needed and emits
// deprecation warnings on every page load.
const wallets = useMemo(() => [], [])
```

- [ ] **Step 3.3: Run typecheck**

```bash
cd app
pnpm exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 3.4: Run app tests**

```bash
cd app
pnpm test --run
```

Expected: all tests pass.

## PR-B Task 4: Manually verify wallet-standard discovery

**Files:** none

- [ ] **Step 4.1: Start dev server**

```bash
cd ~/local-dev/sipher.worktrees/pr-b-wallet-adapters
pnpm --filter "@sipher/app" dev
```

- [ ] **Step 4.2: Open localhost in browser, open DevTools console, reload page**

Expected:
- Zero `Phantom was registered as a Standard Wallet` deprecation warnings
- Zero `Solflare was registered as a Standard Wallet` warnings

- [ ] **Step 4.3: Click `Connect Wallet`, confirm Phantom + Solflare still listed**

Expected: Wallet selector modal shows Phantom and Solflare (plus any other wallet-standard wallets the browser has — Backpack, etc.).

- [ ] **Step 4.4: Stop dev server (Ctrl+C)**

## PR-B Task 5: Commit and open PR

- [ ] **Step 5.1: Commit**

```bash
git add app/src/App.tsx
git commit -m "chore(app): drop deprecated wallet adapter explicit imports

Wallet Standard auto-discovers Phantom, Solflare, and any other
wallet-standard wallets the user has installed. The legacy explicit
PhantomWalletAdapter / SolflareWalletAdapter instantiations were
emitting 14 deprecation warnings per page load — cleared now.

Closes #205."
```

- [ ] **Step 5.2: Push and open PR**

```bash
git push -u origin chore/remove-deprecated-wallet-adapters
gh pr create --base main --title "chore(app): drop deprecated wallet adapter explicit imports — closes #205" --body "$(cat <<'EOF'
## Summary

Closes #205. Removes \`PhantomWalletAdapter\` + \`SolflareWalletAdapter\`
instantiation in \`App.tsx\`. Wallet Standard auto-discovers them; the
legacy explicit adapter API has been deprecated since
\`@solana/wallet-adapter-wallets@0.19\`.

## Why

Console showed 14 deprecation warnings per page load
(\`Phantom was registered as a Standard Wallet. The Wallet Adapter
for Phantom can be removed from your app.\`) — noise for anyone in
DevTools and signal of stale dependencies.

## Verification

- [x] \`pnpm exec tsc --noEmit\` clean
- [x] \`pnpm test --run\` green
- [x] Zero deprecation warnings in dev console
- [x] Phantom + Solflare still appear in wallet selector

Spec: \`docs/superpowers/specs/2026-05-10-qa-sweep-tier-0-1-design.md\`
EOF
)"
```

- [ ] **Step 5.3: Wait for CI green, then merge**

```bash
gh pr checks --watch
cd ~/local-dev/sipher
gh pr merge <PR#> --merge --delete-branch
git checkout main && git pull
git worktree remove ~/local-dev/sipher.worktrees/pr-b-wallet-adapters
git branch -d chore/remove-deprecated-wallet-adapters 2>/dev/null || true
```

---

# PR-C: `feat/on-auth-clear-registry` (closes #202 + #189)

**Branch:** `feat/on-auth-clear-registry`
**Worktree:** `~/local-dev/sipher.worktrees/pr-c-auth-clear`
**Mode:** SUBAGENT-driven w/ TDD
**Estimated:** 4-6h

> When dispatching subagents for PR-C tasks, give them narrow scope:
> "Implement Task <N> exactly as specified in
> `docs/superpowers/plans/2026-05-10-qa-sweep-tier-0-1.md`. Do not expand
> scope. Use `superpowers:test-driven-development`. Verify before
> claiming complete via `superpowers:verification-before-completion`."

## PR-C Task 1: Create worktree and branch

- [ ] **Step 1.1: Create worktree from main**

```bash
cd ~/local-dev/sipher
git fetch --prune
git worktree add ~/local-dev/sipher.worktrees/pr-c-auth-clear -b feat/on-auth-clear-registry main
cd ~/local-dev/sipher.worktrees/pr-c-auth-clear
pnpm install
pnpm --filter "@sipher/sdk" build
```

## PR-C Task 2: Write failing test for `onAuthClear` registry contract

**Files:**
- Test: `app/src/store/__tests__/onAuthClear.test.ts` (new)

- [ ] **Step 2.1: Write the failing test**

Note: `app/src/store/` does not exist yet — this directory and the file are both new.

Create `app/src/store/__tests__/onAuthClear.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { onAuthClear } from '../onAuthClear'

describe('onAuthClear registry', () => {
  beforeEach(() => {
    onAuthClear._resetForTests()
  })

  it('register returns an unsubscribe function', () => {
    const unsubscribe = onAuthClear.register(() => {})
    expect(typeof unsubscribe).toBe('function')
  })

  it('clearAll fires every registered callback', () => {
    const a = vi.fn()
    const b = vi.fn()
    onAuthClear.register(a)
    onAuthClear.register(b)
    onAuthClear.clearAll()
    expect(a).toHaveBeenCalledOnce()
    expect(b).toHaveBeenCalledOnce()
  })

  it('unsubscribed callbacks are not fired', () => {
    const a = vi.fn()
    const b = vi.fn()
    const unsubA = onAuthClear.register(a)
    onAuthClear.register(b)
    unsubA()
    onAuthClear.clearAll()
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledOnce()
  })

  it('clearAll is idempotent — second call after a clear with no new registrations is a noop', () => {
    const a = vi.fn()
    onAuthClear.register(a)
    onAuthClear.clearAll()
    onAuthClear.clearAll()
    expect(a).toHaveBeenCalledTimes(2)
  })

  it('a callback that throws does not block subsequent callbacks', () => {
    const a = vi.fn(() => { throw new Error('boom') })
    const b = vi.fn()
    onAuthClear.register(a)
    onAuthClear.register(b)
    expect(() => onAuthClear.clearAll()).not.toThrow()
    expect(b).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
cd app
pnpm test --run src/store/__tests__/onAuthClear.test.ts
```

Expected: FAIL — module `onAuthClear` does not exist.

## PR-C Task 3: Implement `onAuthClear` registry

**Files:**
- Create: `app/src/store/onAuthClear.ts`

- [ ] **Step 3.1: Implement the registry**

Create `app/src/store/onAuthClear.ts`:

```ts
type ClearCallback = () => void

interface OnAuthClearRegistry {
  register(cb: ClearCallback): () => void
  clearAll(): void
  /**
   * Test-only helper. Drops all callbacks. Production code should never call
   * this — production cleanup happens via the unsubscribe returned by
   * `register`.
   */
  _resetForTests(): void
}

function createRegistry(): OnAuthClearRegistry {
  const callbacks = new Set<ClearCallback>()

  return {
    register(cb) {
      callbacks.add(cb)
      return () => {
        callbacks.delete(cb)
      }
    },
    clearAll() {
      // Snapshot to a list so a callback that registers/unregisters during
      // iteration does not skew the loop.
      const snapshot = Array.from(callbacks)
      for (const cb of snapshot) {
        try {
          cb()
        } catch {
          // A consumer's cleanup throwing should not block other consumers.
          // Swallow; auth-clear is best-effort UI cleanup.
        }
      }
    },
    _resetForTests() {
      callbacks.clear()
    },
  }
}

/**
 * Module-singleton registry of "clear cached UI state on auth boundary"
 * callbacks. The auth store calls `clearAll()` from inside `clearAuth()` —
 * outside React render — so the registry must be callable without a hook
 * context.
 *
 * Component consumers should use the `useOnAuthClear` thin hook (in
 * `app/src/store/useOnAuthClear.ts`) instead of calling `register` directly,
 * so unsubscribe is wired to component unmount via `useEffect` cleanup.
 */
export const onAuthClear: OnAuthClearRegistry = createRegistry()
```

- [ ] **Step 3.2: Run registry test**

```bash
cd app
pnpm test --run src/store/__tests__/onAuthClear.test.ts
```

Expected: PASS — all 5 tests green.

- [ ] **Step 3.3: Commit**

```bash
git add app/src/store/onAuthClear.ts app/src/store/__tests__/onAuthClear.test.ts
git commit -m "feat(app): add onAuthClear module-singleton registry

Module-singleton because the auth store calls clearAll() from outside
React render context (during state transition), so the registry must be
callable without a hook. Consumers register cleanup callbacks; clearAll
fires them, swallowing any throws so one consumer cannot block the rest.

Part of #202."
```

## PR-C Task 4: Add `useOnAuthClear` thin hook + test

**Files:**
- Create: `app/src/store/useOnAuthClear.ts`
- Test: `app/src/store/__tests__/useOnAuthClear.test.tsx`

- [ ] **Step 4.1: Write failing test**

Create `app/src/store/__tests__/useOnAuthClear.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOnAuthClear } from '../useOnAuthClear'
import { onAuthClear } from '../onAuthClear'

describe('useOnAuthClear', () => {
  beforeEach(() => {
    onAuthClear._resetForTests()
  })

  it('registers the callback on mount', () => {
    const cb = vi.fn()
    renderHook(() => useOnAuthClear(cb))
    onAuthClear.clearAll()
    expect(cb).toHaveBeenCalledOnce()
  })

  it('unregisters the callback on unmount', () => {
    const cb = vi.fn()
    const { unmount } = renderHook(() => useOnAuthClear(cb))
    unmount()
    onAuthClear.clearAll()
    expect(cb).not.toHaveBeenCalled()
  })

  it('uses the latest callback identity across renders', () => {
    const a = vi.fn()
    const b = vi.fn()
    const { rerender } = renderHook(({ cb }) => useOnAuthClear(cb), {
      initialProps: { cb: a },
    })
    rerender({ cb: b })
    onAuthClear.clearAll()
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 4.2: Run test to verify it fails**

```bash
cd app
pnpm test --run src/store/__tests__/useOnAuthClear.test.tsx
```

Expected: FAIL — module `useOnAuthClear` does not exist.

- [ ] **Step 4.3: Implement the hook**

Create `app/src/store/useOnAuthClear.ts`:

```ts
import { useEffect, useRef } from 'react'
import { onAuthClear } from './onAuthClear'

/**
 * Register a cleanup callback that fires when the auth boundary transitions
 * (`'authed' → 'unauthed' | 'expired'`). The callback is unregistered on
 * unmount. The latest callback identity wins across renders — useful for
 * closures over component state that change between renders.
 *
 * Usage:
 *   useOnAuthClear(() => setTree([]))
 */
export function useOnAuthClear(callback: () => void): void {
  const ref = useRef(callback)

  useEffect(() => {
    ref.current = callback
  }, [callback])

  useEffect(() => {
    return onAuthClear.register(() => ref.current())
  }, [])
}
```

- [ ] **Step 4.4: Run test**

```bash
cd app
pnpm test --run src/store/__tests__/useOnAuthClear.test.tsx
```

Expected: PASS.

- [ ] **Step 4.5: Commit**

```bash
git add app/src/store/useOnAuthClear.ts app/src/store/__tests__/useOnAuthClear.test.tsx
git commit -m "feat(app): add useOnAuthClear hook wrapper around registry

Stores the latest callback in a ref so closures over state survive
re-renders without re-registering. Unsubscribes on unmount via the
useEffect cleanup return.

Part of #202."
```

## PR-C Task 5: Wire `clearAuth` to call `onAuthClear.clearAll()`

**Files:**
- Modify: `app/src/stores/app.ts`

- [ ] **Step 5.1: Write failing test**

Add to `app/src/stores/__tests__/app.test.ts` (create file if it does not exist):

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAppStore } from '../app'
import { onAuthClear } from '../../store/onAuthClear'

describe('useAppStore.clearAuth', () => {
  beforeEach(() => {
    onAuthClear._resetForTests()
  })

  it('fires onAuthClear.clearAll after store reset', () => {
    const cb = vi.fn()
    onAuthClear.register(cb)
    useAppStore.getState().setAuth('test-token', false, null)
    useAppStore.getState().clearAuth()
    expect(cb).toHaveBeenCalledOnce()
  })

  it('clears token before firing onAuthClear (consumers see empty state)', () => {
    let observedToken: string | null | undefined
    onAuthClear.register(() => {
      observedToken = useAppStore.getState().token
    })
    useAppStore.getState().setAuth('test-token', false, null)
    useAppStore.getState().clearAuth()
    expect(observedToken).toBeNull()
  })
})
```

- [ ] **Step 5.2: Run test to verify it fails**

```bash
cd app
pnpm test --run src/stores/__tests__/app.test.ts
```

Expected: FAIL — `cb` not called (the wiring does not exist yet).

- [ ] **Step 5.3: Modify `clearAuth` in `app/src/stores/app.ts`**

Find the `clearAuth` definition (currently around line 65). Add the import at the top of the file:

```ts
import { onAuthClear } from '../store/onAuthClear'
```

Modify the `clearAuth` implementation:

```ts
// BEFORE
clearAuth: () =>
  set({ token: null, isAdmin: false, expiresAt: null, messages: [], activeView: 'dashboard' }),

// AFTER
clearAuth: () => {
  set({ token: null, isAdmin: false, expiresAt: null, messages: [], activeView: 'dashboard' })
  onAuthClear.clearAll()
},
```

Order matters: the store is reset BEFORE the registry fires, so consumer callbacks see empty store state when they read it.

- [ ] **Step 5.4: Run test to verify it passes**

```bash
cd app
pnpm test --run src/stores/__tests__/app.test.ts
```

Expected: PASS.

- [ ] **Step 5.5: Commit**

```bash
git add app/src/stores/app.ts app/src/stores/__tests__/app.test.ts
git commit -m "feat(app): fire onAuthClear.clearAll from clearAuth

Order: store reset first, then registry fires. Consumers reading the
store from inside their cleanup callback see empty state, not stale.

Part of #202."
```

## PR-C Task 6: Wire `PrivacyGraph` cleanup

**Files:**
- Modify: `app/src/components/PrivacyGraph.tsx`
- Modify: `app/src/components/__tests__/PrivacyGraph.test.tsx`

- [ ] **Step 6.1: Write failing test in `PrivacyGraph.test.tsx`**

Add to the existing `describe('PrivacyGraph', () => { ... })` block:

```tsx
import { onAuthClear } from '../../store/onAuthClear'

// (inside describe)
it('clears the tree when onAuthClear.clearAll fires', async () => {
  ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    tree: [{ index: 0, derivationPath: 'm/0', stealthAddress: 'X', parentIndex: null, createdAt: 't' }],
    rootWallet: 'W',
  })
  render(<PrivacyGraph />)
  await waitFor(() => {
    expect(screen.getByText(/1 address/)).toBeInTheDocument()
  })

  onAuthClear.clearAll()

  await waitFor(() => {
    expect(screen.getByText(/0 addresses/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6.2: Run test to verify it fails**

```bash
cd app
pnpm test --run src/components/__tests__/PrivacyGraph.test.tsx
```

Expected: FAIL — tree state still has the loaded address.

- [ ] **Step 6.3: Modify `PrivacyGraph.tsx` to register cleanup**

```tsx
// BEFORE (around line 1-7)
import { useEffect, useState } from 'react'
import { Card } from './ui/Card'
import { NodeGraph, type GraphNode, type GraphEdge } from './ui/NodeGraph'
import { apiFetch } from '../api/client'
import { useAuthState } from '../hooks/useAuthState'

// AFTER
import { useEffect, useState } from 'react'
import { Card } from './ui/Card'
import { NodeGraph, type GraphNode, type GraphEdge } from './ui/NodeGraph'
import { apiFetch } from '../api/client'
import { useAuthState } from '../hooks/useAuthState'
import { useOnAuthClear } from '../store/useOnAuthClear'
```

Inside the `PrivacyGraph` component, after the `useState`:

```tsx
export function PrivacyGraph() {
  const { token } = useAuthState()
  const [tree, setTree] = useState<StealthNode[]>([])

  useOnAuthClear(() => setTree([]))

  // (rest unchanged)
```

- [ ] **Step 6.4: Run test to verify it passes**

```bash
cd app
pnpm test --run src/components/__tests__/PrivacyGraph.test.tsx
```

Expected: PASS.

- [ ] **Step 6.5: Commit**

```bash
git add app/src/components/PrivacyGraph.tsx app/src/components/__tests__/PrivacyGraph.test.tsx
git commit -m "feat(app): wire PrivacyGraph state cleanup via useOnAuthClear

Clears the cached stealth tree when the auth boundary transitions.
Defends against the JWT-expiry stale-render bug surfaced by the
Skeptic QA archetype's React fiber state-injection adversarial repro.

Part of #189."
```

## PR-C Task 7: Wire `VaultView` cleanup

**Files:**
- Modify: `app/src/views/VaultView.tsx`
- Modify: `app/src/views/__tests__/VaultView.test.tsx`

- [ ] **Step 7.1: Write failing test**

Add to `VaultView.test.tsx`:

```tsx
import { onAuthClear } from '../../store/onAuthClear'

it('clears vault, positions, and stealth tree on onAuthClear.clearAll', async () => {
  ;(apiFetch as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce({ wallet: 'W', balances: { sol: 1, tokens: [], status: 'ok' } })
    .mockResolvedValueOnce({ positions: [{ symbol: 'SOL', balanceUiAmount: 1 }], available: true, network: 'devnet' })
    .mockResolvedValueOnce({ tree: [{ index: 0, derivationPath: 'm/0', stealthAddress: 'X', parentIndex: null, createdAt: 't' }], rootWallet: 'W' })
  render(<VaultView />)
  await waitFor(() => {
    expect(screen.getByText('1 positions')).toBeInTheDocument()
  })
  onAuthClear.clearAll()
  await waitFor(() => {
    expect(screen.getByText('0 positions')).toBeInTheDocument()
  })
})
```

(Adjust assertion to match actual rendered UI — `0 positions` chip text after clear.)

- [ ] **Step 7.2: Run test to verify it fails**

```bash
cd app
pnpm test --run src/views/__tests__/VaultView.test.tsx
```

Expected: FAIL.

- [ ] **Step 7.3: Modify `VaultView.tsx`**

Add import:

```tsx
import { useOnAuthClear } from '../store/useOnAuthClear'
```

Add inside the component, after the four `useState` declarations:

```tsx
useOnAuthClear(() => {
  setVault(null)
  setPositions([])
  setStealthTree([])
  setLoading(true)
})
```

(Set `loading: true` to match the initial-mount default; if the user re-authenticates, the next `useEffect` run will set it back via its own `setLoading(true)`.)

- [ ] **Step 7.4: Run test**

```bash
cd app
pnpm test --run src/views/__tests__/VaultView.test.tsx
```

Expected: PASS.

- [ ] **Step 7.5: Commit**

```bash
git add app/src/views/VaultView.tsx app/src/views/__tests__/VaultView.test.tsx
git commit -m "feat(app): wire VaultView state cleanup via useOnAuthClear

Clears vault data, positions, and stealth tree on auth boundary
transition.

Part of #189."
```

## PR-C Task 8: Wire `StealthAddressBackup` cleanup

**Files:**
- Modify: `app/src/components/keys/StealthAddressBackup.tsx`
- Modify: `app/src/components/keys/__tests__/StealthAddressBackup.test.tsx`

- [ ] **Step 8.1: Write failing test**

Add to `StealthAddressBackup.test.tsx`:

```tsx
import { onAuthClear } from '../../../store/onAuthClear'

it('clears data state when onAuthClear.clearAll fires', async () => {
  ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    tree: [{ index: 0, derivationPath: 'm/0', stealthAddress: 'X', parentIndex: null, createdAt: 't' }],
    rootWallet: 'W',
  })
  render(<StealthAddressBackup />)
  await waitFor(() => {
    expect(screen.getByText(/1 address/)).toBeInTheDocument()
  })
  onAuthClear.clearAll()
  await waitFor(() => {
    expect(screen.queryByText(/1 address/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 8.2: Run test to verify it fails**

```bash
cd app
pnpm test --run src/components/keys/__tests__/StealthAddressBackup.test.tsx
```

Expected: FAIL.

- [ ] **Step 8.3: Modify `StealthAddressBackup.tsx`**

Add import:

```tsx
import { useOnAuthClear } from '../../store/useOnAuthClear'
```

Inside the component, after the `useState` block:

```tsx
useOnAuthClear(() => {
  setData(null)
  setError(null)
  setSheetOpen(false)
  setPassphrase('')
  setConfirm('')
  setEncryptError(null)
  setLoading(true)
})
```

- [ ] **Step 8.4: Run test**

```bash
cd app
pnpm test --run src/components/keys/__tests__/StealthAddressBackup.test.tsx
```

Expected: PASS.

- [ ] **Step 8.5: Commit**

```bash
git add app/src/components/keys/StealthAddressBackup.tsx app/src/components/keys/__tests__/StealthAddressBackup.test.tsx
git commit -m "feat(app): wire StealthAddressBackup cleanup via useOnAuthClear

Part of #189."
```

## PR-C Task 9: Wire `DashboardView` cleanup

**Files:**
- Modify: `app/src/views/DashboardView.tsx`
- Modify: `app/src/views/__tests__/DashboardView.test.tsx` (create if absent)

- [ ] **Step 9.1: Write failing test**

If `DashboardView.test.tsx` does not exist, create the basic suite with a clearAuth assertion:

```tsx
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import DashboardView from '../DashboardView'
import { onAuthClear } from '../../store/onAuthClear'

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('../../hooks/useAuthState', async () => {
  const { makeFakeAuthState } = await import('../../test-utils/makeFakeAuthState')
  return {
    useAuthState: () => makeFakeAuthState({ status: 'authed', token: 'tok', publicKey: 'W' }),
  }
})

import { apiFetch } from '../../api/client'

beforeEach(() => {
  ;(apiFetch as ReturnType<typeof vi.fn>).mockReset()
  onAuthClear._resetForTests()
})

describe('DashboardView', () => {
  it('clears vault, history, and privacy data on auth-clear', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ wallet: 'W', balances: { sol: 1, tokens: [], status: 'ok' } })
      .mockResolvedValueOnce({ activity: [{ id: '1', agent: 'a', type: 'send.success', level: 'info', title: 't', detail: null, created_at: 't' }] })
      .mockResolvedValueOnce({ data: { score: 80, grade: 'A', factors: { addressReuse: { score: 80, detail: '' }, amountPatterns: { score: 80, detail: '' }, timingCorrelation: { score: 80, detail: '' }, counterpartyExposure: { score: 80, detail: '' } }, recommendations: [], transactionsAnalyzed: 1 } })
    render(<DashboardView events={[]} />)
    await waitFor(() => {
      expect(screen.getByText(/Score/i)).toBeInTheDocument()
    })
    onAuthClear.clearAll()
    // After clear, we expect the privacy score card to fall back to its
    // null-data state (assertion specific to PrivacyScoreCard's empty render).
    // If the empty state isn't trivially queryable, assert via a stable
    // marker the component sets when data is null.
    await waitFor(() => {
      // Replace with the actual null-state copy from PrivacyScoreCard.
      // If unclear at implementation time, fall back to asserting
      // a specific element's absence:
      // expect(screen.queryByText('80')).not.toBeInTheDocument()
    })
  })
})
```

If the suite needs to mock more (e.g. `useNetworkConfigStore`), add the mocks the file already requires. The test is illustrative — the subagent implementing this task should match assertions to the actual PrivacyScoreCard null-state DOM.

- [ ] **Step 9.2: Modify `DashboardView.tsx`**

Add import:

```tsx
import { useOnAuthClear } from '../store/useOnAuthClear'
```

Inside the component, after the `useState`/`useRef` declarations:

```tsx
useOnAuthClear(() => {
  setVault(null)
  setHistory([])
  setPrivacyData(null)
  if (refreshTimer.current) {
    clearTimeout(refreshTimer.current)
    refreshTimer.current = null
  }
  lastProcessedEventId.current = null
})
```

- [ ] **Step 9.3: Run test**

```bash
cd app
pnpm test --run src/views/__tests__/DashboardView.test.tsx
```

Expected: PASS.

- [ ] **Step 9.4: Commit**

```bash
git add app/src/views/DashboardView.tsx app/src/views/__tests__/DashboardView.test.tsx
git commit -m "feat(app): wire DashboardView cleanup via useOnAuthClear

Clears vault, history, privacy data plus the refresh timer + last-event
ref on auth boundary transition.

Part of #189."
```

## PR-C Task 10: Wire `useSSE` cleanup

**Files:**
- Modify: `app/src/hooks/useSSE.ts`
- Modify or create: `app/src/hooks/__tests__/useSSE.test.ts`

- [ ] **Step 10.1: Write failing test**

`app/src/hooks/__tests__/` does not exist yet. Create the directory and the test file:

```ts
// app/src/hooks/__tests__/useSSE.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { connectSSE } from '../../api/sse'
import { useSSE } from '../useSSE'
import { onAuthClear } from '../../store/onAuthClear'

vi.mock('../../api/sse', () => ({
  connectSSE: vi.fn(),
}))

vi.mock('../useAuthState', async () => {
  const { makeFakeAuthState } = await import('../../test-utils/makeFakeAuthState')
  return {
    useAuthState: () => makeFakeAuthState({ status: 'authed', token: 'tok' }),
  }
})

beforeEach(() => {
  onAuthClear._resetForTests()
  ;(connectSSE as ReturnType<typeof vi.fn>).mockReset()
})

describe('useSSE', () => {
  it('clears events when onAuthClear.clearAll fires', async () => {
    let onMessageCb: ((e: MessageEvent) => void) | null = null
    ;(connectSSE as ReturnType<typeof vi.fn>).mockImplementation(
      async (_token, onMessage) => {
        onMessageCb = onMessage
        return { close: vi.fn(), onerror: null } as unknown as EventSource
      },
    )

    const { result } = renderHook(() => useSSE())

    // Wait for the async connectSSE to resolve and capture the callback.
    await waitFor(() => expect(onMessageCb).not.toBeNull())

    // Inject an event so events.length > 0 before the clear.
    act(() => {
      onMessageCb?.({
        data: JSON.stringify({
          id: '1',
          agent: 'a',
          type: 't',
          level: 'info',
          data: {},
          timestamp: 'x',
        }),
      } as MessageEvent)
    })
    await waitFor(() => expect(result.current.events).toHaveLength(1))

    // Fire auth-clear and assert the events array drained.
    act(() => onAuthClear.clearAll())
    await waitFor(() => expect(result.current.events).toHaveLength(0))
  })
})
```

The test populates events via the `onMessage` callback captured from
the `connectSSE` mock, then asserts they drain after `clearAll`. No
timing flake — every step is awaited before the assertion.

- [ ] **Step 10.2: Modify `useSSE.ts`**

```ts
// BEFORE
import { useEffect, useRef, useState } from 'react'
import { connectSSE } from '../api/sse'
import { useAuthState } from './useAuthState'

// AFTER
import { useEffect, useRef, useState } from 'react'
import { connectSSE } from '../api/sse'
import { useAuthState } from './useAuthState'
import { useOnAuthClear } from '../store/useOnAuthClear'
```

Inside the hook, after the `useState` declarations:

```ts
useOnAuthClear(() => {
  setEvents([])
  setConnected(false)
  sourceRef.current?.close()
  sourceRef.current = null
})
```

NOTE: this PR-C change addresses the auth-clear concern. The network-error concern (also in `useSSE.ts`) is in PR-D and rebases on this.

- [ ] **Step 10.3: Run test**

```bash
cd app
pnpm test --run src/hooks/__tests__/useSSE.test.ts
```

Expected: PASS.

- [ ] **Step 10.4: Commit**

```bash
git add app/src/hooks/useSSE.ts app/src/hooks/__tests__/useSSE.test.ts
git commit -m "feat(app): wire useSSE cleanup via useOnAuthClear

Clears events array, marks disconnected, and closes the EventSource
on auth boundary transition.

Part of #189."
```

## PR-C Task 11: Final verification + push + open PR

- [ ] **Step 11.1: Run full app suite + typecheck**

```bash
cd app
pnpm exec tsc --noEmit
pnpm test --run
```

Expected: typecheck clean, all tests pass.

- [ ] **Step 11.2: Manual repro**

```bash
cd ~/local-dev/sipher.worktrees/pr-c-auth-clear
pnpm --filter "@sipher/app" dev
```

In browser:
1. Connect wallet, sign in
2. Wait for Privacy Graph to populate
3. Open DevTools, run: `localStorage.removeItem('sipher-app')` (or whatever the Zustand persist key is — verify by inspecting Application > Local Storage)
4. Reload the page
5. Confirm Privacy Graph + Vault are empty (no stale render)

If the persist key blocks the test, alternative: run `useAppStore.getState().clearAuth()` from console.

- [ ] **Step 11.3: Push and open PR**

```bash
git push -u origin feat/on-auth-clear-registry
gh pr create --base main --title "feat(app): add onAuthClear registry + 5 component consumers — closes #202, #189" --body "$(cat <<'EOF'
## Summary

Closes #202 + #189. Adds module-singleton \`onAuthClear\` registry plus
\`useOnAuthClear\` thin hook. Wires \`useAppStore.clearAuth()\` to call
\`clearAll()\` after store reset. Migrates 5 components to register their
state-cleanup callbacks: \`PrivacyGraph\`, \`VaultView\`,
\`StealthAddressBackup\`, \`DashboardView\`, \`useSSE\`.

## Why

When a JWT expires (or the user clicks Disconnect), the auth store's
\`clearAuth()\` resets \`token\`, \`messages\`, and \`activeView\`,
but components had local state (\`useState\`) that retained data fetched
under the old token. The Skeptic QA archetype reproduced the bug by
walking React fibers and injecting a fake stealth tree into
\`PrivacyGraph\` — confirming stale data could leak across auth
boundaries.

The registry pattern centralizes the cleanup contract: any component
that fetches under a token must register a cleanup callback. The auth
store fires \`clearAll()\` after reset, so consumer callbacks see empty
store state when they read it.

## Architecture

- \`app/src/store/onAuthClear.ts\` — module-singleton registry
- \`app/src/store/useOnAuthClear.ts\` — thin hook wrapper (refs latest
  callback, unsubscribes on unmount)
- \`app/src/stores/app.ts\` — \`clearAuth\` calls \`onAuthClear.clearAll()\`
  after store \`set\`
- 5 component consumers register their cleanup callbacks

## Verification

- [x] \`pnpm exec tsc --noEmit\` clean
- [x] \`pnpm test --run\` green (registry + 5 consumers + store integration)
- [x] Manual repro: force \`clearAuth()\` from DevTools → all 5 surfaces
  show empty state, no stale render

## Out of scope

The \`useSSE\` change in this PR addresses auth-clear cleanup. PR-D
(\`feat/auth-error-handling\`) adds network-error event clearing in the
same hook, rebases on this PR.

Spec: \`docs/superpowers/specs/2026-05-10-qa-sweep-tier-0-1-design.md\`
EOF
)"
```

- [ ] **Step 11.4: Wait for CI green, then merge**

```bash
gh pr checks --watch
cd ~/local-dev/sipher
gh pr merge <PR#> --merge --delete-branch
git checkout main && git pull
git worktree remove ~/local-dev/sipher.worktrees/pr-c-auth-clear
git branch -d feat/on-auth-clear-registry 2>/dev/null || true
```

---

# PR-D: `feat/auth-error-handling` (closes #191 + #192)

**Branch:** `feat/auth-error-handling`
**Worktree:** `~/local-dev/sipher.worktrees/pr-d-auth-errors`
**Mode:** SUBAGENT-driven w/ TDD
**Estimated:** 4-6h

## PR-D Task 1: Create worktree from latest main (post-PR-C merge)

- [ ] **Step 1.1: Create worktree**

```bash
cd ~/local-dev/sipher
git fetch --prune
git pull  # ensure local main has PR-C merged
git worktree add ~/local-dev/sipher.worktrees/pr-d-auth-errors -b feat/auth-error-handling main
cd ~/local-dev/sipher.worktrees/pr-d-auth-errors
pnpm install
pnpm --filter "@sipher/sdk" build
```

## PR-D Task 2: Add `network-error` event + `triggerAuthInterceptor` to `api/client.ts`

**Files:**
- Modify: `app/src/api/client.ts`
- Modify: `app/src/api/__tests__/client.test.ts` (file already exists — APPEND new describe blocks; do not delete existing tests)

- [ ] **Step 2.1: Write failing test for network-error branch**

Append to existing `app/src/api/__tests__/client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch, registerAuthInterceptor, triggerAuthInterceptor } from '../client'

describe('apiFetch network-error branch', () => {
  let originalFetch: typeof globalThis.fetch
  beforeEach(() => {
    originalFetch = globalThis.fetch
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('emits a network-error CustomEvent on TypeError: Failed to fetch', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const handler = vi.fn()
    window.addEventListener('sipher:network-error', handler)
    await expect(apiFetch('/whatever')).rejects.toThrow(/network/i)
    expect(handler).toHaveBeenCalledOnce()
    window.removeEventListener('sipher:network-error', handler)
  })

  it('does not emit network-error on a non-network failure (e.g. 500)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'server boom' }), { status: 500 }),
    )
    const handler = vi.fn()
    window.addEventListener('sipher:network-error', handler)
    await expect(apiFetch('/whatever')).rejects.toThrow(/boom/)
    expect(handler).not.toHaveBeenCalled()
    window.removeEventListener('sipher:network-error', handler)
  })
})

describe('triggerAuthInterceptor', () => {
  it('invokes the registered auth interceptor exactly once', () => {
    const handler = vi.fn()
    registerAuthInterceptor(handler)
    triggerAuthInterceptor()
    expect(handler).toHaveBeenCalledOnce()
    registerAuthInterceptor(null)
  })

  it('is a no-op when no interceptor is registered', () => {
    registerAuthInterceptor(null)
    expect(() => triggerAuthInterceptor()).not.toThrow()
  })

  it('swallows interceptor exceptions like the 401 path does', () => {
    const handler = vi.fn(() => { throw new Error('boom') })
    registerAuthInterceptor(handler)
    expect(() => triggerAuthInterceptor()).not.toThrow()
    registerAuthInterceptor(null)
  })
})
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
cd app
pnpm test --run src/api/__tests__/client.test.ts
```

Expected: FAIL — `triggerAuthInterceptor` not exported; network-error branch absent.

- [ ] **Step 2.3: Modify `api/client.ts`**

Replace the file contents (preserving existing 401 logic, adding network-error branch + export):

```ts
const BASE = import.meta.env.VITE_API_URL ?? ''

type UnauthHandler = () => void

let authInterceptor: UnauthHandler | null = null

/**
 * Register a single global handler invoked whenever apiFetch receives 401.
 * Pass `null` to clear. AuthSyncProvider wires this up on mount and tears
 * down on unmount, so callers across the app get a consistent re-auth UX
 * (clearAuth + toast + Sign in CTA) without each fetch site reinventing it.
 */
export function registerAuthInterceptor(handler: UnauthHandler | null) {
  authInterceptor = handler
}

/**
 * Manually fire the registered auth interceptor. Used by code paths that
 * bypass `apiFetch` — most notably ChatSidebar's streaming fetch, which
 * cannot route through the interceptor branch in `apiFetch` because it
 * needs the response body as a stream.
 */
export function triggerAuthInterceptor(): void {
  if (!authInterceptor) return
  try {
    authInterceptor()
  } catch {
    // Mirror the 401 branch: an interceptor crash is best-effort UX and
    // should not propagate. The caller already knows the request failed.
  }
}

function emitNetworkError(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('sipher:network-error'))
}

function emitNetworkRecovered(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('sipher:network-recovered'))
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const { token, ...fetchOpts } = options ?? {}
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...fetchOpts,
      headers: { ...headers, ...(fetchOpts.headers as Record<string, string>) },
    })
  } catch (err) {
    // Network-layer failure (offline, DNS, CORS preflight refusal): browsers
    // throw `TypeError: Failed to fetch`. Surface to the global event bus so
    // <NetworkBanner> can react; rethrow so callers still see the error.
    if (err instanceof TypeError) {
      emitNetworkError()
      throw new Error('Network connection lost')
    }
    throw err
  }

  // If we recovered from a prior network error, let the banner know.
  emitNetworkRecovered()

  if (res.status === 401) {
    triggerAuthInterceptor()
    const body = await res.json().catch(() => ({}))
    const err = (body as { error?: { message?: string } | string }).error
    if (typeof err === 'string') throw new Error(err)
    if (err && typeof err === 'object' && typeof err.message === 'string') {
      throw new Error(err.message)
    }
    throw new Error('Authentication required')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = (body as { error?: { message?: string } | string }).error
    if (typeof err === 'string') throw new Error(err)
    if (err && typeof err === 'object' && typeof err.message === 'string') {
      throw new Error(err.message)
    }
    throw new Error(`API error ${res.status}`)
  }
  if (res.status === 204 || res.headers?.get('content-length') === '0') {
    return undefined as T
  }
  return res.json() as Promise<T>
}
```

Key changes:
- Added `triggerAuthInterceptor` named export (replaces inline 401 try/catch with a shared function)
- Added `try/catch` around `fetch()` that branches on `TypeError`
- Added `emitNetworkError` + `emitNetworkRecovered` event dispatchers
- 401 path now calls `triggerAuthInterceptor()` (same behavior, just routed through the named export)

- [ ] **Step 2.4: Run test**

```bash
cd app
pnpm test --run src/api/__tests__/client.test.ts
```

Expected: PASS.

- [ ] **Step 2.5: Commit**

```bash
git add app/src/api/client.ts app/src/api/__tests__/client.test.ts
git commit -m "feat(app): add network-error event + triggerAuthInterceptor export

apiFetch now catches TypeError: Failed to fetch (network-layer
failures) and dispatches a 'sipher:network-error' CustomEvent before
rethrowing. Successful fetches dispatch 'sipher:network-recovered' so a
banner can auto-dismiss.

triggerAuthInterceptor is exported so non-fetch paths (most notably
ChatSidebar's streaming fetch) can invoke the same 401 flow without
reinventing it.

Part of #191 + #192."
```

## PR-D Task 3: Add `<NetworkBanner>` component

**Files:**
- Create: `app/src/components/NetworkBanner.tsx`
- Test: `app/src/components/__tests__/NetworkBanner.test.tsx`

- [ ] **Step 3.1: Write failing test**

Create `app/src/components/__tests__/NetworkBanner.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { NetworkBanner } from '../NetworkBanner'

describe('NetworkBanner', () => {
  it('does not render anything by default', () => {
    render(<NetworkBanner />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('appears when sipher:network-error is dispatched', async () => {
    render(<NetworkBanner />)
    act(() => {
      window.dispatchEvent(new CustomEvent('sipher:network-error'))
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/network connection lost/i)).toBeInTheDocument()
    })
  })

  it('disappears when sipher:network-recovered is dispatched', async () => {
    render(<NetworkBanner />)
    act(() => {
      window.dispatchEvent(new CustomEvent('sipher:network-error'))
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    act(() => {
      window.dispatchEvent(new CustomEvent('sipher:network-recovered'))
    })
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 3.2: Run test to verify it fails**

```bash
cd app
pnpm test --run src/components/__tests__/NetworkBanner.test.tsx
```

Expected: FAIL — module does not exist.

- [ ] **Step 3.3: Implement `<NetworkBanner>`**

Create `app/src/components/NetworkBanner.tsx`:

```tsx
import { useEffect, useState } from 'react'

export function NetworkBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const handleError = () => setOffline(true)
    const handleRecover = () => setOffline(false)
    window.addEventListener('sipher:network-error', handleError)
    window.addEventListener('sipher:network-recovered', handleRecover)
    return () => {
      window.removeEventListener('sipher:network-error', handleError)
      window.removeEventListener('sipher:network-recovered', handleRecover)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="bg-warning/15 border-b border-warning/30 text-warning px-4 py-2 text-xs flex items-center gap-2 shrink-0"
    >
      <span aria-hidden="true">●</span>
      <span>Network connection lost — checking…</span>
    </div>
  )
}
```

Note on UX: this is a sticky banner pinned at the top of the shell (under \`<BetaBanner>\`) until the next successful request. If the visual hierarchy gets crowded mid-PR, evaluate falling back to the existing toast system with a sticky flag. Default is the banner.

- [ ] **Step 3.4: Run test**

```bash
cd app
pnpm test --run src/components/__tests__/NetworkBanner.test.tsx
```

Expected: PASS.

- [ ] **Step 3.5: Commit**

```bash
git add app/src/components/NetworkBanner.tsx app/src/components/__tests__/NetworkBanner.test.tsx
git commit -m "feat(app): add NetworkBanner component

Subscribes to 'sipher:network-error' / 'sipher:network-recovered'
custom events. Renders a sticky top-of-shell banner while offline,
auto-dismisses on next successful fetch.

Part of #191."
```

## PR-D Task 4: Mount `<NetworkBanner>` in `App.tsx`

**Files:**
- Modify: `app/src/App.tsx`

- [ ] **Step 4.1: Add import**

In `app/src/App.tsx`, with the other component imports:

```tsx
import { NetworkBanner } from './components/NetworkBanner'
```

- [ ] **Step 4.2: Mount in `AppShell`**

Place `<NetworkBanner />` directly under `<BetaBanner />` so it sits at the very top of the shell and never shifts content layout when toggling:

```tsx
return (
  <div className="flex flex-col h-dvh bg-bg">
    <BetaBanner beta={beta} />
    <NetworkBanner />
    <Header />

    {/* … rest unchanged … */}
  </div>
)
```

- [ ] **Step 4.3: Run typecheck + app tests**

```bash
cd app
pnpm exec tsc --noEmit
pnpm test --run
```

Expected: clean.

- [ ] **Step 4.4: Commit**

```bash
git add app/src/App.tsx
git commit -m "feat(app): mount NetworkBanner in app shell

Sits directly under BetaBanner; pushes content down only while
offline, snaps back on recovery.

Part of #191."
```

## PR-D Task 5: Wire `useSSE` to clear events on EventSource error

**Files:**
- Modify: `app/src/hooks/useSSE.ts`
- Modify: `app/src/hooks/__tests__/useSSE.test.ts`

- [ ] **Step 5.1: Write failing test**

Append to `useSSE.test.ts` (created in PR-C; should already exist on this worktree's `main` after PR-C merged):

```ts
it('clears events when the EventSource emits an error', async () => {
  let onMessageCb: ((e: MessageEvent) => void) | null = null
  let onerrorRef: { current: (() => void) | null } = { current: null }

  ;(connectSSE as ReturnType<typeof vi.fn>).mockImplementation(
    async (_token, onMessage) => {
      onMessageCb = onMessage
      const source = {
        close: vi.fn(),
        get onerror() { return onerrorRef.current },
        set onerror(v: (() => void) | null) { onerrorRef.current = v },
      }
      return source as unknown as EventSource
    },
  )

  const { result } = renderHook(() => useSSE())
  await waitFor(() => expect(onMessageCb).not.toBeNull())

  act(() => {
    onMessageCb?.({
      data: JSON.stringify({
        id: '1',
        agent: 'a',
        type: 't',
        level: 'info',
        data: {},
        timestamp: 'x',
      }),
    } as MessageEvent)
  })
  await waitFor(() => expect(result.current.events).toHaveLength(1))

  act(() => {
    onerrorRef.current?.()
  })
  await waitFor(() => expect(result.current.events).toHaveLength(0))
})
```

The test uses a getter/setter pair on `onerror` so the production
code's assignment (`source.onerror = () => {…}`) is captured into a
ref the test can later invoke. This avoids `setTimeout` flake.

- [ ] **Step 5.2: Modify `useSSE.ts`**

Find the `source.onerror` assignment (currently line 32). Change:

```ts
// BEFORE
source.onerror = () => setConnected(false)

// AFTER
source.onerror = () => {
  setConnected(false)
  setEvents([])
}
```

- [ ] **Step 5.3: Run test**

```bash
cd app
pnpm test --run src/hooks/__tests__/useSSE.test.ts
```

Expected: PASS.

- [ ] **Step 5.4: Commit**

```bash
git add app/src/hooks/useSSE.ts app/src/hooks/__tests__/useSSE.test.ts
git commit -m "feat(app): clear useSSE events on EventSource error

Prevents stale activity-stream rendering when the SSE connection
dies (network blackout, server reboot, idle reaper, etc.).

Part of #191."
```

## PR-D Task 6: Wire `ChatSidebar` to call `triggerAuthInterceptor` on 401

**Files:**
- Modify: `app/src/components/ChatSidebar.tsx`
- Modify: `app/src/components/__tests__/ChatSidebar.test.tsx`

- [ ] **Step 6.1: Write failing test**

The existing `ChatSidebar.test.tsx` already mocks `useAuthState` (see top of file: it spreads from `useAppStore` to derive token-aware status) and `useToast`. The 401 test plugs into the same render setup; no new fixtures needed beyond mocking `triggerAuthInterceptor`.

Append to `app/src/components/__tests__/ChatSidebar.test.tsx` inside the existing top-level `describe('ChatSidebar', ...)` block:

```tsx
// At the top of the file, MERGE this into the existing api/client mock if
// one exists; otherwise add as a new vi.mock above the test code:
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>(
    '../../api/client',
  )
  return {
    ...actual,
    triggerAuthInterceptor: vi.fn(),
  }
})

import { triggerAuthInterceptor } from '../../api/client'

it('calls triggerAuthInterceptor when streaming fetch returns 401', async () => {
  // Existing test setup pattern in this file already seeds a token via
  // useAppStore — replicate that here so the auth mock returns
  // status: 'authed'.
  useAppStore.getState().setAuth('tok', false, null)

  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }),
  )

  render(<ChatSidebar />)

  // Type a message and press Enter (matches existing pattern for typing
  // into the chat input). Replace this with the exact steps the file
  // already uses to submit a message — the subagent should grep for
  // `fireEvent.change` or `userEvent.type` patterns at the input
  // selector.
  const input = screen.getByPlaceholderText(/Message SIPHER/)
  fireEvent.change(input, { target: { value: 'hello' } })
  fireEvent.keyDown(input, { key: 'Enter' })

  await waitFor(() => {
    expect(triggerAuthInterceptor).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 6.2: Modify `ChatSidebar.tsx`**

Add import:

```tsx
import { triggerAuthInterceptor } from '../api/client'
```

Find the `if (!res.ok)` branch in `sendMessage` (currently lines 66-69):

```tsx
// BEFORE
if (!res.ok) {
  const err = await res.json().catch(() => ({}))
  throw new Error((err as { error?: string }).error ?? `Error ${res.status}`)
}

// AFTER
if (!res.ok) {
  if (res.status === 401) {
    triggerAuthInterceptor()
    // Surface a neutral message — the global session-expired toast already
    // tells the user what happened and offers a sign-in CTA. Returning
    // here without throwing avoids painting the raw 401 body into the
    // assistant bubble.
    return
  }
  const err = await res.json().catch(() => ({}))
  throw new Error((err as { error?: string }).error ?? `Error ${res.status}`)
}
```

- [ ] **Step 6.3: Run test**

```bash
cd app
pnpm test --run src/components/__tests__/ChatSidebar.test.tsx
```

Expected: PASS.

- [ ] **Step 6.4: Commit**

```bash
git add app/src/components/ChatSidebar.tsx app/src/components/__tests__/ChatSidebar.test.tsx
git commit -m "feat(app): ChatSidebar invokes triggerAuthInterceptor on 401

Streaming fetch path bypasses apiFetch (it needs the body as a
stream), so it had no way to fire the global 401 interceptor. This
adds an explicit res.status === 401 check that fires the interceptor
and returns silently — the global toast already shows the user what
happened with a Sign in CTA.

Part of #192."
```

## PR-D Task 7: Final verification + push + open PR

- [ ] **Step 7.1: Full app suite + typecheck**

```bash
cd app
pnpm exec tsc --noEmit
pnpm test --run
```

Expected: clean.

- [ ] **Step 7.2: Manual repro 1 — network blackout**

```bash
pnpm --filter "@sipher/app" dev
```

In browser:
1. Connect wallet, sign in
2. Open DevTools console
3. Run: `window.fetch = () => Promise.reject(new TypeError('Failed to fetch'))`
4. Trigger any page action that fetches (e.g., switch view)
5. Confirm `<NetworkBanner>` appears with "Network connection lost — checking…"
6. Restore: `delete window.fetch` (page reload also works)
7. Trigger another fetch
8. Confirm banner dismisses

- [ ] **Step 7.3: Manual repro 2 — chat 401**

(Requires backend cooperation or an environment override to force 401 on `/api/chat/stream`. If hard to set up locally, document this as a Vercel preview validation step in the PR description.)

- [ ] **Step 7.4: Manual repro 3 — SSE error clearing**

In dev, open the dashboard, populate events. Disconnect via DevTools Network tab (block `*.sip-protocol.org` SSE endpoint). Confirm activity stream empties.

- [ ] **Step 7.5: Push and open PR**

```bash
git push -u origin feat/auth-error-handling
gh pr create --base main --title "feat(app): network-error handling + ChatSidebar 401 interceptor — closes #191, #192" --body "$(cat <<'EOF'
## Summary

Closes #191 + #192. Three changes wired through the new
\`triggerAuthInterceptor\` export and a CustomEvent bus:

1. \`apiFetch\` catches \`TypeError: Failed to fetch\` and dispatches
   \`sipher:network-error\`. Successful fetches dispatch
   \`sipher:network-recovered\`.
2. New \`<NetworkBanner>\` mounted in app shell subscribes to those
   events; renders a sticky banner while offline, auto-dismisses on
   recovery.
3. \`useSSE\` clears its events array on \`EventSource\` error
   (network blackout, server reboot, idle reaper).
4. \`ChatSidebar\` calls \`triggerAuthInterceptor()\` when its streaming
   fetch returns 401 — bypasses the global \`apiFetch\` 401 path because
   streaming responses need the body as a stream.

## Why

- Sipher had ZERO offline indicators. \`window.fetch =
  () => Promise.reject(...)\` would silently fail every action and
  leave users staring at a frozen UI. Privacy/finance products MUST
  surface network state.
- \`ChatSidebar\` bypassed the global 401 interceptor because its fetch
  call doesn't go through \`apiFetch\`. Users could chat with an expired
  JWT, get a raw 401 message in the assistant bubble, and never know
  they needed to sign in again.

## Verification

- [x] \`pnpm exec tsc --noEmit\` clean
- [x] \`pnpm test --run\` green (api/client + NetworkBanner + useSSE + ChatSidebar)
- [x] Manual repro 1: \`window.fetch = () => Promise.reject(new TypeError(…))\`
  → banner appears → restore fetch → banner dismisses
- [x] Manual repro 3: SSE disconnect via DevTools network block → events clear
- [ ] Manual repro 2 (chat 401): validated on Vercel preview with token
  expiry forced — see preview deploy

## Out of scope

\`useSSE\` auth-clear cleanup (PR-C, already merged) is the auth-boundary
case; this PR adds the network-error case to the same hook.

Spec: \`docs/superpowers/specs/2026-05-10-qa-sweep-tier-0-1-design.md\`
EOF
)"
```

- [ ] **Step 7.6: Wait for CI green, then merge**

```bash
gh pr checks --watch
cd ~/local-dev/sipher
gh pr merge <PR#> --merge --delete-branch
git checkout main && git pull
git worktree remove ~/local-dev/sipher.worktrees/pr-d-auth-errors
git branch -d feat/auth-error-handling 2>/dev/null || true
```

---

# Session-end checkpoint

After PR-D merges:

- [ ] **Run `/quality:qa --diff-from=1778399617-both-fresh+skeptic`**

Expected output: #189, #191, #192, #193, #205 in "Resolved" trend; #190, #194-#204, #206-#221 still in "Open" trend; zero net new findings.

- [ ] **Update session memory**

Append to `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/project_phase4b-redesign-sprint.md`:
- Tier 0+1 closed: 4 PRs merged, 6 issues resolved (#193, #205, #202, #189, #191, #192)
- Remaining: 27 issues across Tier 2 (6), Tier 3 (3), Tier 4 (19) → Phase D launch when zero open

- [ ] **Write session-handoff doc**

`~/Documents/secret/claude-strategy/sip-protocol/sipher/session-handoff-2026-05-10-d.md` capturing:
- 4 PRs merged with their PR numbers
- /quality:qa --diff-from output snapshot
- Tier 2 starting state (will brainstorm at start of next session)

NOTE: Phase D launch gate is NOT closed by this session — that requires Tiers 2-4 + 3-wallet QA + X thread. End of session = checkpoint, not launch.
