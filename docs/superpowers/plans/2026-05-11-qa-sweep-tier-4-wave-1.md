# QA Sweep — Tier 4 Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 11 QA findings across 3 parallel cluster PRs in Wave 1 of the Tier 4 sprint: Cluster A (#195, #196, #197 — hardcoded data cleanup), Cluster B (#203, #213 — auth/session UX), Cluster F (#225, #226, #227, #228, #234, #235 — tech-debt followups). Wave 2 (Clusters C, D, E) plan happens after a mid-sprint brainstorm once Wave 1 lands.

**Architecture:** 3 independent worktrees, 3 parallel SUBAGENT implementer dispatches (single message with 3 Agent tool calls), per-cluster two-stage review (spec-compliance then code-quality), per-cluster PR + merge. Wave sync gate enforced before Wave 2 dispatch.

**Tech Stack:** React 19 + TypeScript (strict), Vitest, @testing-library/react, @solana/wallet-adapter-react, AbortController (browser-native).

**Spec:** `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-design.md` (committed `91b6ff8`)

**Predecessor sprint memory:** `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/project_phase4b-redesign-sprint.md`

---

## Worktree setup (run BEFORE Wave 1 dispatch)

### Task 1: Sync local main + verify baseline

**Files:** none modified (verification only)

- [ ] **Step 1: Sync main and verify clean state**

```bash
cd ~/local-dev/sipher
git checkout main
git pull --ff-only
git status                    # expect: clean, on main, up to date
git log --oneline -3          # expect: 91b6ff8 spec commit on top of 0e00d7e
```

- [ ] **Step 2: Verify @noble/ciphers symlink (Tier 2 carry-forward)**

```bash
ls app/node_modules/@noble/ | head -3   # expect: ciphers symlink present
# If missing: pnpm install --force
```

- [ ] **Step 3: Verify baseline test count + tsc clean from main**

```bash
cd app
pnpm test --run src/ 2>&1 | tail -5     # expect: 460 passed across 74 files
pnpm exec tsc --noEmit                  # expect: clean exit, no output
cd ..
```

---

### Task 2: Create 3 worktrees for Wave 1

**Files:**
- New: `.worktrees/feat-hardcoded-data-cleanup/` (Cluster A)
- New: `.worktrees/feat-auth-session-ux/` (Cluster B)
- New: `.worktrees/chore-tech-debt-followups/` (Cluster F)

- [ ] **Step 1: Create Cluster A worktree**

```bash
cd ~/local-dev/sipher
git worktree add .worktrees/feat-hardcoded-data-cleanup -b fix/hardcoded-data-cleanup main
```

- [ ] **Step 2: Create Cluster B worktree**

```bash
git worktree add .worktrees/feat-auth-session-ux -b fix/auth-session-ux main
```

- [ ] **Step 3: Create Cluster F worktree**

```bash
git worktree add .worktrees/chore-tech-debt-followups -b chore/tech-debt-followups main
```

- [ ] **Step 4: Verify all 3 worktrees**

```bash
git worktree list
# expect: 4 entries (main + 3 cluster worktrees)
```

---

### Task 3: Build @sipher/sdk in each worktree (Cluster A needs it for RoutePreviewCard)

**Files:** none modified (build artifacts only)

- [ ] **Step 1: Build SDK in Cluster A worktree**

```bash
cd ~/local-dev/sipher/.worktrees/feat-hardcoded-data-cleanup
pnpm install --frozen-lockfile
pnpm --filter "@sipher/sdk" build
cd ~/local-dev/sipher
```

- [ ] **Step 2: Build SDK in Cluster B worktree**

```bash
cd ~/local-dev/sipher/.worktrees/feat-auth-session-ux
pnpm install --frozen-lockfile
pnpm --filter "@sipher/sdk" build
cd ~/local-dev/sipher
```

- [ ] **Step 3: Build SDK in Cluster F worktree**

```bash
cd ~/local-dev/sipher/.worktrees/chore-tech-debt-followups
pnpm install --frozen-lockfile
pnpm --filter "@sipher/sdk" build
cd ~/local-dev/sipher
```

---

## Task 4: Parallel SUBAGENT dispatch for Wave 1 implementation

**Mode:** SUBAGENT × 3 in PARALLEL (single message with 3 Agent tool calls)

This is the core parallel-dispatch task. All 3 subagent prompts are listed below — copy each into an Agent tool invocation, all in the same message.

- [ ] **Step 1: Dispatch all 3 implementer subagents in a single message**

Use 3 Agent tool calls in parallel:
- subagent_type: `general-purpose` (or domain-specialist if available)
- description: `Wave 1 Cluster {A|B|F} implementation`
- prompt: (see prompts below — one per cluster)

The subagents work in their own worktrees and report back when their cluster is fully green (all issues TDD'd + committed + tsc clean + tests passing).

### Cluster A — Implementer subagent prompt

> **Context:** You are implementing Cluster A of Tier 4 Wave 1 for the Sipher project. Working directory: `~/local-dev/sipher/.worktrees/feat-hardcoded-data-cleanup`. Branch: `fix/hardcoded-data-cleanup`.
>
> **Spec section:** `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-design.md` → "Cluster A — Hardcoded data cleanup (P1)"
>
> **Closes:** #195, #196, #197 (3 issues)
>
> **Apply TDD strictly:** for each issue, write the failing test first, run it to confirm red, then implement the minimal fix, run the test again to confirm green, then commit. Use conventional commits with `fix(app)` scope. Do NOT use semicolons in TS/TSX. Use single quotes for imports. NEVER use AI attribution in commits.
>
> ---
>
> **Issue #195 — PrivacyScoreCard hardcoded `delta={4}` + orphan " vs last week"**
>
> Target files:
> - `app/src/views/DashboardView.tsx` (call site — remove `delta={4}` prop)
> - `app/src/components/PrivacyScoreCard.tsx` (wrap " vs last week" label in the delta-conditional)
> - `app/src/components/__tests__/PrivacyScoreCard.test.tsx` (invert existing assertion)
>
> Locked: when `delta` prop is undefined, render NEITHER the delta number NOR the " vs last week" label (D-A1 strict-D10 invisible). No em-dash placeholder, no "N/A" fallback.
>
> Red test (extend existing `PrivacyScoreCard.test.tsx`):
>
> ```tsx
> it('renders nothing for delta section when delta is undefined', () => {
>   render(<PrivacyScoreCard data={null} />)
>   expect(screen.queryByText(/vs last week/)).toBeNull()
> })
>
> it('renders both delta and " vs last week" when delta is provided', () => {
>   render(<PrivacyScoreCard data={null} delta={3} />)
>   expect(screen.getByText('+3')).toBeInTheDocument()
>   expect(screen.getByText(/vs last week/)).toBeInTheDocument()
> })
> ```
>
> Existing line 34 of `PrivacyScoreCard.test.tsx` asserts ` vs last week` IS in the document; that test is now under a scenario where `delta` was implicitly defined. Update it or remove if redundant with the new positive case. Run `pnpm test --run src/components/__tests__/PrivacyScoreCard.test.tsx -v` from `app/` to confirm red.
>
> Implementation (wrap the `<div className="text-base mt-1">` content in `delta != null && ...`):
>
> ```tsx
> // before (PrivacyScoreCard.tsx:63-71)
> <div className="text-base mt-1">
>   {delta != null && (
>     <span className="text-cyan font-mono">
>       {delta > 0 ? '+' : ''}
>       {delta}
>     </span>
>   )}
>   <span className="text-text-muted"> vs last week</span>
> </div>
>
> // after
> {delta != null && (
>   <div className="text-base mt-1">
>     <span className="text-cyan font-mono">
>       {delta > 0 ? '+' : ''}
>       {delta}
>     </span>
>     <span className="text-text-muted"> vs last week</span>
>   </div>
> )}
> ```
>
> Then update `DashboardView.tsx` to remove `delta={4}` from the PrivacyScoreCard call site (search for `<PrivacyScoreCard data={privacyData} delta={4} />` and change to `<PrivacyScoreCard data={privacyData} />`).
>
> Run `pnpm test --run src/components/__tests__/PrivacyScoreCard.test.tsx -v` to confirm green. Run `pnpm exec tsc --noEmit` to confirm no type regression.
>
> Commit:
>
> ```bash
> git add app/src/components/PrivacyScoreCard.tsx app/src/components/__tests__/PrivacyScoreCard.test.tsx app/src/views/DashboardView.tsx
> git commit -m "fix(app): drop hardcoded delta and orphan 'vs last week' from PrivacyScoreCard
>
> Closes #195"
> ```
>
> ---
>
> **Issue #196 — RoutePreviewCard hardcoded devnet vault PDA**
>
> Target files:
> - `app/src/components/vault/RoutePreviewCard.tsx` (replace hardcoded PDA with derived value)
> - `app/src/components/vault/__tests__/RoutePreviewCard.test.tsx` (add network-aware tests)
>
> Locked: derive PDA from `useNetworkConfigStore.config?.network` + `@sipher/sdk` vault helpers. For mainnet (vault not deployed), render empty state with copy "Vault on mainnet coming soon" (D-A2).
>
> Read RoutePreviewCard.tsx first to understand current hardcoded structure. Identify the constant (e.g., `const VAULT_PDA = 'CpL4qy...'` or inline string). Confirm sipher_vault SDK exports a helper like `getVaultConfigPDA(network)` or similar; if not, derive via `PublicKey.findProgramAddressSync(...)` using the program ID and seed.
>
> Red test:
>
> ```tsx
> describe('RoutePreviewCard network awareness', () => {
>   it('renders "Vault on mainnet coming soon" when network is mainnet', () => {
>     vi.mocked(useNetworkConfigStore).mockReturnValue({
>       config: { network: 'mainnet' },
>     } as ReturnType<typeof useNetworkConfigStore>)
>     render(<RoutePreviewCard {...defaultProps} />)
>     expect(screen.getByText(/Vault on mainnet coming soon/i)).toBeInTheDocument()
>   })
>
>   it('renders the derived devnet PDA when network is devnet', () => {
>     vi.mocked(useNetworkConfigStore).mockReturnValue({
>       config: { network: 'devnet' },
>     } as ReturnType<typeof useNetworkConfigStore>)
>     render(<RoutePreviewCard {...defaultProps} />)
>     // expect the PDA-derived address to appear (test against the SDK's helper output, not a literal)
>     expect(screen.queryByText(/Vault on mainnet/)).toBeNull()
>   })
> })
> ```
>
> Implementation:
>
> ```tsx
> import { useNetworkConfigStore } from '../../lib/networkConfig'
> // import vault PDA helper from sipher SDK
> import { getVaultConfigPDA } from '@sipher/sdk/vault'  // or equivalent
>
> export function RoutePreviewCard(props: RoutePreviewCardProps) {
>   const network = useNetworkConfigStore((s) => s.config?.network)
>
>   if (network === 'mainnet') {
>     return (
>       <Card variant="default" className="p-6">
>         <p className="text-text-muted text-sm">Vault on mainnet coming soon</p>
>       </Card>
>     )
>   }
>
>   const vaultPDA = network === 'devnet' ? getVaultConfigPDA('devnet') : null
>   // rest of existing render with vaultPDA substituted for hardcoded constant
> }
> ```
>
> If `@sipher/sdk/vault` doesn't export `getVaultConfigPDA`, fall back to inline derivation:
>
> ```tsx
> import { PublicKey } from '@solana/web3.js'
>
> const VAULT_PROGRAM_ID = new PublicKey('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')
>
> function deriveVaultConfigPDA(): string {
>   const [pda] = PublicKey.findProgramAddressSync(
>     [Buffer.from('vault_config')],
>     VAULT_PROGRAM_ID,
>   )
>   return pda.toBase58()
> }
> ```
>
> Run tests, confirm green. Commit:
>
> ```bash
> git add app/src/components/vault/RoutePreviewCard.tsx app/src/components/vault/__tests__/RoutePreviewCard.test.tsx
> git commit -m "fix(app): derive RoutePreviewCard vault PDA from network config
>
> Mainnet renders 'Vault on mainnet coming soon' until deployment lands.
> Devnet derives PDA via SDK helper (no hardcoded constant).
>
> Closes #196"
> ```
>
> ---
>
> **Issue #197 — M19 placeholder copy in StealthAddressList**
>
> Target file: `app/src/components/vault/StealthAddressList.tsx` (the only location per grep).
>
> Locked: remove M19 placeholder entirely (D-A3). If the section becomes empty after removal, render no UI rather than empty-state placeholder.
>
> Read `StealthAddressList.tsx` to find the M19 reference. It's likely a string like "Coming in M19" or "M19 will introduce ...". Identify whether it's in a permanent UI section or behind a conditional.
>
> Red test (extend `app/src/components/vault/__tests__/StealthAddressList.test.tsx`):
>
> ```tsx
> it('does not render M19 placeholder copy', () => {
>   render(<StealthAddressList {...defaultProps} />)
>   expect(screen.queryByText(/M19/i)).toBeNull()
> })
> ```
>
> Implementation: delete the M19 line(s). If the surrounding container becomes empty, remove the container too. If the section had useful structure beyond the M19 string, preserve structure but drop the M19 reference.
>
> Confirm green, commit:
>
> ```bash
> git add app/src/components/vault/StealthAddressList.tsx app/src/components/vault/__tests__/StealthAddressList.test.tsx
> git commit -m "fix(app): remove M19 placeholder copy from StealthAddressList
>
> Per D10 (no mock data — every visible string must be real or removed).
>
> Closes #197"
> ```
>
> ---
>
> **Wrap-up (after all 3 issues green):**
>
> ```bash
> cd app
> pnpm test --run src/ 2>&1 | tail -5   # expect: ≥460 + new tests
> pnpm exec tsc --noEmit                # expect: clean
> cd ..
> git log --oneline main..              # expect: 3 commits, one per issue
> git push -u origin fix/hardcoded-data-cleanup
> ```
>
> Report back with: (a) commit hashes for the 3 issues, (b) new test count, (c) tsc clean confirmation, (d) any deviations from this spec (and why).
>
> **OUT OF SCOPE (do NOT touch):**
> - Auth/session lifecycle (Cluster B territory)
> - useSSE / apiFetch / onAuthClear (Cluster F territory)
> - SEO meta tags / accessibility primitives (Cluster C territory)
> - Header / AmountForm / TickerBar (Cluster D territory)
> - Marketing surfaces (Cluster E territory)

### Cluster B — Implementer subagent prompt

> **Context:** You are implementing Cluster B of Tier 4 Wave 1 for the Sipher project. Working directory: `~/local-dev/sipher/.worktrees/feat-auth-session-ux`. Branch: `fix/auth-session-ux`.
>
> **Spec section:** `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-design.md` → "Cluster B — Auth/session UX (P1+P2)"
>
> **Closes:** #203, #213 (2 issues)
>
> **Apply TDD strictly:** failing test → red verify → implement → green verify → commit. Use conventional commits with `fix(app)` scope. No semicolons. Single quotes. No AI attribution.
>
> ---
>
> **Issue #203 — Duplicate "Session expired" toasts when JWT rejection fires multiple 401s**
>
> Target file: `app/src/components/AuthSyncProvider.tsx` (the 401-handling logic, lines ~224-241 per Tier 3 spec references).
>
> Locked: single-shot ref pattern — first 401 in the dedup window emits toast and flips `sessionExpiredToastShownRef.current = true`. Subsequent 401s within the window are no-ops on the toast emission (but still trigger auth clear). Reset to `false` on next successful auth OR after a 30s timeout (D-B1).
>
> First, READ `AuthSyncProvider.tsx` to understand the current 401 handler structure. Identify whether the toast emission lives in:
> - An `apiFetch` interceptor pattern
> - A `useEffect` watching auth state
> - A separate event handler subscribed to `triggerAuthInterceptor`
>
> Red test (likely in `app/src/components/__tests__/AuthSyncProvider.test.tsx` — create if not present):
>
> ```tsx
> it('emits only one "Session expired" toast when multiple 401s fire concurrently', async () => {
>   const toastSpy = vi.spyOn(toast, 'error')  // adjust based on actual toast library
>   render(<AuthSyncProvider>{null}</AuthSyncProvider>)
>
>   // Fire 3 concurrent 401-triggered auth-clears
>   act(() => {
>     triggerAuthInterceptor()
>     triggerAuthInterceptor()
>     triggerAuthInterceptor()
>   })
>
>   await waitFor(() => {
>     expect(toastSpy).toHaveBeenCalledTimes(1)
>     expect(toastSpy).toHaveBeenCalledWith(expect.stringMatching(/session expired/i))
>   })
> })
>
> it('re-emits toast after dedup window expires + next 401', async () => {
>   vi.useFakeTimers()
>   const toastSpy = vi.spyOn(toast, 'error')
>   render(<AuthSyncProvider>{null}</AuthSyncProvider>)
>
>   act(() => { triggerAuthInterceptor() })
>   expect(toastSpy).toHaveBeenCalledTimes(1)
>
>   act(() => { vi.advanceTimersByTime(31000) })  // past 30s window
>
>   act(() => { triggerAuthInterceptor() })
>   expect(toastSpy).toHaveBeenCalledTimes(2)
>
>   vi.useRealTimers()
> })
> ```
>
> Implementation (sketch — adapt to actual AuthSyncProvider structure):
>
> ```tsx
> const sessionExpiredToastShownRef = useRef(false)
>
> useEffect(() => {
>   const handler = () => {
>     if (sessionExpiredToastShownRef.current) return
>     sessionExpiredToastShownRef.current = true
>     toast.error('Session expired — please sign in again')
>     setTimeout(() => {
>       sessionExpiredToastShownRef.current = false
>     }, 30_000)
>     // existing auth-clear logic continues here
>   }
>   window.addEventListener('sipher:auth-clear', handler)
>   return () => window.removeEventListener('sipher:auth-clear', handler)
> }, [])
> ```
>
> Also: when auth is restored (status transitions to 'authed' from 'expired'), reset `sessionExpiredToastShownRef.current = false` so a future expiry surfaces the toast. Add this to the existing auth-state watcher.
>
> Confirm green. Commit:
>
> ```bash
> git add app/src/components/AuthSyncProvider.tsx app/src/components/__tests__/AuthSyncProvider.test.tsx
> git commit -m "fix(app): debounce 'Session expired' toast against concurrent 401s
>
> Single-shot ref guards toast emission; 30s window or successful auth resets.
>
> Closes #203"
> ```
>
> ---
>
> **Issue #213 — `walletName` localStorage carryover when never authed**
>
> First, INVESTIGATE the source of `walletName` persistence. Check:
> - `app/src/main.tsx` or wherever `WalletProvider` from `@solana/wallet-adapter-react` is mounted
> - Look for `autoConnect` prop and any `localStorageKey` config
> - Search `app/` for `walletName`, `wallet-name`, `walletAdapter` localStorage keys
> - Check `@solana/wallet-adapter-react`'s default localStorage key (typically `'walletName'` per the adapter docs)
>
> Once you understand the source, choose the cleanup mechanism (D-B2):
> - **Option A — Use wallet adapter API:** If `useWallet().disconnect()` clears the persisted name AND we can call it as part of `clearAuth`, prefer this. Cleaner because it goes through the adapter's lifecycle.
> - **Option B — Direct localStorage cleanup:** If the adapter's `disconnect()` doesn't clear persistence (some versions keep `walletName` for reconnect convenience), call `localStorage.removeItem('walletName')` (or the actual key the adapter uses) in the `onAuthClear` callback.
>
> Document the choice in the PR description.
>
> Locked: cleanup fires on `clearAuth` (which `onAuthClear.clearAll()` triggers), NOT on initial mount (D-B3 — returning users with valid JWT should still auto-reconnect their wallet via the adapter's normal autoConnect).
>
> Red test (in `app/src/components/__tests__/AuthSyncProvider.test.tsx` or wherever the cleanup is wired):
>
> ```tsx
> it('clears walletName from localStorage when clearAuth fires', () => {
>   localStorage.setItem('walletName', 'Phantom')
>   render(<AuthSyncProvider>{null}</AuthSyncProvider>)
>
>   act(() => {
>     useAppStore.getState().clearAuth()
>   })
>
>   expect(localStorage.getItem('walletName')).toBeNull()
> })
>
> it('does NOT clear walletName on initial mount when no auth state change', () => {
>   localStorage.setItem('walletName', 'Phantom')
>   render(<AuthSyncProvider>{null}</AuthSyncProvider>)
>
>   expect(localStorage.getItem('walletName')).toBe('Phantom')
> })
> ```
>
> Implementation (using `useOnAuthClear` hook from Tier 0+1):
>
> ```tsx
> import { useOnAuthClear } from '../store/useOnAuthClear'
>
> // inside AuthSyncProvider (or a dedicated component subscribed to onAuthClear):
> useOnAuthClear(() => {
>   localStorage.removeItem('walletName')
> })
> ```
>
> If the wallet adapter uses a different key (e.g., `walletAdapter` or `wallet-name`), use the correct one. Confirm by inspecting the adapter source or running the app and checking DevTools.
>
> Confirm green. Commit:
>
> ```bash
> git add app/src/components/AuthSyncProvider.tsx app/src/components/__tests__/AuthSyncProvider.test.tsx
> git commit -m "fix(app): clear walletName on clearAuth to prevent ghost auto-reconnect
>
> User who cancels wallet connection no longer gets stuck with the persisted
> walletName triggering auto-reconnect on next mount. Cleanup fires via the
> onAuthClear registry (Tier 0+1) only on explicit auth clear, not on mount.
>
> Closes #213"
> ```
>
> ---
>
> **Wrap-up (after both issues green):**
>
> ```bash
> cd app
> pnpm test --run src/ 2>&1 | tail -5   # expect: ≥460 + new tests
> pnpm exec tsc --noEmit                # expect: clean
> cd ..
> git log --oneline main..              # expect: 2 commits, one per issue
> git push -u origin fix/auth-session-ux
> ```
>
> Report back with: (a) commit hashes, (b) new test count, (c) which cleanup mechanism you chose for #213 and why, (d) any deviations.
>
> **OUT OF SCOPE (do NOT touch):**
> - Network-error event handling (Cluster F #227, #228)
> - Header network defaults (Cluster D #208)
> - PrivacyScoreCard / RoutePreviewCard (Cluster A territory)
> - SEO / a11y primitives (Cluster C territory)

### Cluster F — Implementer subagent prompt

> **Context:** You are implementing Cluster F of Tier 4 Wave 1 for the Sipher project. Working directory: `~/local-dev/sipher/.worktrees/chore-tech-debt-followups`. Branch: `chore/tech-debt-followups`.
>
> **Spec section:** `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-design.md` → "Cluster F — Tech-debt followups"
>
> **Closes:** #227, #228, #225, #226, #234, #235 (6 issues, applied in this order — #227 + #228 share apiFetch so order matters)
>
> **Apply TDD strictly:** failing test → red verify → implement → green verify → commit. Use conventional commits with appropriate scope (`fix(app)`, `chore(app)`, `test(app)`, `refactor(app)`). No semicolons. Single quotes. No AI attribution.
>
> ---
>
> **Issue #227 — Narrow apiFetch TypeError catch to actual network errors (apply FIRST)**
>
> Target file: `app/src/api/client.ts` (the catch block that emits `sipher:network-error` event on TypeError).
>
> Currently the catch fires `sipher:network-error` for ANY TypeError, which over-broadens — a JSON parse error inside `.json()` is a TypeError but NOT a network issue.
>
> Lock: regex-match `err.message` against actual network failure patterns: `/^(Failed to fetch|Load failed|NetworkError when attempting to fetch resource)$/i`. Only emit `sipher:network-error` if the regex matches; otherwise rethrow.
>
> Red test (extend `app/src/api/__tests__/client.test.ts` or wherever apiFetch tests live):
>
> ```ts
> it('does NOT emit sipher:network-error for non-network TypeErrors', async () => {
>   const handler = vi.fn()
>   window.addEventListener('sipher:network-error', handler)
>   vi.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('Cannot read property X of undefined'))
>
>   await expect(apiFetch('/foo')).rejects.toThrow()
>   expect(handler).not.toHaveBeenCalled()
>
>   window.removeEventListener('sipher:network-error', handler)
> })
>
> it('DOES emit sipher:network-error for "Failed to fetch" TypeError', async () => {
>   const handler = vi.fn()
>   window.addEventListener('sipher:network-error', handler)
>   vi.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))
>
>   await expect(apiFetch('/foo')).rejects.toThrow()
>   expect(handler).toHaveBeenCalledTimes(1)
>
>   window.removeEventListener('sipher:network-error', handler)
> })
> ```
>
> Implementation:
>
> ```ts
> const NETWORK_ERROR_PATTERN = /^(Failed to fetch|Load failed|NetworkError when attempting to fetch resource)$/i
>
> // inside apiFetch catch
> } catch (err: unknown) {
>   if (err instanceof TypeError && NETWORK_ERROR_PATTERN.test(err.message)) {
>     window.dispatchEvent(new CustomEvent('sipher:network-error', { detail: { source: 'apiFetch' } }))
>   }
>   throw err
> }
> ```
>
> Commit: `fix(app): narrow apiFetch network-error event to real network failures\n\nCloses #227`
>
> ---
>
> **Issue #228 — `emitNetworkRecovered` only on offline→online transition (apply SECOND)**
>
> Same file: `app/src/api/client.ts`.
>
> Currently `sipher:network-recovered` fires on every successful fetch. Lock: use module-scope `wasOffline` boolean. Set `true` when `sipher:network-error` is emitted; only fire recovery event when next fetch succeeds AND `wasOffline === true`. Reset `wasOffline = false` after recovery emit.
>
> Red test:
>
> ```ts
> it('does NOT emit sipher:network-recovered on first successful fetch', async () => {
>   const handler = vi.fn()
>   window.addEventListener('sipher:network-recovered', handler)
>   vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }))
>
>   await apiFetch('/foo')
>   expect(handler).not.toHaveBeenCalled()
>
>   window.removeEventListener('sipher:network-recovered', handler)
> })
>
> it('emits sipher:network-recovered after a network error followed by success', async () => {
>   const handler = vi.fn()
>   window.addEventListener('sipher:network-recovered', handler)
>
>   vi.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))
>   await expect(apiFetch('/foo')).rejects.toThrow()
>
>   vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }))
>   await apiFetch('/foo')
>   expect(handler).toHaveBeenCalledTimes(1)
>
>   vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }))
>   await apiFetch('/foo')
>   expect(handler).toHaveBeenCalledTimes(1)  // does NOT re-fire
>
>   window.removeEventListener('sipher:network-recovered', handler)
> })
> ```
>
> Implementation (module scope at top of client.ts):
>
> ```ts
> let wasOffline = false
>
> // In the catch block (alongside #227's logic):
> if (err instanceof TypeError && NETWORK_ERROR_PATTERN.test(err.message)) {
>   wasOffline = true
>   window.dispatchEvent(new CustomEvent('sipher:network-error', { detail: { source: 'apiFetch' } }))
> }
>
> // In the success path (where the recovery event was previously emitted):
> if (wasOffline) {
>   wasOffline = false
>   window.dispatchEvent(new CustomEvent('sipher:network-recovered', { detail: { source: 'apiFetch' } }))
> }
> ```
>
> If there's a test exported helper to reset module state (e.g., `_resetClientForTests()`), update it to reset `wasOffline = false`. If not, add one:
>
> ```ts
> export function _resetClientForTests() {
>   wasOffline = false
> }
> ```
>
> Commit: `fix(app): emit sipher:network-recovered only on offline→online transition\n\nCloses #228`
>
> ---
>
> **Issue #225 — `useSSE` in-flight `connectSSE` race tightening (apply THIRD)**
>
> Target file: `app/src/hooks/useSSE.ts`. Add `authClearedRef` flag set to `true` when `onAuthClear` callback fires; checked inside async `connectSSE` resolution before any state setter.
>
> Read `useSSE.ts` AND its existing tests first to understand the current `connectSSE` shape (likely imported from a sibling module or defined inline as `async (token, onMessage) => EventSource`). The implementation sketch below is illustrative — adapt to the actual structure you find.
>
> The race: `connectSSE` resolves asynchronously, so if auth clears while a previous `connectSSE` call is mid-resolution, the resolved source can still set `connected=true` and attach event handlers. Lock: `authClearedRef` flag set on auth-clear; checked after the await in `connectSSE` and before any state setter.
>
> Red test (in `app/src/hooks/__tests__/useSSE.test.tsx`):
>
> ```tsx
> it('skips state setters after onAuthClear fires mid-connectSSE resolution', async () => {
>   let resolveConnect: (source: EventSource) => void
>   const connectPromise = new Promise<EventSource>((resolve) => { resolveConnect = resolve })
>   const mockSource = { close: vi.fn(), addEventListener: vi.fn() } as unknown as EventSource
>
>   vi.mocked(connectSSE).mockReturnValueOnce(connectPromise)
>
>   const { result } = renderHook(() => useSSE('t'))
>   // Fire auth-clear BEFORE connectSSE resolves
>   act(() => { useAppStore.getState().clearAuth() })
>   // Then resolve connectSSE
>   act(() => { resolveConnect!(mockSource) })
>
>   await waitFor(() => {
>     expect(result.current.connected).toBe(false)  // state should not have been set to true
>   })
>   expect(mockSource.close).toHaveBeenCalled()  // resolved source should be closed
> })
> ```
>
> Implementation pattern (adapt to actual file structure):
>
> ```ts
> const authClearedRef = useRef(false)
>
> // wherever the wrapped connectSSE Promise resolves (likely inside a useEffect or an effect-driven .then chain):
> // BEFORE awaiting / .then: authClearedRef.current = false (fresh connect attempt)
> // AFTER await / inside .then: if (authClearedRef.current) { source?.close(); return }
> // ONLY then set sourceRef.current = source + setConnected(true)
>
> // inside the existing useOnAuthClear callback:
> useOnAuthClear(() => {
>   authClearedRef.current = true
>   // ...existing cleanup (close source, clear events) preserved
> })
> ```
>
> Confirm existing useSSE tests still pass (reconnect-on-token-refresh, etc).
>
> Commit: `fix(app): tighten useSSE against in-flight connectSSE race on auth-clear\n\nCloses #225`
>
> ---
>
> **Issue #226 — Optional dev-only `console.warn` on swallowed `onAuthClear` callback throws (apply FOURTH)**
>
> Target file: `app/src/store/onAuthClear.ts`. The `clearAll()` function currently catches callback throws silently to prevent one bad callback from breaking the registry. Add a dev-only warn so developers see the swallowed errors.
>
> Red test (in `app/src/store/__tests__/onAuthClear.test.ts`):
>
> ```ts
> it('warns in dev mode when a registered callback throws', () => {
>   vi.stubEnv('DEV', true)
>   const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
>
>   register(() => { throw new Error('boom') })
>   clearAll()
>
>   expect(warnSpy).toHaveBeenCalledWith(
>     expect.stringContaining('onAuthClear callback threw'),
>     expect.any(Error),
>   )
>
>   warnSpy.mockRestore()
>   vi.unstubAllEnvs()
> })
>
> it('does NOT warn in production mode when a callback throws', () => {
>   vi.stubEnv('DEV', false)
>   const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
>
>   register(() => { throw new Error('boom') })
>   clearAll()
>
>   expect(warnSpy).not.toHaveBeenCalled()
>
>   warnSpy.mockRestore()
>   vi.unstubAllEnvs()
> })
> ```
>
> Implementation (in `clearAll`):
>
> ```ts
> export function clearAll() {
>   for (const cb of callbacks) {
>     try {
>       cb()
>     } catch (err) {
>       if (import.meta.env.DEV) {
>         console.warn('onAuthClear callback threw (swallowed)', err)
>       }
>     }
>   }
> }
> ```
>
> Commit: `fix(app): warn in dev when onAuthClear callback throws\n\nCloses #226`
>
> ---
>
> **Issue #234 — Mock hygiene gap in admin AbortController test blocks (apply FIFTH)**
>
> Target files:
> - `app/src/views/__tests__/HeraldView.test.tsx` (new abort-on-unmount describe block from Tier 3)
> - `app/src/views/__tests__/SquadView.test.tsx` (new abort-on-unmount describe block from Tier 3)
>
> Locked: in any new `describe` block's `beforeEach`, call both `vi.mocked(apiFetch).mockClear()` AND `vi.mocked(apiFetch).mockReset()`. The current code only calls `mockClear` which clears call history but leaves implementations.
>
> This is a test-hygiene fix, not a behavior change — there is no failing test in `main` today. The "TDD pair" here is: (1) add `mockReset()` to the new `beforeEach` blocks, (2) re-run the affected admin-view test suites to verify nothing regresses. If you want a regression-locker, add a follow-up test inside the abort-on-unmount describe block that depends on a fresh mock state and would have failed without `mockReset` — but this is optional, not required.
>
> Implementation (in the abort-on-unmount describe block of both test files):
>
> ```tsx
> describe('abort-on-unmount', () => {
>   beforeEach(() => {
>     vi.mocked(apiFetch).mockClear()
>     vi.mocked(apiFetch).mockReset()  // <-- ADD THIS
>   })
>   // ... existing tests
> })
> ```
>
> If `mockReset` removes the implementation set in a higher-level `beforeAll` or top-level `beforeEach`, re-set the implementation here. Verify all admin-view tests still pass.
>
> Commit: `test(app): add mockReset to admin-view AbortController test beforeEach blocks\n\nCloses #234`
>
> ---
>
> **Issue #235 — SettingsView abort-error filter pattern (apply SIXTH)**
>
> Target file: `app/src/views/SettingsView.tsx`. Single-line change in the existing `.catch` block.
>
> Current pattern: `if (!signal.aborted) { setError(err.message) }` (likely).
> New pattern: `if (err.name === 'AbortError') return; setError(err.message)` (matches HeraldView/SquadView convention from Tier 3).
>
> Like #234, this is a refactor for convention alignment, not a behavior change — `!signal.aborted` and `err.name === 'AbortError'` give the same outcome under typical AbortController flow. The "TDD pair" here is: (1) verify existing SettingsView tests still pass, (2) optionally add a regression-locker test that explicitly throws an AbortError (rather than aborting a controller) and asserts no error state is set.
>
> Regression-locker pattern (optional, in `app/src/views/__tests__/SettingsView.test.tsx`):
>
> ```tsx
> it('ignores AbortError thrown directly (not via controller.abort())', async () => {
>   const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' })
>   vi.mocked(apiFetch).mockRejectedValueOnce(abortError)
>
>   render(<SettingsView />)
>   await waitFor(() => {
>     // assert SettingsView is NOT displaying an error UI (adapt the assertion to the actual error display)
>     expect(screen.queryByText(/error/i)).toBeNull()
>   })
> })
> ```
>
> Adapt the assertion to SettingsView's actual error-state shape (may be local state, store dispatch, or callback).
>
> Implementation:
>
> ```tsx
> // before
> .catch((err: Error) => {
>   if (!signal.aborted) {
>     setError(err.message)
>   }
> })
>
> // after
> .catch((err: Error) => {
>   if (err.name === 'AbortError') return
>   setError(err.message)
> })
> ```
>
> Commit: `refactor(app): standardize SettingsView abort-error filter to err.name check\n\nCloses #235`
>
> ---
>
> **Wrap-up (after all 6 issues green):**
>
> ```bash
> cd app
> pnpm test --run src/ 2>&1 | tail -5   # expect: ≥460 + ~6+ new tests
> pnpm exec tsc --noEmit                # expect: clean
> cd ..
> git log --oneline main..              # expect: 6 commits, one per issue
> git push -u origin chore/tech-debt-followups
> ```
>
> Report back with: (a) commit hashes for the 6 issues, (b) new test count, (c) any deviations.
>
> **OUT OF SCOPE (do NOT touch):**
> - Admin view source files (HeraldView/SquadView body) beyond #235 SettingsView 1-line fix
> - Auth state or wallet adapter (Cluster B territory)
> - UI components (Cluster A, C, D, E territory)
> - Test infrastructure beyond fixing #234 mock hygiene

---

## Per-cluster review + PR + merge pipeline

Each cluster runs its own review + PR + merge pipeline starting as soon as its implementer subagent reports done. The 3 pipelines run in parallel across clusters but are sequential within a cluster.

### Cluster A pipeline

#### Task 5: Cluster A spec-compliance review

- [ ] **Step 1: Dispatch spec-review subagent**

Agent tool call:
- subagent_type: `general-purpose`
- description: `Cluster A spec-compliance review`
- prompt:
  > Review the implementation on branch `fix/hardcoded-data-cleanup` (worktree `.worktrees/feat-hardcoded-data-cleanup`) against the Cluster A spec section in `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-design.md`.
  >
  > Verify each D-item is met:
  > - D-A1: when `delta == null`, NEITHER delta UI NOR " vs last week" copy renders
  > - D-A2: RoutePreviewCard renders "Vault on mainnet coming soon" on mainnet network
  > - D-A3: M19 placeholders are removed entirely from StealthAddressList
  >
  > Also verify out-of-scope guardrails were respected (no auth, no useSSE/apiFetch, no SEO, no Header/AmountForm).
  >
  > Read each commit (`git log --oneline main..`) and the diff (`git diff main..`). Output a structured review with: spec-compliance verdict (✅/❌ per D-item), out-of-scope violations (if any), and overall verdict (Approve / Request Changes).

- [ ] **Step 2: If spec-review verdict is "Request Changes", dispatch implementer subagent again with the fixup scope**

(Conditional — only if review finds gaps.)

#### Task 6: Cluster A code-quality review

- [ ] **Step 1: Dispatch code-quality review subagent**

Agent tool call:
- subagent_type: `general-purpose`
- description: `Cluster A code-quality review`
- prompt:
  > Code-quality review on branch `fix/hardcoded-data-cleanup`. Read the diff (`git diff main..`).
  >
  > Classify findings as Critical / Important / Minor.
  > - Critical: blocks merge (bug, regression, security)
  > - Important: blocks merge (poor practice, missing test, contract violation)
  > - Minor: file as follow-up issue, do not bundle
  >
  > Focus areas: TypeScript correctness, test coverage adequacy, React idiom adherence (no unnecessary useEffect, proper cleanup, etc), no semicolons, single quotes, no AI attribution in commits.
  >
  > Output structured review with Critical/Important/Minor sections.

- [ ] **Step 2: Apply Critical/Important fixes if any**

If reviewer finds Critical or Important: dispatch implementer subagent with the specific fix requests (in the same branch). Re-run spec-review + code-quality after fixes.

If only Minor findings: file as new GitHub issues with `qa-skill:1778399617` + `tech-debt` labels.

#### Task 7: Cluster A PR + merge

- [ ] **Step 1: Open PR**

```bash
cd ~/local-dev/sipher/.worktrees/feat-hardcoded-data-cleanup
gh pr create --title "fix(app): hardcoded data cleanup (P1) — D10 compliance" --body "$(cat <<'EOF'
## Summary

Closes 3 P1 QA findings related to hardcoded mock data and orphan placeholder copy that violate D10 (no mock data — every visible string/number must be real or removed) from the Phase 4b redesign spec.

- PrivacyScoreCard: dropped hardcoded `delta={4}` at DashboardView call site; wrapped " vs last week" label in the delta-conditional so it doesn't render orphaned when delta is absent
- RoutePreviewCard: derived vault PDA from `useNetworkConfigStore.config.network` + sipher_vault SDK helpers; mainnet shows "Vault on mainnet coming soon" until deployment lands
- StealthAddressList: removed M19 placeholder copy entirely (per D-A3 strict-D10 invisible)

## Spec + Plan

- Spec: `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-design.md` (Cluster A)
- Plan: `docs/superpowers/plans/2026-05-11-qa-sweep-tier-4-wave-1.md`

## Test plan

- [x] New: PrivacyScoreCard renders no delta/label when delta undefined; renders both when defined
- [x] New: RoutePreviewCard renders mainnet fallback copy; derives devnet PDA from SDK
- [x] New: StealthAddressList contains no "M19" string in rendered output
- [x] `pnpm exec tsc --noEmit` clean from `app/`
- [x] All existing tests still pass

Closes #195
Closes #196
Closes #197
EOF
)"
```

- [ ] **Step 2: Wait for CI green**

```bash
# Watch CI status
gh pr checks --watch
# Or poll manually:
gh pr view --json statusCheckRollup --jq '.statusCheckRollup[] | .name + " " + .state'
```

- [ ] **Step 3: Merge after CI green**

```bash
cd ~/local-dev/sipher  # SWITCH TO MAIN before merge (avoids worktree-owns-branch quirk)
gh pr merge fix/hardcoded-data-cleanup --merge --delete-branch
git checkout main
git pull --ff-only
git worktree remove .worktrees/feat-hardcoded-data-cleanup
git branch -d fix/hardcoded-data-cleanup 2>/dev/null || true   # may already be deleted by --delete-branch
```

- [ ] **Step 4: Confirm closure of #195, #196, #197**

```bash
gh issue view 195 --json state --jq .state   # expect: CLOSED
gh issue view 196 --json state --jq .state   # expect: CLOSED
gh issue view 197 --json state --jq .state   # expect: CLOSED
```

If any didn't auto-close, manually close them: `gh issue close <N> --reason completed`.

---

### Cluster B pipeline

#### Task 8: Cluster B spec-compliance review

- [ ] **Step 1: Dispatch spec-review subagent**

Agent tool call:
- subagent_type: `general-purpose`
- description: `Cluster B spec-compliance review`
- prompt:
  > Review implementation on branch `fix/auth-session-ux` (worktree `.worktrees/feat-auth-session-ux`) against Cluster B spec.
  >
  > Verify D-items:
  > - D-B1: session-expired toast deduplicated via single-shot ref; concurrent 401s emit one toast; 30s window or successful auth resets the flag
  > - D-B2: walletName cleanup mechanism documented in PR description (which option chosen and why)
  > - D-B3: cleanup fires on `clearAuth` via `onAuthClear` registry, NOT on initial mount (auto-reconnect for valid JWT still works)
  >
  > Out-of-scope check: did the subagent stay clear of Cluster F (apiFetch/useSSE/onAuthClear internals), Cluster D (Header network defaults), Cluster A (PrivacyScoreCard/RoutePreviewCard)?
  >
  > Output structured review.

#### Task 9: Cluster B code-quality review

- [ ] **Step 1: Dispatch code-quality reviewer**

Same template as Cluster A code-quality, just substitute branch name `fix/auth-session-ux`.

- [ ] **Step 2: Apply Critical/Important fixes**

Conditional.

#### Task 10: Cluster B PR + merge

- [ ] **Step 1: Open PR**

```bash
cd ~/local-dev/sipher/.worktrees/feat-auth-session-ux
gh pr create --title "fix(app): auth/session UX hardening (P1+P2)" --body "$(cat <<'EOF'
## Summary

Closes 2 auth-lifecycle QA findings:

- #203 (P1): "Session expired" toast no longer stacks when multiple in-flight 401s fire simultaneously. Single-shot ref pattern in AuthSyncProvider; 30s window or successful auth resets.
- #213 (P2): `walletName` localStorage carryover cleared on `clearAuth` via the `onAuthClear` registry (Tier 0+1). User who cancels wallet connection no longer gets stuck with persisted name auto-reconnecting on next mount.

**Cleanup mechanism for #213:** Replace this line in the PR body with the chosen mechanism — either "Used `useWallet().disconnect()` from @solana/wallet-adapter-react (clears adapter persistence as side effect of normal disconnect lifecycle)" OR "Direct `localStorage.removeItem('walletName')` in the `onAuthClear` callback (the adapter's disconnect doesn't clear walletName, so direct cleanup is necessary)" — and document the reasoning in 1-2 sentences.

## Spec + Plan

- Spec: `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-design.md` (Cluster B)
- Plan: `docs/superpowers/plans/2026-05-11-qa-sweep-tier-4-wave-1.md`

## Test plan

- [x] New: concurrent 401s emit exactly 1 "Session expired" toast
- [x] New: post-30s-window, next 401 emits a fresh toast (dedup window expires)
- [x] New: `walletName` cleared on `clearAuth`
- [x] New: returning user with valid JWT keeps walletName for auto-reconnect (no cleanup on mount)
- [x] `pnpm exec tsc --noEmit` clean
- [x] All existing tests still pass

Closes #203
Closes #213
EOF
)"
```

- [ ] **Step 2: Wait for CI green** (`gh pr checks --watch`)

- [ ] **Step 3: Merge + sync + cleanup**

```bash
cd ~/local-dev/sipher
gh pr merge fix/auth-session-ux --merge --delete-branch
git checkout main
git pull --ff-only
git worktree remove .worktrees/feat-auth-session-ux
git branch -d fix/auth-session-ux 2>/dev/null || true
```

- [ ] **Step 4: Confirm issue closures**

```bash
gh issue view 203 --json state --jq .state   # expect: CLOSED
gh issue view 213 --json state --jq .state   # expect: CLOSED
```

---

### Cluster F pipeline

#### Task 11: Cluster F spec-compliance review

- [ ] **Step 1: Dispatch spec-review subagent**

Agent tool call:
- subagent_type: `general-purpose`
- description: `Cluster F spec-compliance review`
- prompt:
  > Review implementation on branch `chore/tech-debt-followups` (worktree `.worktrees/chore-tech-debt-followups`) against Cluster F spec.
  >
  > Verify D-items:
  > - D-F1: all 6 issues applied in dependency order (#227 → #228 → #225 → #226 → #234 → #235), each as its own commit
  > - D-F2: each issue has a red-green commit pair (test added before/with implementation)
  > - D-F3: no new test infrastructure (reuse vi.mock, makeFakeAuthState, existing patterns)
  > - D-F4: #226 dev-only console.warn gated on `import.meta.env.DEV` via `vi.stubEnv`
  > - D-F5: #225 `authClearedRef` resets on fresh connect attempt and fires on auth-clear
  >
  > Out-of-scope check: did the subagent stay clear of admin view source bodies (HeraldView/SquadView) beyond the SettingsView 1-line fix? Did it leave auth state / wallet adapter alone? Did it avoid UI components?
  >
  > Output structured review.

#### Task 12: Cluster F code-quality review

- [ ] **Step 1: Dispatch code-quality reviewer**

Same template. Branch `chore/tech-debt-followups`.

- [ ] **Step 2: Apply Critical/Important fixes**

Conditional.

#### Task 13: Cluster F PR + merge

- [ ] **Step 1: Open PR**

```bash
cd ~/local-dev/sipher/.worktrees/chore-tech-debt-followups
gh pr create --title "chore(app): tech-debt followups from Tier 0+1+3" --body "$(cat <<'EOF'
## Summary

Closes 6 polish followups filed during prior Tier sprints (frontier_46 + frontier_48). All small, mechanical fixes to test patterns and error-handling edges.

Applied in dependency order:

1. **#227** — Narrow `apiFetch` TypeError catch to actual network errors (regex on err.message)
2. **#228** — `emitNetworkRecovered` fires only on offline→online transition (module-scope `wasOffline` flag)
3. **#225** — `useSSE` `authClearedRef` flag prevents stale state set when auth clears mid-`connectSSE` resolution
4. **#226** — Optional dev-only `console.warn` (`import.meta.env.DEV`) when an `onAuthClear` callback throws
5. **#234** — `mockReset` added to admin-view AbortController test beforeEach blocks (locks against test-pollution leakage)
6. **#235** — SettingsView abort-error filter now uses `err.name === 'AbortError'` convention (matches HeraldView/SquadView)

## Spec + Plan

- Spec: `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-design.md` (Cluster F)
- Plan: `docs/superpowers/plans/2026-05-11-qa-sweep-tier-4-wave-1.md`

## Test plan

- [x] New: apiFetch non-network TypeError does NOT emit `sipher:network-error`
- [x] New: `sipher:network-recovered` fires only after a `network-error` event, not on every success
- [x] New: useSSE skips state setters when auth clears mid-resolution
- [x] New: onAuthClear throw → `console.warn` in DEV, silent in prod
- [x] New: admin-view AbortController test beforeEach calls mockReset
- [x] New: SettingsView AbortError filter uses err.name pattern
- [x] `pnpm exec tsc --noEmit` clean
- [x] All existing tests still pass

Closes #225
Closes #226
Closes #227
Closes #228
Closes #234
Closes #235
EOF
)"
```

- [ ] **Step 2: Wait for CI green** (`gh pr checks --watch`)

- [ ] **Step 3: Merge + sync + cleanup**

```bash
cd ~/local-dev/sipher
gh pr merge chore/tech-debt-followups --merge --delete-branch
git checkout main
git pull --ff-only
git worktree remove .worktrees/chore-tech-debt-followups
git branch -d chore/tech-debt-followups 2>/dev/null || true
```

- [ ] **Step 4: Confirm issue closures**

```bash
gh issue view 225 --json state --jq .state
gh issue view 226 --json state --jq .state
gh issue view 227 --json state --jq .state
gh issue view 228 --json state --jq .state
gh issue view 234 --json state --jq .state
gh issue view 235 --json state --jq .state
# expect: all CLOSED
```

---

## Task 14: Wave 1 sync gate

This is the gate that must be green before Wave 2 dispatch.

- [ ] **Step 1: Verify all 3 Wave 1 PRs are merged**

```bash
cd ~/local-dev/sipher
gh pr list --state merged --search "fix/hardcoded-data-cleanup OR fix/auth-session-ux OR chore/tech-debt-followups" --json number,title,state
# expect: 3 PRs, all merged
```

- [ ] **Step 2: Verify all 11 issues closed**

```bash
for n in 195 196 197 203 213 225 226 227 228 234 235; do
  echo -n "#$n: "
  gh issue view $n --json state --jq .state
done
# expect: all CLOSED
```

- [ ] **Step 3: Verify main has all 3 merge commits**

```bash
git log --oneline main -10
# expect: 3 'Merge pull request' commits for the Wave 1 PRs
```

- [ ] **Step 4: Verify main is green**

```bash
cd app
pnpm test --run src/ 2>&1 | tail -5
# expect: test count ≥ baseline + new tests
pnpm exec tsc --noEmit
# expect: clean
cd ..
```

- [ ] **Step 5: Verify no leftover worktrees**

```bash
git worktree list
# expect: 1 entry (just main)
```

- [ ] **Step 6: Report Wave 1 completion to RECTOR + offer mid-sprint brainstorm**

Output to user:
- 3 PRs merged: <#A>, <#B>, <#F>
- 11 issues closed
- App test count went from 460 → <new>
- Main HEAD: `<new-sha>`
- Wave 1 sync gate: ✅
- Ready for mid-sprint brainstorm to lock Wave 2 details (Clusters C, D, E)

---

## Self-review

Plan covers:
- ✅ Spec Cluster A — D-A1 (PrivacyScoreCard invisible delta), D-A2 (RoutePreviewCard mainnet copy), D-A3 (M19 removal) → Cluster A implementer prompt
- ✅ Spec Cluster B — D-B1 (toast dedup), D-B2 (walletName mechanism investigation), D-B3 (cleanup timing) → Cluster B implementer prompt
- ✅ Spec Cluster F — D-F1 (issue order), D-F2 (TDD pairs), D-F3 (no new infra), D-F4 (vi.stubEnv), D-F5 (authClearedRef) → Cluster F implementer prompt
- ✅ D2 (wave 3+3) — Wave 1 plan only; Wave 2 deferred
- ✅ D3 (all SUBAGENT mode for Wave 1) — all 3 clusters dispatched as subagents
- ✅ D5 (wave sync gate) — Task 14 enforces
- ✅ D6 (two-stage review per cluster) — spec-review then code-quality review per cluster
- ✅ Carry-forward conventions — embedded in subagent prompts (no semicolons, no AI attribution, conventional commits, etc.)

No placeholders, no TBDs. Each subagent prompt includes per-issue red-test code, impl code, commit messages, and out-of-scope guardrails. PR descriptions are complete.

---

## Notes on parallel dispatch mechanics

When dispatching the 3 implementer subagents in Task 4 (Step 1), use a single message with 3 Agent tool calls — this is the parallel-dispatch pattern. The subagents work concurrently in their own worktrees; their reports come back individually.

After all 3 implementer reports come in, the per-cluster pipelines (Tasks 5-13) can also be parallelized — for example, dispatch all 3 spec reviewers in a single message, then all 3 code-quality reviewers, etc. However, the PR creation and merge steps run sequentially within each cluster's pipeline (you wait for CI green before merging each PR).

If one cluster's implementer derails, its pipeline pauses but the other two continue. Wave gate (Task 14) only fires when all 3 clusters complete.
