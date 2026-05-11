# QA Sweep Tier 4 Wave 2a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Wave 2a of the QA sweep — 10 qa-skill issues across Clusters C (a11y+SEO), D (network/asset alignment), E1 (marketing polish) — via 3-cluster parallel SUBAGENT dispatch. Closes #206, #207, #208, #209, #210, #211, #214, #219, #220, #221.

**Architecture:** 3 independent feature branches dispatched in parallel via SUBAGENT mode. Each cluster ships as one PR (`feat/a11y-seo`, `fix/network-asset-alignment`, `feat/marketing-polish`). File-isolation between clusters except for `Header.tsx`, where D (#208 network data binding) and E1 (#219 connection-quality JSX badge) modify distinct sections. After all 3 merge, qa-skill open count drops 13 → 3 (E2 features deferred to next session).

**Tech Stack:** React 19 (native metadata auto-hoisting), Vite 6, Tailwind 4, Vitest, react-router-dom@7, @phosphor-icons/react, @sipher/sdk

**Predecessors:**
- Wave 1 plan `docs/superpowers/plans/2026-05-11-qa-sweep-tier-4-wave-1.md` (same patterns: TDD, two-stage review, PR-per-cluster, sequential merges)
- Tier 4 spec `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-design.md` (Wave 2 appendix — D12–D15 + per-cluster D-items)

---

## Pre-dispatch checklist

### Macro-task 1: Push spec + create worktrees + build SDK

- [ ] **Step 1.1: Push current main (with Wave 2 spec appendix) to origin**

Run:
```bash
cd ~/local-dev/sipher
git push origin main
```
Expected: pushes commit `a61fb04` (`docs(spec): append Wave 2 detail-locking to Tier 4 design`) plus this plan commit.

- [ ] **Step 1.2: Create worktree for Cluster C**

```bash
cd ~/local-dev/sipher
git worktree add .worktrees/feat-a11y-seo -b feat/a11y-seo origin/main
```

- [ ] **Step 1.3: Create worktree for Cluster D**

```bash
git worktree add .worktrees/fix-network-asset-alignment -b fix/network-asset-alignment origin/main
```

- [ ] **Step 1.4: Create worktree for Cluster E1**

```bash
git worktree add .worktrees/feat-marketing-polish -b feat/marketing-polish origin/main
```

- [ ] **Step 1.5: Install + build SDK in each worktree (3 parallel bg shells)**

Run 3 parallel `Bash` calls with `run_in_background=true`:

```bash
cd ~/local-dev/sipher/.worktrees/feat-a11y-seo && pnpm install --frozen-lockfile && pnpm --filter "@sipher/sdk" build
```
```bash
cd ~/local-dev/sipher/.worktrees/fix-network-asset-alignment && pnpm install --frozen-lockfile && pnpm --filter "@sipher/sdk" build
```
```bash
cd ~/local-dev/sipher/.worktrees/feat-marketing-polish && pnpm install --frozen-lockfile && pnpm --filter "@sipher/sdk" build
```

Wait for all 3 to complete.

- [ ] **Step 1.6: Verify each worktree has @noble/ciphers symlink + tests pass baseline**

```bash
for d in ~/local-dev/sipher/.worktrees/feat-a11y-seo ~/local-dev/sipher/.worktrees/fix-network-asset-alignment ~/local-dev/sipher/.worktrees/feat-marketing-polish; do
  ls "$d/app/node_modules/@noble/ciphers" >/dev/null 2>&1 && echo "OK $d" || echo "FAIL $d"
done
```
Expected: 3 "OK" lines.

Baseline test count in each worktree:
```bash
cd ~/local-dev/sipher/.worktrees/feat-a11y-seo/app && pnpm test --run 2>&1 | tail -5
```
Expected: `Tests  476 passed` (current main HEAD `22c535e` baseline post-Wave-1).

---

## Cluster C — A11y + SEO (subagent implementer prompt section)

**Branch:** `feat/a11y-seo`
**Worktree:** `~/local-dev/sipher/.worktrees/feat-a11y-seo/`
**Issues:** #206 (SEO/OG meta), #210 (Privacy Graph loading state), #211 (Toast role/aria-live), #214 (ChatSidebar input)
**Spec section:** `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-design.md` → "Wave 2a — Cluster C (A11y + SEO, P2)"
**Estimated:** 3-5h
**Convention:** Per-issue TDD red→green→commit. Conventional commits with `feat(app)` or `fix(app)` scope.

**Out-of-scope guardrails (verbatim — DO NOT cross these lines):**
- DON'T touch `Header.tsx` network data binding (Cluster D #208 territory).
- DON'T touch `AmountForm.tsx`, `TickerBar.tsx`, `DepositForm.tsx`, `WithdrawForm.tsx` (Cluster D).
- DON'T add connection-quality indicator to `Header.tsx` (Cluster E1 #219 territory).
- DON'T touch `BetaBanner.tsx` (Cluster E1 #220).
- DON'T edit `AboutView.tsx` body copy OR add Dashboard tagline (Cluster E1 #221) — meta tags only.
- DON'T touch E2 territory (demo mode, activity teaser, unauthed Ask SIPHER).

### Task 2.1: #206 — Per-route SEO + OG meta tags via React 19 native metadata

**Files:**
- Modify: `app/src/views/DashboardView.tsx`
- Modify: `app/src/views/VaultView.tsx`
- Modify: `app/src/views/ChainsView.tsx`
- Modify: `app/src/views/KeysView.tsx`
- Modify: `app/src/views/AboutView.tsx` (meta tags ONLY — do not edit body copy)
- Modify: `app/src/views/HeraldView.tsx`
- Modify: `app/src/views/SquadView.tsx`
- Modify: `app/src/views/SettingsView.tsx`
- Modify: `app/src/views/PrivacyReportView.tsx`
- Modify: `app/src/views/DepositView.tsx`
- Modify: `app/src/views/WithdrawView.tsx`
- Modify: `app/src/views/ChatView.tsx`
- Modify: `app/src/views/NotFoundView.tsx`
- Test: `app/src/views/__tests__/DashboardView.test.tsx` (add SEO test)
- Test: `app/src/views/__tests__/VaultView.test.tsx` (add SEO test)
- Test: `app/src/views/__tests__/NotFoundView.test.tsx` (add SEO test — verifies the per-route pattern works on the catch-all)

**Per-view title + description map:**

| View                | `<title>`                                    | `og:description`                                                                          |
| ------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| DashboardView (`/`) | `SIPHER — Multi-chain privacy command center` | `Multi-chain privacy command center for shielded transfers across 9+ chains.`             |
| VaultView           | `SIPHER — Vault`                             | `Shielded vault for private deposits and withdrawals on Solana.`                          |
| ChainsView          | `SIPHER — Chains`                            | `Multi-chain support spanning 9+ blockchains including Solana, Ethereum, and L2s.`         |
| KeysView            | `SIPHER — Keys`                              | `Manage viewing keys and stealth addresses for shielded transfers.`                       |
| AboutView           | `SIPHER — About`                             | `About SIPHER — privacy primitives, multi-chain support, and dual-identity architecture.` |
| HeraldView          | `SIPHER — Herald`                            | `Monitor HERALD agent activity and X interactions.`                                       |
| SquadView           | `SIPHER — Guardian Squad`                    | `SENTINEL guardian squad oversight and threat assessment.`                                |
| SettingsView        | `SIPHER — Settings`                          | `Configure network, privacy, and admin settings.`                                         |
| PrivacyReportView   | `SIPHER — Privacy Report`                    | `On-chain privacy score and surveillance exposure analysis.`                              |
| DepositView         | `SIPHER — Deposit`                           | `Deposit to shielded vault.`                                                              |
| WithdrawView        | `SIPHER — Withdraw`                          | `Withdraw from shielded vault to stealth address.`                                        |
| ChatView            | `SIPHER — Chat`                              | `Ask SIPHER about your privacy posture.`                                                  |
| NotFoundView        | `SIPHER — Not found`                         | `Page not found.`                                                                         |

**Tagline (used in DashboardView description AND #221 unauthed tagline — but #221 mounts the visible tagline; this task uses it ONLY in meta tag content):**
`Multi-chain privacy command center for shielded transfers across 9+ chains.`

- [ ] **Step 2.1.1: Write failing test for DashboardView SEO meta**

Append to `app/src/views/__tests__/DashboardView.test.tsx`:
```tsx
describe('SEO metadata', () => {
  it('renders document.title and og:title meta tags', async () => {
    render(<DashboardView />)
    await waitFor(() => {
      expect(document.title).toBe('SIPHER — Multi-chain privacy command center')
    })
    const ogTitle = document.querySelector('meta[property="og:title"]')
    expect(ogTitle?.getAttribute('content')).toBe('SIPHER — Multi-chain privacy command center')
    const ogDescription = document.querySelector('meta[property="og:description"]')
    expect(ogDescription?.getAttribute('content')).toBe(
      'Multi-chain privacy command center for shielded transfers across 9+ chains.',
    )
  })
})
```

Note: existing DashboardView test setup likely uses test-utils — match the existing setup pattern (auth state mocks, etc.).

- [ ] **Step 2.1.2: Run test to verify it fails**

```bash
cd ~/local-dev/sipher/.worktrees/feat-a11y-seo/app
pnpm test --run src/views/__tests__/DashboardView.test.tsx -t "SEO metadata"
```
Expected: FAIL — `document.title` mismatch or meta tag null.

- [ ] **Step 2.1.3: Implement meta tags inline in DashboardView**

Wrap the existing top-level JSX with a React fragment + metadata tags at the top:

```tsx
return (
  <>
    <title>SIPHER — Multi-chain privacy command center</title>
    <meta name="description" content="Multi-chain privacy command center for shielded transfers across 9+ chains." />
    <meta property="og:title" content="SIPHER — Multi-chain privacy command center" />
    <meta property="og:description" content="Multi-chain privacy command center for shielded transfers across 9+ chains." />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="/icons/sipher.svg" />
    {/* ... existing view content unchanged ... */}
  </>
)
```

If the view already returns a fragment or single root, augment that. React 19 auto-hoists `<title>` and `<meta>` to `<head>`.

- [ ] **Step 2.1.4: Run test to verify it passes**

Same command as Step 2.1.2.
Expected: PASS.

- [ ] **Step 2.1.5: Apply same pattern to remaining 12 views**

For each view in the table above (VaultView through NotFoundView), add the 6 meta tags at the top of the rendered fragment, using the view-specific title + description from the table.

- [ ] **Step 2.1.6: Write SEO test for VaultView (sample coverage of an authed view)**

Append to `app/src/views/__tests__/VaultView.test.tsx`:
```tsx
describe('SEO metadata', () => {
  it('renders SIPHER — Vault title and og description', async () => {
    render(<VaultView />)
    await waitFor(() => {
      expect(document.title).toBe('SIPHER — Vault')
    })
    expect(document.querySelector('meta[property="og:description"]')?.getAttribute('content'))
      .toBe('Shielded vault for private deposits and withdrawals on Solana.')
  })
})
```

- [ ] **Step 2.1.7: Write SEO test for NotFoundView (sample coverage of catch-all)**

Append to `app/src/views/__tests__/NotFoundView.test.tsx` (or create it if missing):
```tsx
describe('SEO metadata', () => {
  it('renders SIPHER — Not found title', async () => {
    render(<NotFoundView />)
    await waitFor(() => {
      expect(document.title).toBe('SIPHER — Not found')
    })
  })
})
```

- [ ] **Step 2.1.8: Run full app test suite**

```bash
cd ~/local-dev/sipher/.worktrees/feat-a11y-seo/app
pnpm test --run
```
Expected: all tests pass, count = 476 + 3 = 479 (or similar — pattern: +3 new tests for SEO).

- [ ] **Step 2.1.9: Typecheck**

```bash
cd ~/local-dev/sipher/.worktrees/feat-a11y-seo/app
pnpm exec tsc --noEmit
```
Expected: clean.

- [ ] **Step 2.1.10: Commit**

```bash
cd ~/local-dev/sipher/.worktrees/feat-a11y-seo
git add app/src/views/
git commit -m "feat(app): add per-route SEO + OG meta tags via React 19 native metadata

Closes #206"
```

### Task 2.2: #210 — Privacy Graph loading state skeleton

**Files:**
- Modify: `app/src/components/PrivacyGraph.tsx`
- Test: `app/src/components/__tests__/PrivacyGraph.test.tsx`

**Behavior:**
- During `loading === true`: render skeleton placeholder (matching the empty-state visual shape, with tailwind shimmer/pulse).
- After load completes with no nodes: existing empty state.
- After load completes with nodes: existing graph.

- [ ] **Step 2.2.1: Investigate current loading state handling in PrivacyGraph.tsx**

```bash
cd ~/local-dev/sipher/.worktrees/feat-a11y-seo
cat app/src/components/PrivacyGraph.tsx
```

Note the existing `loading` prop or state, and the empty-state JSX block.

- [ ] **Step 2.2.2: Write failing test for skeleton during loading**

Append to `app/src/components/__tests__/PrivacyGraph.test.tsx`:
```tsx
describe('loading state', () => {
  it('renders skeleton while loading', () => {
    render(<PrivacyGraph loading={true} nodes={[]} />)
    expect(screen.getByTestId('privacy-graph-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('privacy-graph-empty')).not.toBeInTheDocument()
  })

  it('renders empty state when loaded with no nodes', () => {
    render(<PrivacyGraph loading={false} nodes={[]} />)
    expect(screen.queryByTestId('privacy-graph-skeleton')).not.toBeInTheDocument()
    expect(screen.getByTestId('privacy-graph-empty')).toBeInTheDocument()
  })
})
```

Note: actual prop names depend on PrivacyGraph's current API — adapt the test to match. If PrivacyGraph uses internal state rather than props, mock the data-fetching hook.

- [ ] **Step 2.2.3: Run test to verify it fails**

```bash
pnpm test --run src/components/__tests__/PrivacyGraph.test.tsx -t "loading state"
```
Expected: FAIL — no skeleton testid in DOM.

- [ ] **Step 2.2.4: Add skeleton + testids to PrivacyGraph.tsx**

Pattern:
```tsx
if (loading) {
  return (
    <div data-testid="privacy-graph-skeleton" className="animate-pulse h-32 bg-elevated rounded-xl border border-line" aria-busy="true" aria-label="Loading privacy graph">
      <div className="p-4 space-y-2">
        <div className="h-3 bg-bg/50 rounded w-1/3" />
        <div className="h-3 bg-bg/50 rounded w-2/3" />
        <div className="h-3 bg-bg/50 rounded w-1/2" />
      </div>
    </div>
  )
}
if (nodes.length === 0) {
  // existing empty state JSX — add data-testid="privacy-graph-empty" to root div
}
// existing graph render
```

If the empty state doesn't yet have a testid, add one. If the skeleton needs to match a specific empty-state shape, mirror that shape (height, container dimensions).

- [ ] **Step 2.2.5: Run tests to verify**

```bash
pnpm test --run src/components/__tests__/PrivacyGraph.test.tsx
```
Expected: PASS.

- [ ] **Step 2.2.6: Commit**

```bash
git add app/src/components/PrivacyGraph.tsx app/src/components/__tests__/PrivacyGraph.test.tsx
git commit -m "feat(app): add Privacy Graph loading state skeleton

Closes #210"
```

### Task 2.3: #211 — Toast role + aria-live semantics

**Files:**
- Modify: `app/src/components/Toast.tsx`
- Test: `app/src/components/__tests__/Toast.test.tsx` (create if missing) OR `app/src/providers/__tests__/ToastProvider.test.tsx`

**Mapping (locked):**
- `kind: 'info'` → `role="status"` `aria-live="polite"`
- `kind: 'success'` → `role="status"` `aria-live="polite"`
- `kind: 'warn'` → `role="alert"` `aria-live="assertive"`
- `kind: 'error'` → `role="alert"` `aria-live="assertive"`

- [ ] **Step 2.3.1: Investigate Toast.tsx current role/aria-live attributes**

```bash
cat app/src/components/Toast.tsx
```

- [ ] **Step 2.3.2: Write failing tests**

Create or append to a Toast test file:
```tsx
import { render } from '@testing-library/react'
import { Toast } from '../Toast'

describe('Toast aria semantics', () => {
  it('info kind uses role=status + aria-live=polite', () => {
    const { container } = render(<Toast toast={{ message: 'hello', kind: 'info' }} onDismiss={() => {}} />)
    const root = container.firstChild as HTMLElement
    expect(root.getAttribute('role')).toBe('status')
    expect(root.getAttribute('aria-live')).toBe('polite')
  })

  it('error kind uses role=alert + aria-live=assertive', () => {
    const { container } = render(<Toast toast={{ message: 'oops', kind: 'error' }} onDismiss={() => {}} />)
    const root = container.firstChild as HTMLElement
    expect(root.getAttribute('role')).toBe('alert')
    expect(root.getAttribute('aria-live')).toBe('assertive')
  })

  it('warn kind uses role=alert + aria-live=assertive', () => {
    const { container } = render(<Toast toast={{ message: 'check this', kind: 'warn' }} onDismiss={() => {}} />)
    const root = container.firstChild as HTMLElement
    expect(root.getAttribute('role')).toBe('alert')
    expect(root.getAttribute('aria-live')).toBe('assertive')
  })

  it('success kind uses role=status + aria-live=polite', () => {
    const { container } = render(<Toast toast={{ message: 'done', kind: 'success' }} onDismiss={() => {}} />)
    const root = container.firstChild as HTMLElement
    expect(root.getAttribute('role')).toBe('status')
    expect(root.getAttribute('aria-live')).toBe('polite')
  })
})
```

- [ ] **Step 2.3.3: Run tests to verify failure**

```bash
pnpm test --run src/components/__tests__/Toast.test.tsx
```
Expected: FAIL — attributes missing or wrong.

- [ ] **Step 2.3.4: Add role + aria-live attributes to Toast.tsx root**

Pattern:
```tsx
const ariaSemantics: Record<NonNullable<ToastInput['kind']>, { role: string; ariaLive: 'polite' | 'assertive' }> = {
  info: { role: 'status', ariaLive: 'polite' },
  success: { role: 'status', ariaLive: 'polite' },
  warn: { role: 'alert', ariaLive: 'assertive' },
  error: { role: 'alert', ariaLive: 'assertive' },
}

export function Toast({ toast, onDismiss }: { toast: ToastInput; onDismiss: () => void }) {
  const styles = kindStyles[toast.kind ?? 'info']
  const { role, ariaLive } = ariaSemantics[toast.kind ?? 'info']
  return (
    <div role={role} aria-live={ariaLive} className={...}>
      {/* existing content */}
    </div>
  )
}
```

- [ ] **Step 2.3.5: Run tests to verify pass**

Same command as 2.3.3. Expected: PASS.

- [ ] **Step 2.3.6: Commit**

```bash
git add app/src/components/Toast.tsx app/src/components/__tests__/Toast.test.tsx
git commit -m "feat(app): add role + aria-live semantics to Toast component

Closes #211"
```

### Task 2.4: #214 — ChatSidebar input aria-label + maxLength

**Files:**
- Modify: `app/src/components/ChatSidebar.tsx`
- Test: `app/src/components/__tests__/ChatSidebar.test.tsx`

- [ ] **Step 2.4.1: Locate ChatSidebar input element**

```bash
grep -n "input\|maxLength\|placeholder" app/src/components/ChatSidebar.tsx | head
```

- [ ] **Step 2.4.2: Write failing test**

Append to `ChatSidebar.test.tsx`:
```tsx
describe('input accessibility', () => {
  it('input has aria-label="Ask SIPHER" and maxLength=4000', () => {
    render(<ChatSidebar open={true} onClose={() => {}} />)
    const input = screen.getByLabelText('Ask SIPHER') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.maxLength).toBe(4000)
  })
})
```

(Adapt to match existing ChatSidebar test setup — provider wrappers, etc.)

- [ ] **Step 2.4.3: Run test to verify failure**

```bash
pnpm test --run src/components/__tests__/ChatSidebar.test.tsx -t "accessibility"
```
Expected: FAIL — no element with aria-label "Ask SIPHER" found.

- [ ] **Step 2.4.4: Add aria-label + maxLength to ChatSidebar input**

Modify the `<input>` element:
```tsx
<input
  type="text"
  aria-label="Ask SIPHER"
  maxLength={4000}
  placeholder={status === 'authed' ? 'Ask SIPHER anything about your privacy' : 'Connect wallet first'}
  // ... existing props
/>
```

- [ ] **Step 2.4.5: Run test to verify pass**

Same command as 2.4.3. Expected: PASS.

- [ ] **Step 2.4.6: Commit**

```bash
git add app/src/components/ChatSidebar.tsx app/src/components/__tests__/ChatSidebar.test.tsx
git commit -m "feat(app): add aria-label + maxLength to ChatSidebar input

Closes #214"
```

### Task 2.5: Cluster C final verification

- [ ] **Step 2.5.1: Run full app test suite**

```bash
cd ~/local-dev/sipher/.worktrees/feat-a11y-seo/app
pnpm test --run
```
Expected: all tests pass.

- [ ] **Step 2.5.2: Typecheck**

```bash
pnpm exec tsc --noEmit
```
Expected: clean.

- [ ] **Step 2.5.3: Push branch**

```bash
cd ~/local-dev/sipher/.worktrees/feat-a11y-seo
git push -u origin feat/a11y-seo
```

---

## Cluster D — Network/asset alignment (subagent implementer prompt section)

**Branch:** `fix/network-asset-alignment`
**Worktree:** `~/local-dev/sipher/.worktrees/fix-network-asset-alignment/`
**Issues:** #207 (AmountForm hardcodes "SOL"), #208 (Header default mismatch), #209 (TickerBar visibility-gating + dead slot)
**Spec section:** `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-design.md` → "Wave 2a — Cluster D (Network/asset alignment, P2)"
**Estimated:** 2-4h

**Out-of-scope guardrails:**
- DON'T touch SEO meta tags or a11y primitives (Cluster C).
- DON'T add connection-quality indicator to `Header.tsx` (Cluster E1 #219 owns the indicator section in the right-side group).
- DON'T touch `BetaBanner.tsx` or `AboutView.tsx` (Cluster E1).
- DON'T modify `PrivacyGraph.tsx`, `Toast.tsx`, or `ChatSidebar.tsx` (Cluster C).
- DON'T touch E2 territory.

**Header.tsx coordination rule:**
> Header.tsx is also being modified by Cluster E1 (#219 connection-quality indicator) in parallel. Your changes are in the **network data binding line** at `Header.tsx:54` (`useNetworkConfigStore` selector and any related default fallback). DO NOT touch the JSX in the header's right-side icon group (UserMenu, AgentDot area) — that's E1's territory.

### Task 3.1: #207 — AmountForm assetSymbol prop

**Files:**
- Modify: `app/src/components/AmountForm.tsx`
- Modify: `app/src/components/vault/DepositForm.tsx` (caller)
- Modify: `app/src/components/vault/WithdrawForm.tsx` (caller, if exists — investigate first)
- Test: `app/src/components/__tests__/AmountForm.test.tsx`
- Test: `app/src/components/vault/__tests__/DepositForm.test.tsx` (verify assetSymbol pass-through)

- [ ] **Step 3.1.1: Investigate AmountForm callers**

```bash
cd ~/local-dev/sipher/.worktrees/fix-network-asset-alignment
grep -rn "AmountForm" app/src/ --include="*.tsx" | grep -v test
```
Expected: DepositForm.tsx + WithdrawForm.tsx + AmountForm.tsx self.

- [ ] **Step 3.1.2: Write failing test for AmountForm assetSymbol prop**

Append to `app/src/components/__tests__/AmountForm.test.tsx`:
```tsx
describe('assetSymbol prop', () => {
  it('renders SOL by default', () => {
    render(<AmountForm action="Deposit" max={5} onSubmit={() => {}} onCancel={() => {}} />)
    expect(screen.getByText(/SOL/)).toBeInTheDocument()
  })

  it('renders custom assetSymbol when passed', () => {
    render(<AmountForm action="Deposit" max={5} onSubmit={() => {}} onCancel={() => {}} assetSymbol="USDC" />)
    expect(screen.getByText(/USDC/)).toBeInTheDocument()
    expect(screen.queryByText(/SOL/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3.1.3: Run test to verify failure**

```bash
cd ~/local-dev/sipher/.worktrees/fix-network-asset-alignment/app
pnpm test --run src/components/__tests__/AmountForm.test.tsx -t "assetSymbol"
```
Expected: FAIL — `assetSymbol` prop not accepted, "USDC" not rendered.

- [ ] **Step 3.1.4: Add assetSymbol prop to AmountForm**

In `app/src/components/AmountForm.tsx`:
```tsx
interface Props {
  action: string
  max: number
  onSubmit: (...) => void
  onCancel: () => void
  assetSymbol?: string  // NEW
}

export default function AmountForm({ action, max, onSubmit, onCancel, assetSymbol = 'SOL' }: Props) {
  // Replace hardcoded "SOL" string with {assetSymbol} in JSX render
  // ...
}
```

Find any hardcoded "SOL" in the rendered JSX of AmountForm and replace with `{assetSymbol}`.

- [ ] **Step 3.1.5: Run test to verify pass**

Same command as 3.1.3. Expected: PASS.

- [ ] **Step 3.1.6: Propagate from DepositForm caller**

Modify `app/src/components/vault/DepositForm.tsx`:
- Derive `assetSymbol` from the selected asset (likely via existing asset selector state).
- Pass `<AmountForm ... assetSymbol={selectedAsset.symbol} />`.

If the asset object doesn't have a `symbol` field, use the existing label/symbol field. Investigate first.

- [ ] **Step 3.1.7: Propagate from WithdrawForm caller (if applicable)**

Same pattern as 3.1.6 for `app/src/components/vault/WithdrawForm.tsx` (or wherever the withdraw flow renders AmountForm).

- [ ] **Step 3.1.8: Update DepositForm test for assetSymbol pass-through**

In `DepositForm.test.tsx`, add test:
```tsx
it('passes assetSymbol from selected asset to AmountForm', () => {
  // arrange: render DepositForm with a non-SOL asset selected (e.g., USDC)
  // assert: AmountForm renders USDC label
})
```

- [ ] **Step 3.1.9: Run cluster D tests**

```bash
pnpm test --run src/components/__tests__/AmountForm.test.tsx src/components/vault/__tests__/
```
Expected: PASS.

- [ ] **Step 3.1.10: Commit**

```bash
git add app/src/components/AmountForm.tsx app/src/components/vault/ app/src/components/__tests__/AmountForm.test.tsx
git commit -m "fix(app): add assetSymbol prop to AmountForm (defaults to SOL)

Propagates selected asset symbol from DepositForm and WithdrawForm.

Closes #207"
```

### Task 3.2: #208 — Header default network mismatch

**Files:**
- Modify: `app/src/components/Header.tsx` (the `useNetworkConfigStore` selector line — `Header.tsx:54` currently `((s) => s.config?.network ?? 'mainnet')`)
- Modify: `app/src/App.tsx` (verify lines 121-127 gate behavior)
- Test: `app/src/components/__tests__/Header.test.tsx`

**Mechanism choice (subagent picks after investigation):**

Path A — drop the `?? 'mainnet'` fallback entirely (assuming App.tsx gate makes Header default unreachable).
Path B — render `—` placeholder until config resolves (safer if gate is bypassable).

- [ ] **Step 3.2.1: Investigate App.tsx:121-127 gate**

```bash
sed -n '115,135p' app/src/App.tsx
```

Determine: does the App shell early-return / show a loader until `useNetworkConfigStore.config` is defined? If yes, Header's `config` will always be defined when rendered → Path A is safe.

- [ ] **Step 3.2.2: Document choice in commit message + PR description**

In commit message, include rationale: "App.tsx:121-127 gates shell on `config` resolving → Path A (drop fallback)" OR "Gate is bypassable when X → Path B (`—` placeholder)".

- [ ] **Step 3.2.3: Write failing test (Path-specific)**

**If Path A chosen:**
```tsx
it('renders network badge only after config is loaded', () => {
  // Render Header with config undefined → expect no network badge
  // Render Header with config = { network: 'devnet' } → expect "devnet" badge
})
```

**If Path B chosen:**
```tsx
it('renders em-dash placeholder when config is undefined', () => {
  // Render Header with config undefined → expect "—" badge text
})

it('renders network name when config is defined', () => {
  // Render Header with config = { network: 'devnet' } → expect "devnet"
})
```

- [ ] **Step 3.2.4: Run test to verify failure**

```bash
pnpm test --run src/components/__tests__/Header.test.tsx -t "network"
```

- [ ] **Step 3.2.5: Implement chosen path**

**Path A:**
```tsx
const network = useNetworkConfigStore((s) => s.config?.network)
// In JSX:
{network && <span className="...">{network}</span>}
```

**Path B:**
```tsx
const network = useNetworkConfigStore((s) => s.config?.network)
// In JSX:
<span className="text-2xs text-text-muted font-mono uppercase">{network ?? '—'}</span>
```

- [ ] **Step 3.2.6: Run test to verify pass**

Same as 3.2.4. Expected: PASS.

- [ ] **Step 3.2.7: Commit**

```bash
git add app/src/components/Header.tsx app/src/components/__tests__/Header.test.tsx
git commit -m "fix(app): align Header network default with view defaults

<Path-specific rationale: e.g. 'App.tsx gates shell on config; drop unreachable fallback'>

Closes #208"
```

### Task 3.3: #209 — TickerBar visibility-gating + dead slot field

**Files:**
- Modify: `app/src/components/ui/TickerBar.tsx`
- Test: `app/src/components/ui/__tests__/TickerBar.test.tsx`

**Behavior:**
- Poll only when `document.visibilityState === 'visible'`.
- Subscribe to `visibilitychange` event; on visible→hidden, clear interval; on hidden→visible, resume.
- Remove `slot` field from typed response shape AND from UI render.

- [ ] **Step 3.3.1: Read TickerBar.tsx**

```bash
cat app/src/components/ui/TickerBar.tsx
```

Identify the polling setInterval call + the `slot` field render.

- [ ] **Step 3.3.2: Write failing test for visibility-gating**

Append to `TickerBar.test.tsx`:
```tsx
import { vi } from 'vitest'

describe('visibility-gating', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not poll when document is hidden', () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'))
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    render(<TickerBar />)
    vi.advanceTimersByTime(10_000)  // advance 10s
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('resumes polling on hidden→visible transition', () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'))
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    render(<TickerBar />)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(6_000)  // > 5s poll cadence
    expect(fetchSpy).toHaveBeenCalled()
  })
})

describe('slot field removal', () => {
  it('does not render slot label or value', () => {
    render(<TickerBar />)
    expect(screen.queryByText(/slot/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3.3.3: Run tests to verify failure**

```bash
pnpm test --run src/components/ui/__tests__/TickerBar.test.tsx
```
Expected: FAIL.

- [ ] **Step 3.3.4: Implement visibility-gating + remove slot**

In `TickerBar.tsx`:
```tsx
useEffect(() => {
  let intervalId: number | null = null

  const startPolling = () => {
    if (intervalId !== null) return
    intervalId = window.setInterval(() => { fetchTickerData() }, 5000)
    fetchTickerData()  // immediate fetch
  }
  const stopPolling = () => {
    if (intervalId === null) return
    clearInterval(intervalId)
    intervalId = null
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      startPolling()
    } else {
      stopPolling()
    }
  }

  if (document.visibilityState === 'visible') {
    startPolling()
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    stopPolling()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}, [])
```

Remove `slot` field from:
- Response type definition (e.g., `TickerData` interface)
- Any destructuring of the response
- Any JSX render of `slot` value or label

- [ ] **Step 3.3.5: Run tests to verify pass**

Same as 3.3.3. Expected: PASS.

- [ ] **Step 3.3.6: Commit**

```bash
git add app/src/components/ui/TickerBar.tsx app/src/components/ui/__tests__/TickerBar.test.tsx
git commit -m "fix(app): gate TickerBar polling on document visibility + remove dead slot field

Polls /api/ticker only when document.visibilityState === 'visible'.
Subscribes to visibilitychange to pause/resume.

Closes #209"
```

### Task 3.4: Cluster D final verification

- [ ] **Step 3.4.1: Run full app test suite**

```bash
cd ~/local-dev/sipher/.worktrees/fix-network-asset-alignment/app
pnpm test --run
```
Expected: all tests pass.

- [ ] **Step 3.4.2: Typecheck**

```bash
pnpm exec tsc --noEmit
```
Expected: clean.

- [ ] **Step 3.4.3: Push branch**

```bash
cd ~/local-dev/sipher/.worktrees/fix-network-asset-alignment
git push -u origin fix/network-asset-alignment
```

---

## Cluster E1 — Marketing polish (subagent implementer prompt section)

**Branch:** `feat/marketing-polish`
**Worktree:** `~/local-dev/sipher/.worktrees/feat-marketing-polish/`
**Issues:** #219 (connection-quality indicator), #220 (DEVNET banner localStorage 24h cooldown), #221 (About SIPHER tagline + body)
**Spec section:** `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-design.md` → "Wave 2a — Cluster E1 (Marketing polish, P3)"
**Estimated:** 3-5h

**Out-of-scope guardrails:**
- DON'T touch Header network badge default logic (Cluster D #208 owns the data-binding line at `Header.tsx:54`).
- DON'T touch AmountForm or TickerBar (Cluster D).
- DON'T add SEO meta tags or modify Privacy Graph / Toast / ChatSidebar (Cluster C).
- DON'T touch E2 territory.
- DON'T modify backend code (pure FE).

**Header.tsx coordination rule:**
> Header.tsx is also being modified by Cluster D (#208 network default fix) in parallel. Your changes are in the **JSX right-side icon group** (UserMenu / AgentDot area) where the new connection-quality indicator badge mounts. DO NOT touch the `useNetworkConfigStore` selector line at `Header.tsx:54` — that's Cluster D's territory.

### Task 4.1: #219 — Connection-quality indicator in Header

**Files:**
- Create: `app/src/components/ConnectionQualityIndicator.tsx`
- Modify: `app/src/components/Header.tsx` (mount the indicator in right-side icon group ONLY)
- Test: `app/src/components/__tests__/ConnectionQualityIndicator.test.tsx`

**Behavior:**
- Ping `/api/config` every 30s when `document.visibilityState === 'visible'`.
- (Subagent: investigate if a `/healthz` endpoint exists on backend and prefer that; document choice.)
- Latency thresholds: <500ms green, 500ms-2s yellow, >2s OR fetch-failure red.
- Hover tooltip shows `Backend reachable (XXXms)` or `Unreachable`.

- [ ] **Step 4.1.1: Investigate backend endpoints for health check**

```bash
cd ~/local-dev/sipher
grep -rn "/healthz\|GET.*health" packages/agent/src/routes/ 2>/dev/null | head
```

If no `/healthz` found, fall back to `/api/config`.

- [ ] **Step 4.1.2: Write failing test for ConnectionQualityIndicator**

Create `app/src/components/__tests__/ConnectionQualityIndicator.test.tsx`:
```tsx
import { render, screen, act } from '@testing-library/react'
import { vi } from 'vitest'
import { ConnectionQualityIndicator } from '../ConnectionQualityIndicator'

describe('ConnectionQualityIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders green when latency < 500ms', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(new Response('{}')), 100)
      })
    })
    render(<ConnectionQualityIndicator />)
    await act(async () => { vi.advanceTimersByTime(200) })
    const indicator = screen.getByLabelText(/Backend reachable/)
    expect(indicator).toHaveClass(/green/i)  // or test the actual class name used
  })

  it('renders red on fetch failure', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    render(<ConnectionQualityIndicator />)
    await act(async () => { vi.advanceTimersByTime(100) })
    const indicator = screen.getByLabelText(/Unreachable/)
    expect(indicator).toHaveClass(/red/i)
  })

  it('does not ping when document is hidden', () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    render(<ConnectionQualityIndicator />)
    vi.advanceTimersByTime(60_000)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
```

(Adapt class-name matchers to the actual tailwind classes used — e.g., `bg-emerald-500`, `bg-amber-500`, `bg-red-500`.)

- [ ] **Step 4.1.3: Run test to verify failure**

```bash
cd ~/local-dev/sipher/.worktrees/feat-marketing-polish/app
pnpm test --run src/components/__tests__/ConnectionQualityIndicator.test.tsx
```
Expected: FAIL — component doesn't exist.

- [ ] **Step 4.1.4: Create ConnectionQualityIndicator component**

```tsx
// app/src/components/ConnectionQualityIndicator.tsx
import { useEffect, useState } from 'react'

const PING_INTERVAL_MS = 30_000
const ENDPOINT = '/api/config' // (or '/healthz' if available — investigated at dispatch)

type Quality = 'green' | 'yellow' | 'red'

function latencyToQuality(latencyMs: number): Quality {
  if (latencyMs < 500) return 'green'
  if (latencyMs < 2000) return 'yellow'
  return 'red'
}

const colorClasses: Record<Quality, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
}

export function ConnectionQualityIndicator() {
  const [quality, setQuality] = useState<Quality>('green')
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let intervalId: number | null = null

    const ping = async () => {
      const start = performance.now()
      try {
        await fetch(ENDPOINT, { method: 'GET' })
        const latency = performance.now() - start
        setLatencyMs(latency)
        setQuality(latencyToQuality(latency))
        setError(null)
      } catch (err) {
        setQuality('red')
        setError(err instanceof Error ? err.message : 'Unknown error')
        setLatencyMs(null)
      }
    }

    const startInterval = () => {
      if (intervalId !== null) return
      intervalId = window.setInterval(ping, PING_INTERVAL_MS)
      ping()
    }
    const stopInterval = () => {
      if (intervalId === null) return
      clearInterval(intervalId)
      intervalId = null
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') startInterval()
      else stopInterval()
    }

    if (document.visibilityState === 'visible') startInterval()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stopInterval()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const ariaLabel = error
    ? `Unreachable: ${error}`
    : `Backend reachable (${latencyMs?.toFixed(0) ?? '?'}ms)`

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`inline-block w-2 h-2 rounded-full ${colorClasses[quality]}`}
    />
  )
}
```

- [ ] **Step 4.1.5: Mount the indicator in Header.tsx right-side icon group**

In `app/src/components/Header.tsx`, find the right-side icon group (where `<AgentDot />` and `<UserMenu />` render). Add `<ConnectionQualityIndicator />` adjacent:

```tsx
<div className="flex items-center gap-2">
  <ConnectionQualityIndicator />
  <AgentDot />
  <UserMenu ... />
</div>
```

(Locate the actual existing JSX section — DO NOT touch the `network` data binding line at `Header.tsx:54`.)

- [ ] **Step 4.1.6: Run tests to verify pass**

Same as 4.1.3. Expected: PASS.

- [ ] **Step 4.1.7: Commit**

```bash
git add app/src/components/ConnectionQualityIndicator.tsx app/src/components/Header.tsx app/src/components/__tests__/ConnectionQualityIndicator.test.tsx
git commit -m "feat(app): add connection-quality indicator to Header

Pings /api/config every 30s when document is visible.
Green <500ms, yellow 500ms-2s, red >2s or fetch failure.

Closes #219"
```

### Task 4.2: #220 — DEVNET banner 24h localStorage cooldown

**Files:**
- Modify: `app/src/components/BetaBanner.tsx`
- Test: `app/src/components/__tests__/BetaBanner.test.tsx` (existing)

**Migration:**
- Old: `sessionStorage` key `sipher.beta-banner.dismissed`, value `'true'`.
- New: `localStorage` key `sipher.devnet-banner.dismissed-until`, value = epoch ms timestamp.

- [ ] **Step 4.2.1: Write failing tests**

Append to `app/src/components/__tests__/BetaBanner.test.tsx`:
```tsx
describe('24h localStorage cooldown', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('does not render when dismissed-until timestamp is in the future', () => {
    localStorage.setItem('sipher.devnet-banner.dismissed-until', String(Date.now() + 60_000))
    render(<BetaBanner beta={true} />)
    expect(screen.queryByText(/DEVNET BETA/)).not.toBeInTheDocument()
  })

  it('renders when dismissed-until timestamp is in the past', () => {
    localStorage.setItem('sipher.devnet-banner.dismissed-until', String(Date.now() - 60_000))
    render(<BetaBanner beta={true} />)
    expect(screen.getByText(/DEVNET BETA/)).toBeInTheDocument()
  })

  it('sets dismissed-until to 24h from now on dismiss click', async () => {
    render(<BetaBanner beta={true} />)
    const dismissButton = screen.getByRole('button', { name: /dismiss/i })  // or close icon button
    const now = Date.now()
    await userEvent.click(dismissButton)
    const stored = Number(localStorage.getItem('sipher.devnet-banner.dismissed-until'))
    const cooldownMs = 24 * 60 * 60 * 1000
    expect(stored).toBeGreaterThanOrEqual(now + cooldownMs - 1000)
    expect(stored).toBeLessThanOrEqual(now + cooldownMs + 1000)
  })

  it('does not use sessionStorage for dismissal anymore', async () => {
    render(<BetaBanner beta={true} />)
    const dismissButton = screen.getByRole('button', { name: /dismiss/i })
    await userEvent.click(dismissButton)
    expect(sessionStorage.getItem('sipher.beta-banner.dismissed')).toBeNull()
  })
})
```

- [ ] **Step 4.2.2: Run tests to verify failure**

```bash
pnpm test --run src/components/__tests__/BetaBanner.test.tsx -t "24h"
```
Expected: FAIL.

- [ ] **Step 4.2.3: Update BetaBanner.tsx storage type + key + semantics**

```tsx
const STORAGE_KEY = 'sipher.devnet-banner.dismissed-until'
const COOLDOWN_MS = 24 * 60 * 60 * 1000

export function BetaBanner({ beta }: { beta: boolean }) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    const until = Number(localStorage.getItem(STORAGE_KEY) ?? 0)
    return until > Date.now()
  })
  // ... existing vault-devnet banner logic unchanged ...

  function handleDismiss() {
    const until = Date.now() + COOLDOWN_MS
    localStorage.setItem(STORAGE_KEY, String(until))
    setDismissed(true)
  }

  // ... existing render ...
}
```

Remove all references to old `sessionStorage` key `sipher.beta-banner.dismissed`.

- [ ] **Step 4.2.4: Run tests to verify pass**

Same as 4.2.2. Expected: PASS.

- [ ] **Step 4.2.5: Commit**

```bash
git add app/src/components/BetaBanner.tsx app/src/components/__tests__/BetaBanner.test.tsx
git commit -m "feat(app): migrate DEVNET banner dismissal to localStorage with 24h cooldown

Key: sipher.devnet-banner.dismissed-until (epoch ms timestamp)
Old sessionStorage key sipher.beta-banner.dismissed removed.

Closes #220"
```

### Task 4.3: #221 — About SIPHER tagline + body copy

**Files:**
- Modify: `app/src/views/DashboardView.tsx` (mount tagline on unauthed)
- Modify: `app/src/views/AboutView.tsx` (populate body)
- Test: `app/src/views/__tests__/DashboardView.test.tsx`
- Test: `app/src/views/__tests__/AboutView.test.tsx`

**Tagline copy (verbatim from issue + D15):**
`Multi-chain privacy command center for shielded transfers across 9+ chains.`

**AboutView body sections (subagent drafts; ~300 words total):**
1. Positioning sentence (re-state tagline + expand 1 sentence).
2. Privacy primitives: stealth addresses (one-time recipient addresses), Pedersen commitments (hidden amounts), viewing keys (selective compliance disclosure).
3. Multi-chain: 9+ chains including Solana, Ethereum, NEAR, L2s.
4. Dual-identity architecture: wallet (user-controlled) + agent (HERALD on X, SENTINEL guardian, Ask SIPHER chat).
5. ROADMAP link: `<Link to="/about">` or external GitHub anchor — subagent picks. (Investigate if a ROADMAP.md is mounted in the app under a route.)

- [ ] **Step 4.3.1: Write failing test for DashboardView tagline**

Append to `DashboardView.test.tsx`:
```tsx
describe('unauthed tagline', () => {
  it('renders the SIPHER tagline when status is unauthed', () => {
    // Mock useAuthState() with status: 'unauthed'
    render(<DashboardView />)
    expect(screen.getByText(/Multi-chain privacy command center for shielded transfers across 9\+ chains\./)).toBeInTheDocument()
  })

  it('does not render the tagline when status is authed', () => {
    // Mock useAuthState() with status: 'authed'
    render(<DashboardView />)
    expect(screen.queryByText(/Multi-chain privacy command center/)).not.toBeInTheDocument()
  })
})
```

(Use the existing test pattern for mocking `useAuthState` — likely `makeFakeAuthState` factory from Tier 0+1.)

- [ ] **Step 4.3.2: Run test to verify failure**

```bash
pnpm test --run src/views/__tests__/DashboardView.test.tsx -t "tagline"
```
Expected: FAIL.

- [ ] **Step 4.3.3: Mount tagline in DashboardView (unauthed surface only)**

In `app/src/views/DashboardView.tsx`, add conditional render of the tagline gated on `status !== 'authed'`:
```tsx
{status !== 'authed' && (
  <p className="text-sm text-text-muted text-center max-w-2xl mx-auto mt-2">
    Multi-chain privacy command center for shielded transfers across 9+ chains.
  </p>
)}
```

Place near the top of the rendered Dashboard content, below the SIPHER brand mark.

- [ ] **Step 4.3.4: Write failing test for AboutView body**

Append to `app/src/views/__tests__/AboutView.test.tsx`:
```tsx
describe('AboutView body content', () => {
  it('contains positioning sentence with 9+ chains', () => {
    render(<AboutView />)
    expect(screen.getByText(/9\+ chains/i)).toBeInTheDocument()
  })

  it('mentions stealth addresses and Pedersen commitments', () => {
    render(<AboutView />)
    expect(screen.getByText(/stealth addresses/i)).toBeInTheDocument()
    expect(screen.getByText(/Pedersen/i)).toBeInTheDocument()
  })

  it('mentions HERALD or SENTINEL (dual-identity agent components)', () => {
    render(<AboutView />)
    const text = screen.getByTestId('about-body').textContent ?? ''
    expect(/HERALD|SENTINEL/.test(text)).toBe(true)
  })
})
```

- [ ] **Step 4.3.5: Run tests to verify failure**

```bash
pnpm test --run src/views/__tests__/AboutView.test.tsx -t "body content"
```
Expected: FAIL.

- [ ] **Step 4.3.6: Populate AboutView body (~300 words)**

In `app/src/views/AboutView.tsx`, replace placeholder/sparse body with structured content. Pattern:

```tsx
export default function AboutView() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6" data-testid="about-body">
      <header>
        <h1 className="text-2xl font-semibold text-text">About SIPHER</h1>
        <p className="text-text-muted mt-2">
          Multi-chain privacy command center for shielded transfers across 9+ chains.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-medium text-text">Privacy primitives</h2>
        <p className="text-sm text-text-muted">
          SIPHER combines three cryptographic primitives to deliver transaction privacy: <strong>stealth addresses</strong> (one-time recipient addresses that prevent linkability), <strong>Pedersen commitments</strong> (homomorphic hiding of transfer amounts), and <strong>viewing keys</strong> (selective disclosure for compliance and audit).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-medium text-text">Multi-chain support</h2>
        <p className="text-sm text-text-muted">
          The protocol is chain-agnostic. Today SIPHER supports Solana (native + L2s), Ethereum (mainnet + Sepolia/Arbitrum/Base/OP testnets), NEAR (via Intents), and 9+ chains total across the multi-chain matrix.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-medium text-text">Dual-identity architecture</h2>
        <p className="text-sm text-text-muted">
          Each SIPHER user has two identities: a <strong>wallet</strong> (user-controlled keypair signing transactions) and an <strong>agent</strong> (HERALD for X interactions, SENTINEL for autonomous security oversight, Ask SIPHER for natural-language assistance).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-medium text-text">Roadmap</h2>
        <p className="text-sm text-text-muted">
          See the public roadmap for current and upcoming milestones — Path B (denominated note mixer) is committed for Q3 2026, with proof composition research planned for late 2026.{' '}
          <a
            href="https://github.com/sip-protocol/sipher/blob/main/ROADMAP.md"
            className="underline text-primary hover:text-primary-hover"
            target="_blank"
            rel="noopener noreferrer"
          >
            View ROADMAP.md →
          </a>
        </p>
      </section>
    </div>
  )
}
```

- [ ] **Step 4.3.7: Run tests to verify pass**

```bash
pnpm test --run src/views/__tests__/DashboardView.test.tsx src/views/__tests__/AboutView.test.tsx
```
Expected: PASS.

- [ ] **Step 4.3.8: Commit**

```bash
git add app/src/views/DashboardView.tsx app/src/views/AboutView.tsx app/src/views/__tests__/
git commit -m "feat(app): add About SIPHER tagline + populate AboutView body

Tagline mounts on unauthed Dashboard only (hidden when authed).
AboutView body covers privacy primitives, multi-chain support,
dual-identity architecture, and ROADMAP link.

Closes #221"
```

### Task 4.4: Cluster E1 final verification

- [ ] **Step 4.4.1: Run full app test suite**

```bash
cd ~/local-dev/sipher/.worktrees/feat-marketing-polish/app
pnpm test --run
```
Expected: all tests pass.

- [ ] **Step 4.4.2: Typecheck**

```bash
pnpm exec tsc --noEmit
```
Expected: clean.

- [ ] **Step 4.4.3: Push branch**

```bash
cd ~/local-dev/sipher/.worktrees/feat-marketing-polish
git push -u origin feat/marketing-polish
```

---

## Reviews + PR creation

### Macro-task 5: Spec-compliance review (3 parallel subagents)

For each cluster, dispatch a spec-compliance-reviewer subagent. The reviewer:
- Reads the Tier 4 spec section for the cluster (Wave 2 appendix)
- Reads the cluster's branch diff
- Validates each D-item is met
- Flags any deviation that requires implementer fix-loop

Verdict: ✅ APPROVED → proceed to code-quality review. 🟡 NEEDS FIXES → implementer subagent fix-loop.

- [ ] **Step 5.1: Dispatch spec reviewer for Cluster C**
- [ ] **Step 5.2: Dispatch spec reviewer for Cluster D**
- [ ] **Step 5.3: Dispatch spec reviewer for Cluster E1**

(All 3 in a single message via parallel Agent calls.)

### Macro-task 6: Code-quality review (3 parallel subagents)

After all 3 spec reviews approve, dispatch code-quality-reviewer per cluster. Reviewer flags:
- **Critical/Important:** must-fix before merge → implementer fix-loop.
- **Minor:** file as `tech-debt,priority:low` follow-up issues (NOT `qa-skill` — avoids inflating Phase D gate count).

- [ ] **Step 6.1: Dispatch code-quality reviewer for Cluster C**
- [ ] **Step 6.2: Dispatch code-quality reviewer for Cluster D**
- [ ] **Step 6.3: Dispatch code-quality reviewer for Cluster E1**

### Macro-task 7: PR creation (3 parallel)

After all code-quality reviews approve (with fixes applied if needed), open PRs.

**Multi-issue PR description format (use one `Closes #X` per line):**

```markdown
## Summary

<1-2 sentence description of cluster work>

## Issues closed

Closes #X
Closes #Y
Closes #Z

## Changes

- Bullet list of major changes per issue

## Tests

- App tests: <new count> (was <old count>)
- TSC: clean

## Spec + reviews

- Spec: docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-design.md → Wave 2 appendix → Cluster <X>
- Spec-compliance review: ✅ APPROVED
- Code-quality review: ✅ APPROVED (N Minor follow-ups filed as tech-debt,priority:low)
```

- [ ] **Step 7.1: Create PR for Cluster C** (`gh pr create --title "..." --body "..."`)
- [ ] **Step 7.2: Create PR for Cluster D**
- [ ] **Step 7.3: Create PR for Cluster E1**

### Macro-task 8: CI green gate

Wait for all 3 PRs to show CI green. If a CI flake recurs, retry once before investigating.

- [ ] **Step 8.1: Confirm Cluster C PR CI green** (`gh pr checks <PR-number>`)
- [ ] **Step 8.2: Confirm Cluster D PR CI green**
- [ ] **Step 8.3: Confirm Cluster E1 PR CI green**

---

## Sequential merges

### Macro-task 9: Merge Cluster C → main → sync

- [ ] **Step 9.1: Switch to main**
```bash
cd ~/local-dev/sipher
git checkout main
```

- [ ] **Step 9.2: Merge Cluster C PR**
```bash
gh pr merge <C-PR-number> --merge --delete-branch
```

- [ ] **Step 9.3: Sync local main**
```bash
git pull --ff-only origin main
```

- [ ] **Step 9.4: Remove Cluster C worktree**
```bash
git worktree remove .worktrees/feat-a11y-seo
```

### Macro-task 10: Merge Cluster D → main → sync

- [ ] **Step 10.1: Pull D branch's latest if needed (rebase if Header.tsx conflict)**

If Cluster D's branch conflicts with the newly-merged main (Header.tsx from E1 may have landed if order swapped — but in this order, D merges before E1, so no conflict here):
```bash
cd .worktrees/fix-network-asset-alignment
git fetch origin
git rebase origin/main  # only if conflict; usually unnecessary
git push --force-with-lease  # only if rebased
```

- [ ] **Step 10.2: Switch to main + merge D + sync**
```bash
cd ~/local-dev/sipher
git checkout main
gh pr merge <D-PR-number> --merge --delete-branch
git pull --ff-only origin main
git worktree remove .worktrees/fix-network-asset-alignment
```

### Macro-task 11: Merge Cluster E1 → main → sync (Header.tsx coordination point)

E1 modifies Header.tsx alongside D. After D merges, E1's branch may need rebase if Header.tsx hunks overlap.

- [ ] **Step 11.1: Rebase E1 branch on latest main if needed**
```bash
cd ~/local-dev/sipher/.worktrees/feat-marketing-polish
git fetch origin
git rebase origin/main
# If conflict on Header.tsx: resolve preserving both D's network binding change AND E1's indicator JSX addition
# Re-run tests after rebase resolution
cd app && pnpm test --run
git push --force-with-lease
```

- [ ] **Step 11.2: Verify CI green after rebase if force-pushed**
```bash
gh pr checks <E1-PR-number>
```

- [ ] **Step 11.3: Merge E1 + sync**
```bash
cd ~/local-dev/sipher
git checkout main
gh pr merge <E1-PR-number> --merge --delete-branch
git pull --ff-only origin main
git worktree remove .worktrees/feat-marketing-polish
```

---

## Wave sync gate

### Macro-task 12: Verify wave end state

- [ ] **Step 12.1: Capture main HEAD + git log**
```bash
cd ~/local-dev/sipher
git log --oneline -5
```
Expected: 3 new merge commits for C, D, E1 above prior HEAD `22c535e`.

- [ ] **Step 12.2: Verify all 3 worktrees removed**
```bash
git worktree list
```
Expected: only main checkout.

- [ ] **Step 12.3: Run full app test suite on main**
```bash
cd app
pnpm test --run
```
Expected: all tests pass; count should be approximately 476 + 15-20 = ~495 (3 SEO + 2 PrivacyGraph + 4 Toast + 1 ChatSidebar + 2 AmountForm + 1 DepositForm + 2-3 Header + 3 TickerBar + 3 ConnectionQualityIndicator + 4 BetaBanner + 2 DashboardView + 3 AboutView ≈ 30 new tests; final count ~506. Subagent may differ slightly based on test consolidation choices).

- [ ] **Step 12.4: Verify typecheck clean on main**
```bash
pnpm exec tsc --noEmit
```
Expected: clean.

- [ ] **Step 12.5: Verify qa-skill issue closure count**
```bash
gh issue list --repo sip-protocol/sipher --label "qa-skill:1778399617" --state open --limit 50
```
Expected: 3 open issues (#216, #217, #218 — Wave 2b/E2).

- [ ] **Step 12.6: File any deferred Minor follow-ups from code-quality reviews**

For each Minor finding flagged during code-quality review:
```bash
gh issue create --repo sip-protocol/sipher \
  --title "[tech-debt] <finding title>" \
  --body "<finding context + suggested fix>" \
  --label "tech-debt,priority:low"
```

DO NOT use `qa-skill` label on these — they're polish, not part of the launch gate.

- [ ] **Step 12.7: Push session-end memory update**

Update `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/project_phase4b-redesign-sprint.md` with Wave 2a outcomes (3 PRs merged, 10 issues closed, sprint progress 32/35 = 91%, next session = E2).

---

## Out of scope (this plan)

- Wave 2b (E2 features: #216, #217, #218) — deferred to next session with its own brainstorm + spec appendix + plan
- Phase D launch close (3-wallet QA + X thread + final `/quality:qa --diff-from`) — RECTOR-driven gates after Wave 2b
- Tier 2/3 deferred polish items (Tooltip cloneElement, Sheet onClose, Banner copy differentiation, etc.) — separate post-launch cleanup session
- Backend changes — Wave 2a is pure FE

---

## Carry-forward execution rules (from Phase 4b sprint)

1. NO AI attribution in commits/PRs/files
2. NO semicolons in TS/TSX (single quotes for imports)
3. Conventional commits with scope (`feat(app)`, `fix(app)`, `test(app)`, `chore(app)`, `refactor(app)`)
4. NEVER amend commits; create new ones
5. TDD discipline (failing test → implement → passing test)
6. CI must be green before merge; flaky → retry once before investigating
7. `--merge --delete-branch` (NOT squash)
8. Multi-issue PRs: one `Closes #X` per line in description
9. Subagent-driven for all 3 Wave 2a clusters (D6 from Wave 1, carryover)
10. Use `superpowers:verification-before-completion` before claiming any task done
11. Switch to main BEFORE running `gh pr merge`
12. Build `@sipher/sdk` before tests in fresh worktree (Cluster D needs it)
13. Run app tests from inside `app/` directory: `cd app && pnpm test --run`
14. Typecheck command is `pnpm exec tsc --noEmit` from `app/`
15. Subagent prompts must include explicit out-of-scope list

---

## Subagent dispatch templates

### Implementer dispatch (per cluster)

```
You're the implementer subagent for Cluster {C|D|E1} of the QA Sweep Tier 4 Wave 2a sprint.

Working directory: ~/local-dev/sipher/.worktrees/{feat-a11y-seo|fix-network-asset-alignment|feat-marketing-polish}
Branch: {feat/a11y-seo|fix/network-asset-alignment|feat/marketing-polish}

Read these files (in order):
1. ~/local-dev/sipher/docs/superpowers/plans/2026-05-11-qa-sweep-tier-4-wave-2a.md → "Cluster {X} — ... (subagent implementer prompt section)"
2. ~/local-dev/sipher/docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-design.md → "Wave 2a — Cluster {X} (..., P{2|3})"

Execute every task in the cluster section (Task {2|3|4}.1 through Task {2|3|4}.{N}) plus the final verification task. Use TDD discipline (red → green → commit) per task. Conventional commits per the Carry-forward execution rules.

Out-of-scope guardrails (NEVER cross):
{verbatim out-of-scope list from cluster section}

When done, push the branch and report back: commits added, tests added/passing, typecheck status, any blockers.

Use `superpowers:verification-before-completion` before claiming done.
```

### Spec-compliance reviewer dispatch

```
You're the spec-compliance reviewer for Cluster {X} of the QA Sweep Tier 4 Wave 2a sprint.

Read these files:
1. ~/local-dev/sipher/docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-design.md → "Wave 2a — Cluster {X} (..., P{2|3})"
2. Branch diff: `cd ~/local-dev/sipher && git diff origin/main...origin/{branch-name}`

Validate:
- Each D-item in the cluster spec is met
- Out-of-scope guardrails honored (no cross-cluster file changes)
- Conventional commits + per-issue commit structure
- TDD evidence (test commits paired with implementation commits)

Report verdict: ✅ APPROVED | 🟡 NEEDS FIXES (with specific findings).
```

### Code-quality reviewer dispatch

```
You're the code-quality reviewer for Cluster {X} of the QA Sweep Tier 4 Wave 2a sprint.

Read branch diff: `cd ~/local-dev/sipher && git diff origin/main...origin/{branch-name}`

Check for:
- Critical/Important: behavioral bugs, race conditions, security issues, accessibility regressions, missing cleanup (intervals, listeners), type-safety holes
- Minor: test fragility, missing edge-case coverage, naming inconsistencies, dead code

Report:
- ✅ APPROVED if no Critical/Important
- 🔴 BLOCKED if any Critical/Important (with specific fix prescriptions)
- Minor findings listed for follow-up issue filing (label `tech-debt,priority:low`, NOT `qa-skill`)
```

---

**End of plan.**
