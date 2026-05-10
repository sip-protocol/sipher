# QA Sweep — Tier 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 6 issues from the 33-issue QA sweep (#190, #194, #200, #201, #204, #215) via 3 PRs in dependency order: UnauthedEmptyState primitive → React Router 7 migration → Footer + Tooltip + JargonTerm + AboutView + Banner + Privacy Graph copy.

**Architecture:** Path A DAG ordering. PR1 ships the `<UnauthedEmptyState>` primitive and wires three distinct mounts (VaultView marketing branch, KeysView empty state, PrivacyScoreCard teaser modal). PR2 migrates routing from `useAppStore.activeView` (Zustand) to `react-router-dom@^7` with 13 routes including a `/about` placeholder + `*` 404. PR3 layers the Footer (mounted in App shell), `<Tooltip>` + `<JargonTerm>` primitives, AboutView marketing page, `<Banner>` for #204 breadcrumb, and Privacy Graph empty-state copy expansion.

All 3 PRs use SUBAGENT-driven mode with TDD discipline and two-stage review (spec-compliance THEN code-quality) per task.

**Tech Stack:** TypeScript, React 19, Vite 6, Vitest, Tailwind CSS 4, Zustand 5, `react-router-dom@^7` (NEW), `@solana/wallet-adapter-react` (existing), Phosphor React icons, Playwright (e2e at repo root).

**Spec:** `docs/superpowers/specs/2026-05-10-qa-sweep-tier-2-design.md`

---

## Pre-flight (run once before starting any PR)

- [ ] **Step 1: Verify clean main HEAD**

```bash
cd ~/local-dev/sipher
git fetch --prune
git status                                   # expect: clean, on main, up to date with origin/main
git log --oneline -1                         # expect: 595b30c (or later) docs(superpowers): add Tier 2 QA sweep design spec
git worktree list                            # expect: only the main checkout
```

- [ ] **Step 2: Verify build hygiene**

```bash
pnpm install                                 # at repo root
pnpm --filter "@sipher/sdk" build            # required before agent tests
cd app && pnpm typecheck && pnpm test --run  # baseline: 379 tests pass across 65 files
```

If `app/` test count is not 379, rebase from `main` first.

---

## PR1 — `feat/unauthed-empty-state-primitive` (closes #190 + #201 + #215)

Estimated: 6-8h. Mode: SUBAGENT-driven w/ TDD.

### Task 1.1: Create PR1 worktree

- [ ] **Step 1: Create worktree branched from main**

```bash
cd ~/local-dev/sipher
git worktree add .worktrees/feat-unauthed-empty-state-primitive -b feat/unauthed-empty-state-primitive
cd .worktrees/feat-unauthed-empty-state-primitive
```

- [ ] **Step 2: Install dependencies in worktree**

```bash
pnpm install
pnpm --filter "@sipher/sdk" build
```

- [ ] **Step 3: Verify baseline passes**

```bash
cd app && pnpm typecheck
pnpm test --run
```

Expected: 379 tests pass / 65 files / typecheck clean.

### Task 1.2: Write `UnauthedEmptyState` primitive test

**Files:**
- Create: `app/src/components/ui/__tests__/UnauthedEmptyState.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { UnauthedEmptyState } from '../UnauthedEmptyState'

describe('UnauthedEmptyState', () => {
  it('renders title and body', () => {
    render(<UnauthedEmptyState title="Stealth Keys" body="Connect to view." />)
    expect(screen.getByText('Stealth Keys')).toBeInTheDocument()
    expect(screen.getByText('Connect to view.')).toBeInTheDocument()
  })

  it('renders default CTA when none provided', () => {
    render(<UnauthedEmptyState title="X" body="Y" />)
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
  })

  it('renders custom CTA when provided', () => {
    render(
      <UnauthedEmptyState
        title="X"
        body="Y"
        cta={<a href="/about">Learn more</a>}
      />,
    )
    expect(screen.getByRole('link', { name: /learn more/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /connect/i })).toBeNull()
  })

  it('renders illustration when provided', () => {
    render(
      <UnauthedEmptyState
        title="X"
        body="Y"
        illustration={<div data-testid="hero">hero</div>}
      />,
    )
    expect(screen.getByTestId('hero')).toBeInTheDocument()
  })

  it('does not render illustration container when illustration is omitted', () => {
    const { container } = render(<UnauthedEmptyState title="X" body="Y" />)
    expect(container.querySelector('[data-testid="empty-state-illustration"]')).toBeNull()
  })

  it('renders rich body content (ReactNode, not just string)', () => {
    render(
      <UnauthedEmptyState
        title="X"
        body={<>Connect a wallet to <strong>deposit</strong>.</>}
      />,
    )
    expect(screen.getByText('deposit')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app && pnpm test --run src/components/ui/__tests__/UnauthedEmptyState.test.tsx
```

Expected: FAIL with "Cannot find module '../UnauthedEmptyState'" or similar.

### Task 1.3: Implement `UnauthedEmptyState` primitive

**Files:**
- Create: `app/src/components/ui/UnauthedEmptyState.tsx`

- [ ] **Step 1: Implement the primitive**

```tsx
import type { ReactNode } from 'react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'

export interface UnauthedEmptyStateProps {
  title: string
  body: ReactNode
  cta?: ReactNode
  illustration?: ReactNode
}

function DefaultConnectCTA() {
  const { setVisible } = useWalletModal()
  return (
    <button
      type="button"
      onClick={() => setVisible(true)}
      className="self-start text-xs px-3 py-1.5 rounded-md text-bg font-semibold bg-accent hover:opacity-90"
      style={{ background: 'linear-gradient(90deg, var(--color-cyan), var(--color-violet))' }}
    >
      Connect wallet
    </button>
  )
}

export function UnauthedEmptyState({
  title,
  body,
  cta,
  illustration,
}: UnauthedEmptyStateProps) {
  return (
    <div
      data-testid="unauthed-empty-state"
      className="glass-strong rounded-2xl p-8 flex flex-col items-start gap-4"
    >
      {illustration && (
        <div data-testid="empty-state-illustration" className="w-full">
          {illustration}
        </div>
      )}
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <div className="text-sm text-text-secondary leading-relaxed">{body}</div>
      {cta ?? <DefaultConnectCTA />}
    </div>
  )
}
```

- [ ] **Step 2: Run test to verify it passes**

```bash
pnpm test --run src/components/ui/__tests__/UnauthedEmptyState.test.tsx
```

Expected: PASS — all 6 tests green.

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: clean (no new errors). If `useWalletModal` isn't exported from `@solana/wallet-adapter-react-ui`, fall back to `import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'` and render that as the default CTA.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/UnauthedEmptyState.tsx src/components/ui/__tests__/UnauthedEmptyState.test.tsx
git commit -m "feat(app): add UnauthedEmptyState primitive"
```

### Task 1.4: Modify VaultView test for unauthed branch

**Files:**
- Modify: `app/src/views/__tests__/VaultView.test.tsx`

- [ ] **Step 1: Add a `useAuthState` mock that the test can flip**

The existing test hardcodes `status: 'authed'`. Replace the hardcode with a mutable mock at the top:

```tsx
const useAuthStateMock = vi.fn()
vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => useAuthStateMock(),
}))
```

Update existing `beforeEach` to set the default authed state via the new mock. Replace the inline `vi.mock('../../hooks/useAuthState', () => ({ useAuthState: () => ({ ... }) }))` block with the dynamic mock pattern. Existing test bodies stay unchanged because each will set the mock to authed in `beforeEach`:

```tsx
beforeEach(() => {
  mockedFetch.mockReset()
  setActiveView.mockReset()
  networkValue = 'devnet'
  onAuthClear._resetForTests()
  useAuthStateMock.mockReturnValue({
    status: 'authed' as const,
    token: 'test-token',
    expiresAt: null,
    isAdmin: false,
    publicKey: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
    authenticate: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    error: null,
  })
})
```

- [ ] **Step 2: Add 3 unauthed tests**

Add to the bottom of the existing `describe('VaultView (split-panel)')` block:

```tsx
it('renders UnauthedEmptyState when status is unauthed', () => {
  useAuthStateMock.mockReturnValue({
    status: 'unauthed' as const,
    token: null,
    publicKey: null,
    isAdmin: false,
    expiresAt: null,
    authenticate: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    error: null,
  })
  mockThreeFetches()
  render(<VaultView />)
  expect(screen.getByTestId('unauthed-empty-state')).toBeInTheDocument()
  expect(screen.queryByText(/SHIELDED VAULT/)).toBeNull()
  expect(screen.queryByText(/UNSHIELDED WALLET/)).toBeNull()
  expect(screen.queryByRole('button', { name: /withdraw/i })).toBeNull()
  expect(screen.queryByRole('button', { name: /shield to vault/i })).toBeNull()
})

it('renders UnauthedEmptyState when status is connecting', () => {
  useAuthStateMock.mockReturnValue({
    status: 'connecting' as const,
    token: null,
    publicKey: null,
    isAdmin: false,
    expiresAt: null,
    authenticate: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    error: null,
  })
  mockThreeFetches()
  render(<VaultView />)
  expect(screen.getByTestId('unauthed-empty-state')).toBeInTheDocument()
})

it('does not fire fetches when unauthed', () => {
  useAuthStateMock.mockReturnValue({
    status: 'unauthed' as const,
    token: null,
    publicKey: null,
    isAdmin: false,
    expiresAt: null,
    authenticate: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    error: null,
  })
  render(<VaultView />)
  expect(mockedFetch).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Run tests to verify the 3 new tests fail**

```bash
pnpm test --run src/views/__tests__/VaultView.test.tsx
```

Expected: 3 new tests FAIL. Existing tests still pass.

### Task 1.5: Wire VaultView unauthed branch

**Files:**
- Modify: `app/src/views/VaultView.tsx`

- [ ] **Step 1: Add unauthed branch at top of component**

Replace the existing `useAuthState()` destructure and add early-return:

```tsx
import { UnauthedEmptyState } from '../components/ui/UnauthedEmptyState'
import { RoutePreviewCard } from '../components/vault/RoutePreviewCard'
import { useAuthState } from '../hooks/useAuthState'
// ... other existing imports unchanged

export default function VaultView() {
  const { token, status } = useAuthState()
  const setActiveView = useAppStore((s) => s.setActiveView)
  const network = useNetworkConfigStore((s) => s.config?.network ?? '')
  const isMainnet = network === 'mainnet'

  const [vault, setVault] = useState<VaultData | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [stealthTree, setStealthTree] = useState<StealthNode[]>([])
  const [loading, setLoading] = useState(true)

  useOnAuthClear(() => {
    setVault(null)
    setPositions([])
    setStealthTree([])
    setLoading(true)
  })

  useEffect(() => {
    if (!token) return
    // ... existing fetch block unchanged
  }, [token])

  if (status !== 'authed') {
    return (
      <UnauthedEmptyState
        title="Shielded Vault"
        body={
          <>
            Privacy-preserving SOL + token vault on Solana. Stealth output addresses by default.
            <br />
            <strong>Connect a wallet to deposit.</strong>
          </>
        }
        illustration={<RoutePreviewCard wallet="" />}
      />
    )
  }

  return (
    <div data-testid="vault-view" className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* existing authed content unchanged */}
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm test --run src/views/__tests__/VaultView.test.tsx
```

Expected: ALL tests pass (existing 8 + new 3 = 11).

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/views/VaultView.tsx src/views/__tests__/VaultView.test.tsx
git commit -m "feat(app): gate VaultView unauthed with UnauthedEmptyState (#190)"
```

### Task 1.6: Modify KeysView test for unauthed branch

**Files:**
- Modify: `app/src/views/__tests__/KeysView.test.tsx`

- [ ] **Step 1: Replace `renders nothing when unauthenticated` with UnauthedEmptyState assertion**

Replace this existing test block:

```tsx
it('renders nothing when unauthenticated', () => {
  useAuthStateMock.mockReturnValue({
    publicKey: null,
    token: null,
    status: 'unauthed',
    isAdmin: false,
  })
  const { container } = render(<KeysView />)
  expect(container.querySelector('[data-testid="keys-view"]')).toBeNull()
  expect(screen.queryByTestId('view-key-card')).toBeNull()
})
```

with:

```tsx
it('renders UnauthedEmptyState when unauthenticated', () => {
  useAuthStateMock.mockReturnValue({
    publicKey: null,
    token: null,
    status: 'unauthed',
    isAdmin: false,
  })
  render(<KeysView />)
  expect(screen.getByTestId('unauthed-empty-state')).toBeInTheDocument()
  expect(screen.getByText(/stealth keys/i)).toBeInTheDocument()
  expect(screen.queryByTestId('view-key-card')).toBeNull()
  expect(screen.queryByTestId('backup-card')).toBeNull()
})

it('does NOT render the section heading when unauthenticated', () => {
  useAuthStateMock.mockReturnValue({
    publicKey: null,
    token: null,
    status: 'unauthed',
    isAdmin: false,
  })
  render(<KeysView />)
  expect(screen.queryByText(/viewing key management/i)).toBeNull()
})
```

- [ ] **Step 2: Run tests to verify the rewritten + new test fail**

```bash
pnpm test --run src/views/__tests__/KeysView.test.tsx
```

Expected: 2 tests FAIL (KeysView still returns null, no UnauthedEmptyState). Existing 3 tests still pass.

### Task 1.7: Wire KeysView unauthed branch

**Files:**
- Modify: `app/src/views/KeysView.tsx`

- [ ] **Step 1: Replace `return null` with UnauthedEmptyState**

```tsx
import { useAuthState } from '../hooks/useAuthState'
import { UnauthedEmptyState } from '../components/ui/UnauthedEmptyState'
import { ViewKeyCard } from '../components/keys/ViewKeyCard'
import { StealthAddressBackup } from '../components/keys/StealthAddressBackup'

export default function KeysView() {
  const { status } = useAuthState()
  if (status !== 'authed') {
    return (
      <UnauthedEmptyState
        title="Stealth Keys"
        body="Your spending and viewing keys are derived from your wallet. Connect to view, rotate, or back them up."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-sm text-text-muted" style={{ letterSpacing: 'var(--tracking-widest)' }}>
        VIEWING KEY MANAGEMENT
      </h1>
      <div data-testid="keys-view" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ViewKeyCard />
        <StealthAddressBackup />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm test --run src/views/__tests__/KeysView.test.tsx
```

Expected: ALL 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/views/KeysView.tsx src/views/__tests__/KeysView.test.tsx
git commit -m "feat(app): gate KeysView unauthed with UnauthedEmptyState (#201)"
```

### Task 1.8: Modify PrivacyScoreCard test for Sheet teaser

**Files:**
- Modify: `app/src/components/__tests__/PrivacyScoreCard.test.tsx`

- [ ] **Step 1: Add useAuthState mock + Sheet teaser tests**

Add at the top of the test file (between existing mocks and tests):

```tsx
const useAuthStateMock = vi.fn()
vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => useAuthStateMock(),
}))

beforeEach(() => {
  useAppStore.setState({ activeView: 'dashboard' }, false)
  useAuthStateMock.mockReturnValue({
    status: 'authed' as const,
    token: 'test-token',
    publicKey: 'TestWallet1111111111111111111111111111111111',
    isAdmin: false,
    expiresAt: null,
    authenticate: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    error: null,
  })
})
```

(merge with existing `beforeEach`).

Update the existing `View report button navigates to privacyReport view via store` test to specify authed state — it should already pass because the new `beforeEach` sets authed. Leave test body unchanged.

Add 2 new tests:

```tsx
it('opens Sheet teaser with UnauthedEmptyState when View report clicked unauthed', () => {
  useAuthStateMock.mockReturnValue({
    status: 'unauthed' as const,
    token: null,
    publicKey: null,
    isAdmin: false,
    expiresAt: null,
    authenticate: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    error: null,
  })
  render(<PrivacyScoreCard data={fakeData} />)
  fireEvent.click(screen.getByRole('button', { name: /view report/i }))
  expect(screen.getByTestId('unauthed-empty-state')).toBeInTheDocument()
  expect(screen.getByText(/privacy score report/i)).toBeInTheDocument()
})

it('does NOT navigate to privacyReport when clicked unauthed', () => {
  useAuthStateMock.mockReturnValue({
    status: 'unauthed' as const,
    token: null,
    publicKey: null,
    isAdmin: false,
    expiresAt: null,
    authenticate: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    error: null,
  })
  render(<PrivacyScoreCard data={fakeData} />)
  fireEvent.click(screen.getByRole('button', { name: /view report/i }))
  expect(useAppStore.getState().activeView).toBe('dashboard')
})
```

- [ ] **Step 2: Run tests to verify the new tests fail**

```bash
pnpm test --run src/components/__tests__/PrivacyScoreCard.test.tsx
```

Expected: 2 new tests FAIL. Existing 5 tests still pass (authed beforeEach hydrates them).

### Task 1.9: Wire PrivacyScoreCard Sheet teaser

**Files:**
- Modify: `app/src/components/PrivacyScoreCard.tsx`

- [ ] **Step 1: Add status check + Sheet for unauthed click**

```tsx
import { useState } from 'react'
import { Card } from './ui/Card'
import { Gauge } from './ui/Gauge'
import { MetricBar } from './ui/MetricBar'
import { Sheet } from './ui/Sheet'
import { UnauthedEmptyState } from './ui/UnauthedEmptyState'
import { useAppStore } from '../stores/app'
import { useAuthState } from '../hooks/useAuthState'

interface PrivacyData {
  score: number
  grade: string
  factors: {
    addressReuse: { score: number; detail: string }
    amountPatterns: { score: number; detail: string }
    timingCorrelation: { score: number; detail: string }
    counterpartyExposure: { score: number; detail: string }
  }
  recommendations: string[]
  transactionsAnalyzed: number
}

interface PrivacyScoreCardProps {
  data: PrivacyData | null
  delta?: number
}

export function PrivacyScoreCard({ data, delta }: PrivacyScoreCardProps) {
  const setActiveView = useAppStore((s) => s.setActiveView)
  const { status } = useAuthState()
  const [teaserOpen, setTeaserOpen] = useState(false)

  const handleViewReport = () => {
    if (status === 'authed') {
      setActiveView('privacyReport')
    } else {
      setTeaserOpen(true)
    }
  }

  return (
    <>
      <Card variant="default" sheen className="p-8">
        {/* existing card content unchanged, but replace
            onClick={() => setActiveView('privacyReport')} with
            onClick={handleViewReport} */}
      </Card>

      <Sheet
        open={teaserOpen}
        onClose={() => setTeaserOpen(false)}
        ariaLabel="Privacy Score Report"
      >
        <UnauthedEmptyState
          title="Privacy Score Report"
          body="Network analysis · surveillance score · personalized recommendations. Connect a wallet to view your full report."
        />
      </Sheet>
    </>
  )
}
```

(Preserve the entire existing JSX inside `<Card>`, just changing the button's `onClick` from `() => setActiveView('privacyReport')` to `handleViewReport`.)

- [ ] **Step 2: Run tests**

```bash
pnpm test --run src/components/__tests__/PrivacyScoreCard.test.tsx
```

Expected: ALL 7 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/PrivacyScoreCard.tsx src/components/__tests__/PrivacyScoreCard.test.tsx
git commit -m "feat(app): teaser modal on PrivacyScoreCard 'View report' when unauthed (#215)"
```

### Task 1.10: Full PR1 verification gate

- [ ] **Step 1: Run full app test suite**

```bash
cd app && pnpm test --run
```

Expected: 379 + new tests pass. New tests count: +6 primitive + +3 VaultView + +1 KeysView (replacing one) + +2 PrivacyScoreCard = ~11 new. Target: ~390 tests pass / 65+ files.

- [ ] **Step 2: Run repo-root tests**

```bash
cd .. && pnpm test --run
```

Expected: agent + sdk tests still green (no regressions).

- [ ] **Step 3: Run typecheck**

```bash
cd app && pnpm typecheck
```

Expected: clean.

- [ ] **Step 4: Push branch**

```bash
git push -u origin feat/unauthed-empty-state-primitive
```

### Task 1.11: Open PR1 + two-stage review

- [ ] **Step 1: Create PR via gh**

```bash
gh pr create --title "feat(app): UnauthedEmptyState primitive + 3 mounts (Tier 2 PR1)" --body "$(cat <<'EOF'
## Summary

Closes #190 (Vault Withdraw visible to unauthed — P0), #201 (Keys page blank), #215 (View Report dead CTA). Tier 2 PR1 of the QA sweep.

- New \`<UnauthedEmptyState>\` primitive in \`app/src/components/ui/\` — props: \`{ title, body, cta?, illustration? }\`. Default CTA opens wallet modal.
- VaultView unauthed branch renders primitive with \`<RoutePreviewCard>\` as illustration; hides ShieldedVaultPanel + UnshieldedWalletPanel + Withdraw button.
- KeysView unauthed branch renders primitive with title + body (no longer returns null).
- PrivacyScoreCard \`View report →\` opens Sheet teaser with primitive body when unauthed; preserves existing \`setActiveView('privacyReport')\` when authed.

## Test plan

- [ ] Vercel preview: load without wallet → click Vault → marketing illustration shown, no Withdraw button
- [ ] Vercel preview: same session → click Keys → empty state with title + Connect CTA
- [ ] Vercel preview: same session → click "View report →" → Sheet opens with teaser; dismiss; connect wallet → click again → navigates to privacy report
- [ ] CI green (component + playwright)

## Spec

\`docs/superpowers/specs/2026-05-10-qa-sweep-tier-2-design.md\` PR1 section.
EOF
)"
```

- [ ] **Step 2: Wait for CI green**

```bash
gh pr checks --watch
```

Expected: all checks green (test, lint, build, playwright).

- [ ] **Step 3: Dispatch spec-compliance reviewer subagent**

Use Agent tool with subagent_type=general-purpose, prompt:

> "Review PR #<PR_NUMBER> against the spec at \`docs/superpowers/specs/2026-05-10-qa-sweep-tier-2-design.md\` (PR1 section only). Check whether the implementation matches the spec's contract: UnauthedEmptyState prop API matches \`{ title, body, cta?, illustration? }\`; the primitive is at \`app/src/components/ui/UnauthedEmptyState.tsx\`; VaultView unauthed branch uses Path 1 (full marketing replacement, not disabled buttons); KeysView replaces null-return with primitive; PrivacyScoreCard click opens Sheet (not navigates) when unauthed; default CTA reuses wallet-adapter trigger. Report any spec deviations as MUST-FIX or POLISH categories. No code-quality review (separate dispatch handles that)."

- [ ] **Step 4: Dispatch code-quality reviewer subagent**

Use Agent tool with subagent_type=general-purpose, prompt:

> "Review PR #<PR_NUMBER> for code quality. Focus: (a) tests are honest (use \`makeFakeAuthState\` from \`app/src/test-utils/\` if helpful, exercise both authed and unauthed branches, no \`isAuthenticated\` references), (b) no semicolons in TS/TSX, (c) glass-neon styling consistency with PR 1 tokens, (d) accessibility — \`<h2>\` for primitive title, role/aria on buttons, focus management on Sheet open, (e) no swallowed errors in PrivacyScoreCard click handler, (f) Sheet \`ariaLabel\` matches Sipher convention. Report MUST-FIX vs POLISH separately."

- [ ] **Step 5: Apply review fixes**

For any MUST-FIX from either reviewer: apply fixes inline, re-run tests, push new commit. NEVER amend. POLISH-only items: optional, file as Tier 4 followup if substantive.

- [ ] **Step 6: Verify CI still green after fixes**

```bash
gh pr checks --watch
```

### Task 1.12: Merge PR1 + post-merge ritual

- [ ] **Step 1: Switch to main BEFORE merge (avoid worktree-owns-branch quirk)**

```bash
cd ~/local-dev/sipher
git checkout main
```

- [ ] **Step 2: Merge with delete-branch**

```bash
gh pr merge <PR_NUMBER> --merge --delete-branch
```

- [ ] **Step 3: Sync local main**

```bash
git pull
```

- [ ] **Step 4: Remove worktree + delete local branch**

```bash
git worktree remove .worktrees/feat-unauthed-empty-state-primitive
git branch -d feat/unauthed-empty-state-primitive
```

- [ ] **Step 5: Verify HEAD CI green**

```bash
gh run list --limit 1
```

Expected: latest run on main is green.

---

## PR2 — `feat/url-router` (closes #194)

Estimated: 6-8h. Mode: SUBAGENT-driven w/ TDD. Cross-cutting: ~12 files modified.

### Task 2.1: Create PR2 worktree

- [ ] **Step 1: Branch from updated main**

```bash
cd ~/local-dev/sipher
git fetch --prune
git checkout main && git pull
git worktree add .worktrees/feat-url-router -b feat/url-router
cd .worktrees/feat-url-router
pnpm install
pnpm --filter "@sipher/sdk" build
cd app && pnpm typecheck && pnpm test --run    # baseline: ~390 tests pass
```

### Task 2.2: Add `react-router-dom@^7` dependency

**Files:**
- Modify: `app/package.json`

- [ ] **Step 1: Add dependency**

```bash
cd app && pnpm add react-router-dom@^7
```

- [ ] **Step 2: Verify lockfile updated**

```bash
git diff package.json pnpm-lock.yaml
```

Expected: `react-router-dom` and `@types` (if v7 ships separate types) added. Lock entries fingerprinted.

- [ ] **Step 3: Commit**

```bash
git add package.json ../pnpm-lock.yaml
git commit -m "chore(app): add react-router-dom@^7"
```

### Task 2.3: Add `'about'` to View enum

**Files:**
- Modify: `app/src/stores/app.ts:5`

- [ ] **Step 1: Extend View union**

Change:

```ts
export type View = 'dashboard' | 'vault' | 'herald' | 'squad' | 'chat' | 'privacyReport' | 'chains' | 'deposit' | 'withdraw' | 'keys' | 'settings'
```

to:

```ts
export type View = 'dashboard' | 'vault' | 'herald' | 'squad' | 'chat' | 'privacyReport' | 'chains' | 'deposit' | 'withdraw' | 'keys' | 'settings' | 'about'
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: clean (no consumers reject the new value).

- [ ] **Step 3: Commit**

```bash
git add src/stores/app.ts
git commit -m "chore(app): add 'about' to View enum"
```

### Task 2.4: Write `useActiveView` hook test

**Files:**
- Create: `app/src/hooks/__tests__/useActiveView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { useActiveView } from '../useActiveView'

function wrapper(initialEntries: string[]) {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  )
}

describe('useActiveView', () => {
  it('maps / to dashboard', () => {
    const { result } = renderHook(() => useActiveView(), { wrapper: wrapper(['/']) })
    expect(result.current).toBe('dashboard')
  })

  it('maps /vault to vault', () => {
    const { result } = renderHook(() => useActiveView(), { wrapper: wrapper(['/vault']) })
    expect(result.current).toBe('vault')
  })

  it('maps /vault/deposit to deposit', () => {
    const { result } = renderHook(() => useActiveView(), { wrapper: wrapper(['/vault/deposit']) })
    expect(result.current).toBe('deposit')
  })

  it('maps /vault/withdraw to withdraw', () => {
    const { result } = renderHook(() => useActiveView(), { wrapper: wrapper(['/vault/withdraw']) })
    expect(result.current).toBe('withdraw')
  })

  it('maps /chains, /keys, /chat to their views', () => {
    expect(renderHook(() => useActiveView(), { wrapper: wrapper(['/chains']) }).result.current).toBe('chains')
    expect(renderHook(() => useActiveView(), { wrapper: wrapper(['/keys']) }).result.current).toBe('keys')
    expect(renderHook(() => useActiveView(), { wrapper: wrapper(['/chat']) }).result.current).toBe('chat')
  })

  it('maps /sentinel to squad (View enum name)', () => {
    const { result } = renderHook(() => useActiveView(), { wrapper: wrapper(['/sentinel']) })
    expect(result.current).toBe('squad')
  })

  it('maps /herald, /settings, /privacy-report, /about', () => {
    expect(renderHook(() => useActiveView(), { wrapper: wrapper(['/herald']) }).result.current).toBe('herald')
    expect(renderHook(() => useActiveView(), { wrapper: wrapper(['/settings']) }).result.current).toBe('settings')
    expect(renderHook(() => useActiveView(), { wrapper: wrapper(['/privacy-report']) }).result.current).toBe('privacyReport')
    expect(renderHook(() => useActiveView(), { wrapper: wrapper(['/about']) }).result.current).toBe('about')
  })

  it('falls back to dashboard for unknown paths', () => {
    expect(renderHook(() => useActiveView(), { wrapper: wrapper(['/unknown']) }).result.current).toBe('dashboard')
    expect(renderHook(() => useActiveView(), { wrapper: wrapper(['/vault/abc']) }).result.current).toBe('dashboard')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test --run src/hooks/__tests__/useActiveView.test.tsx
```

Expected: FAIL — module not found.

### Task 2.5: Implement `useActiveView` hook

**Files:**
- Create: `app/src/hooks/useActiveView.ts`

- [ ] **Step 1: Implement the hook**

```ts
import { useLocation } from 'react-router-dom'
import type { View } from '../stores/app'

const PATH_TO_VIEW: Record<string, View> = {
  '/': 'dashboard',
  '/vault': 'vault',
  '/vault/deposit': 'deposit',
  '/vault/withdraw': 'withdraw',
  '/chains': 'chains',
  '/keys': 'keys',
  '/chat': 'chat',
  '/herald': 'herald',
  '/sentinel': 'squad',
  '/settings': 'settings',
  '/privacy-report': 'privacyReport',
  '/about': 'about',
}

export function useActiveView(): View {
  const { pathname } = useLocation()
  return PATH_TO_VIEW[pathname] ?? 'dashboard'
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm test --run src/hooks/__tests__/useActiveView.test.tsx
```

Expected: PASS — all 8 cases.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useActiveView.ts src/hooks/__tests__/useActiveView.test.tsx
git commit -m "feat(app): add useActiveView hook (path → View name)"
```

### Task 2.6: Write `NotFoundView` test

**Files:**
- Create: `app/src/views/__tests__/NotFoundView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import NotFoundView from '../NotFoundView'

describe('NotFoundView', () => {
  it('renders not-found title', () => {
    render(
      <MemoryRouter>
        <NotFoundView />
      </MemoryRouter>,
    )
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
  })

  it('renders Back to Dashboard link to /', () => {
    render(
      <MemoryRouter>
        <NotFoundView />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: /back to dashboard/i })
    expect(link).toHaveAttribute('href', '/')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test --run src/views/__tests__/NotFoundView.test.tsx
```

Expected: FAIL — module not found.

### Task 2.7: Implement `NotFoundView`

**Files:**
- Create: `app/src/views/NotFoundView.tsx`

- [ ] **Step 1: Implement view**

```tsx
import { Link } from 'react-router-dom'
import { UnauthedEmptyState } from '../components/ui/UnauthedEmptyState'

export default function NotFoundView() {
  return (
    <UnauthedEmptyState
      title="Not found"
      body="We couldn't find that page."
      cta={
        <Link
          to="/"
          className="self-start text-xs px-3 py-1.5 rounded-md text-bg font-semibold"
          style={{ background: 'linear-gradient(90deg, var(--color-cyan), var(--color-violet))' }}
        >
          Back to Dashboard
        </Link>
      }
    />
  )
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm test --run src/views/__tests__/NotFoundView.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/views/NotFoundView.tsx src/views/__tests__/NotFoundView.test.tsx
git commit -m "feat(app): add NotFoundView for 404 catch-all"
```

### Task 2.8: Add `AboutPlaceholderView`

**Files:**
- Create: `app/src/views/AboutPlaceholderView.tsx`

- [ ] **Step 1: Implement minimal placeholder (PR3 fills with full content)**

```tsx
export default function AboutPlaceholderView() {
  return (
    <div data-testid="about-placeholder" className="flex flex-col items-start gap-4 p-8">
      <h1 className="text-2xl font-semibold">About SIPHER</h1>
      <p className="text-text-secondary">Coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 2: Commit (no tests yet — PR3 replaces with full AboutView)**

```bash
git add src/views/AboutPlaceholderView.tsx
git commit -m "chore(app): add AboutPlaceholderView (PR3 fills content)"
```

### Task 2.9: Identify `<ChatView>` rendering

**Files:**
- Audit: `app/src/App.tsx:59-64` — current `case 'chat':` block renders `<ChatSidebar fullScreen />` inside a `<div className="lg:hidden h-full">` wrapper.

- [ ] **Step 1: Extract that JSX into a standalone view**

Create `app/src/views/ChatView.tsx`:

```tsx
import ChatSidebar from '../components/ChatSidebar'

export default function ChatView() {
  return (
    <div data-testid="chat-view" className="lg:hidden h-full">
      <ChatSidebar fullScreen />
    </div>
  )
}
```

- [ ] **Step 2: Write a smoke test**

Create `app/src/views/__tests__/ChatView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ChatView from '../ChatView'

vi.mock('../../components/ChatSidebar', () => ({
  default: ({ fullScreen }: { fullScreen?: boolean }) => (
    <div data-testid="chat-sidebar-mock">{fullScreen ? 'full' : 'sheet'}</div>
  ),
}))

describe('ChatView', () => {
  it('renders ChatSidebar in fullScreen mode', () => {
    render(<ChatView />)
    expect(screen.getByTestId('chat-sidebar-mock')).toHaveTextContent('full')
  })
})
```

- [ ] **Step 3: Run tests**

```bash
pnpm test --run src/views/__tests__/ChatView.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/views/ChatView.tsx src/views/__tests__/ChatView.test.tsx
git commit -m "feat(app): extract ChatView from App.tsx switch"
```

### Task 2.10: Wire `<BrowserRouter>` + `<Routes>` in App.tsx

**Files:**
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Replace `renderView()` switch with `<Routes>`**

```tsx
import { useEffect, useMemo } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'

import Header from './components/Header'
import BottomNav from './components/BottomNav'
import ChatSidebar from './components/ChatSidebar'
import { BetaBanner } from './components/BetaBanner'
import { NetworkBanner } from './components/NetworkBanner'
import { Sheet } from './components/ui/Sheet'
import DashboardView from './views/DashboardView'
import VaultView from './views/VaultView'
import DepositView from './views/DepositView'
import WithdrawView from './views/WithdrawView'
import HeraldView from './views/HeraldView'
import SquadView from './views/SquadView'
import PrivacyReportView from './views/PrivacyReportView'
import ChainsView from './views/ChainsView'
import KeysView from './views/KeysView'
import SettingsView from './views/SettingsView'
import ChatView from './views/ChatView'
import NotFoundView from './views/NotFoundView'
import AboutPlaceholderView from './views/AboutPlaceholderView'
import { useAppStore } from './stores/app'
import { useAuth } from './hooks/useAuth'
import { useSSE } from './hooks/useSSE'
import { useNetworkConfigStore, fetchNetworkConfig } from './lib/networkConfig'
import { ToastProvider } from './providers/ToastProvider'
import { AuthSyncProvider } from './providers/AuthSyncProvider'

function AppShell() {
  const chatSheetOpen = useAppStore((s) => s.chatSheetOpen)
  const setChatSheetOpen = useAppStore((s) => s.setChatSheetOpen)
  const { token } = useAuth()
  const { events } = useSSE()
  const beta = useNetworkConfigStore((s) => s.config?.beta ?? false)

  return (
    <div className="flex flex-col h-dvh bg-bg">
      <BetaBanner beta={beta} />
      <NetworkBanner />
      <Header />

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <Routes>
            <Route path="/" element={<DashboardView events={events} />} />
            <Route path="/vault" element={<VaultView />} />
            <Route path="/vault/deposit" element={<DepositView />} />
            <Route path="/vault/withdraw" element={<WithdrawView />} />
            <Route path="/chains" element={<ChainsView />} />
            <Route path="/keys" element={<KeysView />} />
            <Route path="/chat" element={<ChatView />} />
            <Route path="/herald" element={<HeraldView token={token} />} />
            <Route path="/sentinel" element={<SquadView token={token} />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/privacy-report" element={<PrivacyReportView />} />
            <Route path="/about" element={<AboutPlaceholderView />} />
            <Route path="*" element={<NotFoundView />} />
          </Routes>
        </main>
      </div>

      <BottomNav />

      <Sheet
        open={chatSheetOpen}
        onClose={() => setChatSheetOpen(false)}
        ariaLabel="Ask SIPHER"
      >
        <ChatSidebar />
      </Sheet>
    </div>
  )
}

export default function App() {
  const config = useNetworkConfigStore((s) => s.config)
  const error = useNetworkConfigStore((s) => s.error)

  useEffect(() => {
    fetchNetworkConfig()
  }, [])

  const wallets = useMemo(() => [], [])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-text">
        <div className="max-w-md p-6 text-center">
          <h1 className="text-xl font-semibold mb-2">Sipher temporarily unavailable</h1>
          <p className="text-sm text-text-muted">{error}</p>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-text-muted">
        <p className="text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <ConnectionProvider endpoint={config.publicRpcUrl}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <ToastProvider>
              <AuthSyncProvider>
                <AppShell />
              </AuthSyncProvider>
            </ToastProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </BrowserRouter>
  )
}
```

Note: admin-redirect for HeraldView/SquadView/SettingsView is now component-level only (App.tsx no longer ternary-gates). Subagent verifies admin redirects exist in each view's useEffect (per PR 8 carry-forward).

- [ ] **Step 2: Run typecheck — expect ~12 errors**

```bash
pnpm typecheck
```

Expected: errors in Header.tsx, BottomNav.tsx, BetaBanner.tsx, PrivacyScoreCard.tsx, ChatSidebar.tsx, VaultView.tsx, SettingsView.tsx, etc. — anywhere `useAppStore.activeView` or `setActiveView` is read without the field still in the store. We'll fix consumers in Tasks 2.11-2.16.

- [ ] **Step 3: Run app tests — expect MANY failures**

```bash
pnpm test --run
```

Expected: dozens of failures because consumers haven't migrated yet. The next tasks fix one file at a time.

- [ ] **Step 4: Commit "WIP" snapshot (intermediate state)**

Skip — wait until consumers migrate before committing. The router wiring + consumer fixes ship as one logical change.

### Task 2.11: Migrate Header to router

**Files:**
- Modify: `app/src/components/Header.tsx`
- Modify: `app/src/components/__tests__/Header.test.tsx`

- [ ] **Step 1: Update Header to use `<Link>` + `useActiveView`**

Replace:
```tsx
const activeView = useAppStore((s) => s.activeView)
const setActiveView = useAppStore((s) => s.setActiveView)
```

with:
```tsx
import { Link, useNavigate } from 'react-router-dom'
import { useActiveView } from '../hooks/useActiveView'

const activeView = useActiveView()
const navigate = useNavigate()
```

Map View enum names to URL paths:
```tsx
const VIEW_TO_PATH: Record<View, string> = {
  dashboard: '/',
  vault: '/vault',
  chains: '/chains',
  keys: '/keys',
  chat: '/chat',
  deposit: '/vault/deposit',
  withdraw: '/vault/withdraw',
  herald: '/herald',
  squad: '/sentinel',
  settings: '/settings',
  privacyReport: '/privacy-report',
  about: '/about',
}
```

(Place this map at module scope at the top of Header.tsx, just below imports.)

Replace:
```tsx
<button onClick={() => setActiveView(tab.id)} ...>
```

with:
```tsx
<Link to={VIEW_TO_PATH[tab.id]} className={[...]} ...>
```

(Convert `<button>` to `<Link>` for nav tabs. Keep `<button>` for non-nav buttons like Ask SIPHER.)

The `handleAdminNavigate` becomes:
```tsx
const handleAdminNavigate = (view: AdminView) => {
  navigate(VIEW_TO_PATH[view])
}
```

- [ ] **Step 2: Update Header test to wrap in MemoryRouter**

Modify the existing Header.test.tsx to wrap renders in `<MemoryRouter>`:

```tsx
import { MemoryRouter } from 'react-router-dom'

function renderInRouter(ui: React.ReactElement, initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>,
  )
}
```

Replace existing `render(<Header />)` calls with `renderInRouter(<Header />)`. Update assertions that check setActiveView to instead check current pathname or use \`getByRole('link', { name: ... })\`.toHaveAttribute('href', '/vault')`.

- [ ] **Step 3: Run tests**

```bash
pnpm test --run src/components/__tests__/Header.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/Header.tsx src/components/__tests__/Header.test.tsx
git commit -m "refactor(app): migrate Header to react-router Link/useNavigate"
```

### Task 2.12: Migrate BottomNav to router

**Files:**
- Modify: `app/src/components/BottomNav.tsx`
- Modify: `app/src/components/__tests__/BottomNav.test.tsx`

- [ ] **Step 1: Update BottomNav similarly**

Same VIEW_TO_PATH map (extract to a shared module if duplication grows — but for now, inline). Replace setActiveView calls in nav buttons with `<Link>`. Replace setActiveView calls in More-drawer admin items with `navigate()`.

- [ ] **Step 2: Update BottomNav test (wrap in MemoryRouter)**

Same pattern as Task 2.11 Step 2.

- [ ] **Step 3: Run tests**

```bash
pnpm test --run src/components/__tests__/BottomNav.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/BottomNav.tsx src/components/__tests__/BottomNav.test.tsx
git commit -m "refactor(app): migrate BottomNav to react-router Link/useNavigate"
```

### Task 2.13: Migrate VaultView Withdraw + Deposit buttons

**Files:**
- Modify: `app/src/views/VaultView.tsx` (Shield to vault + Withdraw onClicks)
- Modify: `app/src/views/__tests__/VaultView.test.tsx`

- [ ] **Step 1: Replace `setActiveView('deposit'|'withdraw')` with `navigate('/vault/deposit'|'/vault/withdraw')`**

```tsx
import { useNavigate } from 'react-router-dom'

export default function VaultView() {
  const { token, status } = useAuthState()
  const navigate = useNavigate()
  // remove: const setActiveView = useAppStore((s) => s.setActiveView)
  // ...

  return (
    <div data-testid="vault-view" className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ShieldedVaultPanel
        // ...
        onWithdraw={() => navigate('/vault/withdraw')}
        // ...
      />
      <UnshieldedWalletPanel
        // ...
        onDeposit={() => navigate('/vault/deposit')}
        // ...
      />
    </div>
  )
}
```

- [ ] **Step 2: Update VaultView test to use MemoryRouter and assert pathname**

Replace `setActiveView` mock with `useNavigate` mock or pathname assertion via MemoryRouter. Pattern:

```tsx
const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

beforeEach(() => {
  navigateMock.mockReset()
  // ...
})

it('Withdraw CTA navigates to /vault/withdraw', async () => {
  // wrap render in MemoryRouter; existing fetch mocks unchanged
  render(<MemoryRouter><VaultView /></MemoryRouter>)
  const withdrawBtn = await screen.findByRole('button', { name: /withdraw/i })
  fireEvent.click(withdrawBtn)
  expect(navigateMock).toHaveBeenCalledWith('/vault/withdraw')
})
```

Drop the existing `vi.mock('../../stores/app', ...)` mock for setActiveView (no longer used).

- [ ] **Step 3: Run tests**

```bash
pnpm test --run src/views/__tests__/VaultView.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/views/VaultView.tsx src/views/__tests__/VaultView.test.tsx
git commit -m "refactor(app): VaultView CTAs use react-router useNavigate"
```

### Task 2.14: Migrate PrivacyScoreCard navigation

**Files:**
- Modify: `app/src/components/PrivacyScoreCard.tsx`
- Modify: `app/src/components/__tests__/PrivacyScoreCard.test.tsx`

- [ ] **Step 1: Replace `setActiveView('privacyReport')` with `navigate('/privacy-report')`**

```tsx
import { useNavigate } from 'react-router-dom'

export function PrivacyScoreCard({ data, delta }: PrivacyScoreCardProps) {
  const navigate = useNavigate()
  // remove: const setActiveView = useAppStore((s) => s.setActiveView)
  const { status } = useAuthState()
  const [teaserOpen, setTeaserOpen] = useState(false)

  const handleViewReport = () => {
    if (status === 'authed') {
      navigate('/privacy-report')
    } else {
      setTeaserOpen(true)
    }
  }
  // ...
}
```

- [ ] **Step 2: Update test to assert navigate call instead of store activeView**

Same pattern as Task 2.13: mock `useNavigate`, assert call. Replace the `expect(useAppStore.getState().activeView).toBe('privacyReport')` assertion with `expect(navigateMock).toHaveBeenCalledWith('/privacy-report')`. Wrap render in MemoryRouter.

- [ ] **Step 3: Run tests**

```bash
pnpm test --run src/components/__tests__/PrivacyScoreCard.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/PrivacyScoreCard.tsx src/components/__tests__/PrivacyScoreCard.test.tsx
git commit -m "refactor(app): PrivacyScoreCard uses react-router useNavigate"
```

### Task 2.15: Migrate admin views (Herald, Squad, Settings) redirects

**Files:**
- Modify: `app/src/views/HeraldView.tsx`, `app/src/views/SquadView.tsx`, `app/src/views/SettingsView.tsx`
- Modify: their test files

- [ ] **Step 1: For each admin view, replace `setActiveView('dashboard')` redirect with `useNavigate('/')`**

In HeraldView.tsx (mirror in SquadView/SettingsView):

```tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthState } from '../hooks/useAuthState'

export default function HeraldView({ token }: { token: string | null }) {
  const { isAdmin } = useAuthState()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAdmin) navigate('/')
  }, [isAdmin, navigate])

  if (!isAdmin) return null  // prevent flash of admin content

  // existing admin content
}
```

(If the existing HeraldView already has `useEffect(() => { if (!isAdmin) ... }, [isAdmin])` from PR 8, just replace the side-effect inside. Don't duplicate the effect.)

- [ ] **Step 2: Update each admin view's test to use MemoryRouter + assert navigate**

Pattern consistent with Tasks 2.13/2.14: mock `useNavigate`, render inside MemoryRouter, assert non-admin user triggers `navigate('/')`.

- [ ] **Step 3: Run tests**

```bash
pnpm test --run src/views/__tests__/HeraldView.test.tsx
pnpm test --run src/views/__tests__/SquadView.test.tsx
pnpm test --run src/views/__tests__/SettingsView.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit (one commit covers all 3 admin views)**

```bash
git add src/views/HeraldView.tsx src/views/SquadView.tsx src/views/SettingsView.tsx \
       src/views/__tests__/HeraldView.test.tsx src/views/__tests__/SquadView.test.tsx src/views/__tests__/SettingsView.test.tsx
git commit -m "refactor(app): admin views use useNavigate('/') for non-admin redirect"
```

### Task 2.16: Audit & migrate remaining `useAppStore.activeView` consumers

- [ ] **Step 1: Find consumers**

```bash
grep -rn "activeView\|setActiveView" src --include="*.tsx" --include="*.ts" | grep -v "__tests__" | grep -v "stores/app.ts"
```

Expected remaining: BetaBanner.tsx (audit — likely activeView read for some banner gating; remove or replace with `useActiveView`), ChatSidebar.tsx (audit), AuthSyncProvider.tsx (audit), DepositView.tsx + WithdrawView.tsx back-buttons (replace with `navigate('/vault')`).

- [ ] **Step 2: Migrate each remaining consumer**

For each: replace `useAppStore((s) => s.activeView)` with `useActiveView()` (or remove if not needed); replace `setActiveView(x)` with `navigate(VIEW_TO_PATH[x])` or direct path string.

Update tests inline (wrap in MemoryRouter).

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: clean. If errors remain, the consumer's test file likely also needs MemoryRouter wrap.

- [ ] **Step 4: Run app test suite**

```bash
pnpm test --run
```

Expected: all pass. If a test fails on "useNavigate must be used inside Router," wrap that test in MemoryRouter.

- [ ] **Step 5: Commit per consumer or one bundled commit**

```bash
git commit -m "refactor(app): migrate remaining activeView consumers to react-router"
```

### Task 2.17: Drop `activeView` field from store

**Files:**
- Modify: `app/src/stores/app.ts`
- Modify: `app/src/stores/__tests__/app.test.ts`

- [ ] **Step 1: Remove field + setter from store**

In `app/src/stores/app.ts`:

```ts
interface AppState {
  // remove: activeView: View
  // remove: setActiveView: (view: View) => void

  token: string | null
  // ... rest unchanged
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // remove: activeView: 'dashboard',
      // remove: setActiveView: (activeView) => set({ activeView }),

      token: null,
      // ... rest unchanged

      clearAuth: () => {
        // remove activeView from set: messages: [], activeView: 'dashboard'
        set({ token: null, isAdmin: false, expiresAt: null, messages: [] })
        onAuthClear.clearAll()
      },
      // ... rest unchanged
    }),
    // ...
  ),
)
```

(Keep View export — used by VIEW_TO_PATH maps and component types.)

- [ ] **Step 2: Update store test**

Remove any `expect(state.activeView).toBe('dashboard')` assertions. Adjust `clearAuth` test to not expect activeView reset.

- [ ] **Step 3: Run all tests**

```bash
pnpm test --run
```

Expected: all pass.

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: clean. If consumer migrations missed any reference, fix inline.

- [ ] **Step 5: Commit**

```bash
git add src/stores/app.ts src/stores/__tests__/app.test.ts
git commit -m "refactor(app): drop activeView from app store (router owns it)"
```

### Task 2.18: Add SPA fallback to vercel.json

**Files:**
- Modify: `vercel.json` at repo root

- [ ] **Step 1: Add rewrite rule**

```bash
cd ~/local-dev/sipher/.worktrees/feat-url-router
cat vercel.json
```

If `rewrites` is absent, add:

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/" }
  ]
}
```

(merge with existing `vercel.json` keys; preserve buildCommand etc.)

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "chore(vercel): add SPA fallback rewrite for client-side routing"
```

### Task 2.19: Update e2e specs (Playwright)

**Files:**
- Audit: `e2e/herald.spec.ts`, `e2e/squad.spec.ts`, any other e2e using nav

- [ ] **Step 1: Find e2e specs that navigate via Header/BottomNav**

```bash
grep -rn "data-testid\|setActiveView\|getByRole.*tab\|click.*Vault\|click.*Keys" e2e/
```

- [ ] **Step 2: Update selectors**

For each e2e spec that clicks a nav tab:
- Replace `data-testid` activeView lookups with `getByRole('link', { name: /Vault|Keys|Chains/ })`
- For mobile drawer (admin nav), continue with existing pattern (BottomNav More drawer items remain `<button>` triggering `navigate()`)
- Replace `await expect(page).toHaveURL(...)` assertions with the new paths

- [ ] **Step 3: Run e2e locally (if Playwright is configured for local dev)**

```bash
cd e2e && pnpm playwright test --reporter=list
```

If e2e requires backend or Vercel-deployed environment, skip local run and trust CI.

- [ ] **Step 4: Commit**

```bash
git add e2e/
git commit -m "test(e2e): update nav selectors for react-router migration"
```

### Task 2.20: Full PR2 verification gate

- [ ] **Step 1: Run full app test suite**

```bash
cd app && pnpm test --run
```

Expected: ~390+ tests pass (PR1 baseline + new useActiveView/NotFoundView/ChatView + modified existing). Target: ~400 tests.

- [ ] **Step 2: Run repo-root tests**

```bash
cd .. && pnpm test --run
```

Expected: agent + sdk tests still green.

- [ ] **Step 3: Typecheck**

```bash
cd app && pnpm typecheck
```

Expected: clean.

- [ ] **Step 4: Push branch**

```bash
git push -u origin feat/url-router
```

### Task 2.21: Open PR2 + two-stage review

- [ ] **Step 1: Create PR**

```bash
gh pr create --title "feat(app): URL router migration with react-router-dom@^7 (Tier 2 PR2)" --body "$(cat <<'EOF'
## Summary

Closes #194 (URL router missing). Tier 2 PR2 of the QA sweep.

- Adds \`react-router-dom@^7\` and \`<BrowserRouter>\` to App shell
- 13 routes total: 11 existing views + \`/about\` placeholder + \`*\` 404
- \`/vault/deposit\` + \`/vault/withdraw\` as nested vault routes
- New \`<NotFoundView>\` for unknown paths
- \`<AboutPlaceholderView>\` lands here; PR3 fills with marketing content
- \`<ChatView>\` extracted from inline App.tsx switch
- \`useAppStore.activeView\` field deleted; \`useActiveView()\` derives from \`useLocation().pathname\`
- Header + BottomNav nav use \`<Link>\` / \`useNavigate()\`
- Admin views (Herald/Squad/Settings) redirect non-admins via \`useNavigate('/')\`
- E2E specs updated for URL-based navigation
- vercel.json adds SPA fallback rewrite

## Test plan

- [ ] Direct visit to \`/vault\`, \`/chains\`, \`/keys\`, \`/privacy-report\`, \`/about\` mounts respective views
- [ ] Browser back/forward + bookmarks work
- [ ] Invalid path \`/foo\` renders NotFoundView
- [ ] Non-admin direct visit to \`/herald\` redirects to \`/\`
- [ ] PR1's UnauthedEmptyState mounts on \`/vault\`, \`/keys\` (regression check)
- [ ] PR1's PrivacyScoreCard Sheet teaser still opens for unauthed
- [ ] CI green (component + playwright)

## Spec

\`docs/superpowers/specs/2026-05-10-qa-sweep-tier-2-design.md\` PR2 section.
EOF
)"
```

- [ ] **Step 2: Wait for CI green**

```bash
gh pr checks --watch
```

- [ ] **Step 3: Dispatch spec-compliance reviewer subagent**

Use Agent tool with subagent_type=general-purpose, prompt:

> "Review PR #<PR_NUMBER> against the spec at \`docs/superpowers/specs/2026-05-10-qa-sweep-tier-2-design.md\` (PR2 section). Verify: react-router-dom@^7 installed; \`<BrowserRouter>\` wraps shell; 13 routes match spec table exactly; NotFoundView for \`*\`; AboutPlaceholderView for \`/about\`; ChatView for \`/chat\`; useActiveView pathname → View mapping is correct; Header/BottomNav use Link/useNavigate; admin views redirect via useNavigate('/'); store no longer has activeView; vercel.json has SPA fallback. Report any spec deviations."

- [ ] **Step 4: Dispatch code-quality reviewer subagent**

Use Agent tool with subagent_type=general-purpose, prompt:

> "Review PR #<PR_NUMBER> for code quality. Focus: (a) tests use MemoryRouter wrappers consistently, (b) no flash of admin content (return null after redirect dispatch), (c) no \`useNavigate\` calls outside React render cycle, (d) VIEW_TO_PATH map duplication acceptable or extract to shared util, (e) E2E selectors are stable (getByRole over data-testid), (f) admin redirect doesn't fire on initial mount before useAuthState hydrates, (g) no semicolons, (h) clearAuth no longer references activeView. Report MUST-FIX vs POLISH separately."

- [ ] **Step 5: Apply review fixes + re-verify**

### Task 2.22: Merge PR2 + post-merge ritual

- [ ] **Step 1: Switch to main**

```bash
cd ~/local-dev/sipher && git checkout main
```

- [ ] **Step 2: Merge**

```bash
gh pr merge <PR_NUMBER> --merge --delete-branch
```

- [ ] **Step 3: Sync + cleanup**

```bash
git pull
git worktree remove .worktrees/feat-url-router
git branch -d feat/url-router
gh run list --limit 1   # verify CI green on main
```

---

## PR3 — `feat/onboarding-content` (closes #200 + #204)

Estimated: 8-10h. Mode: SUBAGENT-driven w/ TDD. Iterative copy review with RECTOR via Vercel preview.

### Task 3.1: Create PR3 worktree

- [ ] **Step 1: Branch from updated main**

```bash
cd ~/local-dev/sipher
git fetch --prune
git checkout main && git pull
git worktree add .worktrees/feat-onboarding-content -b feat/onboarding-content
cd .worktrees/feat-onboarding-content
pnpm install
pnpm --filter "@sipher/sdk" build
cd app && pnpm typecheck && pnpm test --run    # baseline ~400 tests pass
```

### Task 3.2: Write `<Footer>` test

**Files:**
- Create: `app/src/components/__tests__/Footer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Footer } from '../Footer'

describe('Footer', () => {
  function renderFooter() {
    return render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
  }

  it('renders docs link with target=_blank + rel=noopener', () => {
    renderFooter()
    const link = screen.getByRole('link', { name: /docs/i })
    expect(link).toHaveAttribute('href', 'https://docs.sip-protocol.org')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders blog, github, x, sip-protocol links', () => {
    renderFooter()
    expect(screen.getByRole('link', { name: /blog/i })).toHaveAttribute('href', 'https://blog.sip-protocol.org')
    expect(screen.getByRole('link', { name: /github/i })).toHaveAttribute('href', 'https://github.com/sip-protocol/sipher')
    expect(screen.getByRole('link', { name: /^x$|twitter|x \(/i })).toHaveAttribute('href', expect.stringMatching(/x\.com/))
    expect(screen.getByRole('link', { name: /sip-protocol\.org/i })).toHaveAttribute('href', 'https://sip-protocol.org')
  })

  it('renders copyright', () => {
    renderFooter()
    expect(screen.getByText(/© 2026 SIP Labs/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify failure**

```bash
pnpm test --run src/components/__tests__/Footer.test.tsx
```

Expected: FAIL — module not found.

### Task 3.3: Implement `<Footer>`

**Files:**
- Create: `app/src/components/Footer.tsx`

- [ ] **Step 1: Implement footer**

```tsx
const LINKS = [
  { href: 'https://docs.sip-protocol.org', label: 'Docs' },
  { href: 'https://blog.sip-protocol.org', label: 'Blog' },
  { href: 'https://github.com/sip-protocol/sipher', label: 'GitHub' },
  { href: 'https://x.com/SIPProtocol', label: 'X' },
  { href: 'https://sip-protocol.org', label: 'sip-protocol.org' },
]

export function Footer() {
  return (
    <footer
      data-testid="app-footer"
      className="border-t border-line px-4 py-4 lg:px-6 flex flex-wrap items-center gap-4 text-2xs text-text-muted"
    >
      <nav className="flex flex-wrap gap-3">
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-secondary transition-colors"
          >
            {l.label}
          </a>
        ))}
      </nav>
      <span className="ml-auto">© 2026 SIP Labs</span>
    </footer>
  )
}
```

(If RECTOR prefers a different X handle, change `https://x.com/SIPProtocol`. Subagent flags this in PR description for RECTOR confirmation.)

- [ ] **Step 2: Run tests**

```bash
pnpm test --run src/components/__tests__/Footer.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Mount Footer in App shell**

In `app/src/App.tsx`, add inside `<AppShell>` after `<BottomNav />`:

```tsx
import { Footer } from './components/Footer'

// inside AppShell return JSX, add Footer below BottomNav:
<BottomNav />
<Footer />
```

- [ ] **Step 4: Run all tests**

```bash
pnpm test --run
```

Expected: all pass. If any test fails because Footer pulls in MemoryRouter context, wrap that test's render in MemoryRouter.

- [ ] **Step 5: Commit**

```bash
git add src/components/Footer.tsx src/components/__tests__/Footer.test.tsx src/App.tsx
git commit -m "feat(app): add Footer mounted in App shell (#200)"
```

### Task 3.4: Write `<Tooltip>` test

**Files:**
- Create: `app/src/components/ui/__tests__/Tooltip.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Tooltip } from '../Tooltip'

describe('Tooltip', () => {
  it('renders trigger element', () => {
    render(
      <Tooltip content="Helpful info">
        <button>Trigger</button>
      </Tooltip>,
    )
    expect(screen.getByRole('button', { name: 'Trigger' })).toBeInTheDocument()
  })

  it('does not show tooltip content by default', () => {
    render(
      <Tooltip content="Helpful info">
        <button>Trigger</button>
      </Tooltip>,
    )
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('shows tooltip on mouseEnter', () => {
    render(
      <Tooltip content="Helpful info">
        <button>Trigger</button>
      </Tooltip>,
    )
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Helpful info')
  })

  it('hides tooltip on mouseLeave', () => {
    render(
      <Tooltip content="Helpful info">
        <button>Trigger</button>
      </Tooltip>,
    )
    fireEvent.mouseEnter(screen.getByRole('button'))
    fireEvent.mouseLeave(screen.getByRole('button'))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('shows tooltip on focus', () => {
    render(
      <Tooltip content="Helpful info">
        <button>Trigger</button>
      </Tooltip>,
    )
    fireEvent.focus(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Helpful info')
  })

  it('hides tooltip on blur', () => {
    render(
      <Tooltip content="Helpful info">
        <button>Trigger</button>
      </Tooltip>,
    )
    fireEvent.focus(screen.getByRole('button'))
    fireEvent.blur(screen.getByRole('button'))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('sets aria-describedby on trigger when shown', () => {
    render(
      <Tooltip content="Helpful info">
        <button>Trigger</button>
      </Tooltip>,
    )
    fireEvent.mouseEnter(screen.getByRole('button'))
    const trigger = screen.getByRole('button')
    const tooltip = screen.getByRole('tooltip')
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

```bash
pnpm test --run src/components/ui/__tests__/Tooltip.test.tsx
```

Expected: FAIL — module not found.

### Task 3.5: Implement `<Tooltip>`

**Files:**
- Create: `app/src/components/ui/Tooltip.tsx`

- [ ] **Step 1: Implement tooltip**

```tsx
import { cloneElement, useId, useState, type ReactElement, type ReactNode } from 'react'

export interface TooltipProps {
  content: ReactNode
  children: ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
}

const SIDE_CLASSES: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
  right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
  left: 'right-full mr-2 top-1/2 -translate-y-1/2',
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)

  const trigger = cloneElement(children, {
    'aria-describedby': open ? id : undefined,
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
  } as Record<string, unknown>)

  return (
    <span className="relative inline-flex">
      {trigger}
      {open && (
        <span
          role="tooltip"
          id={id}
          className={`absolute z-tooltip whitespace-pre-line max-w-xs glass-strong rounded-md px-2 py-1.5 text-2xs text-text shadow-lg ${SIDE_CLASSES[side]}`}
        >
          {content}
        </span>
      )}
    </span>
  )
}
```

(If `z-tooltip` Tailwind utility is missing, add `--z-tooltip: 50` to `theme.css` `@utility` block matching PR 1's pattern. Subagent verifies.)

- [ ] **Step 2: Run tests**

```bash
pnpm test --run src/components/ui/__tests__/Tooltip.test.tsx
```

Expected: PASS — all 7 cases.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Tooltip.tsx src/components/ui/__tests__/Tooltip.test.tsx
git commit -m "feat(app): add Tooltip primitive"
```

### Task 3.6: Write `<JargonTerm>` test

**Files:**
- Create: `app/src/components/ui/__tests__/JargonTerm.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { JargonTerm } from '../JargonTerm'

describe('JargonTerm', () => {
  it('renders the term as the visible label', () => {
    render(<JargonTerm term="Privacy Score">{'Privacy Score'}</JargonTerm>)
    expect(screen.getAllByText('Privacy Score').length).toBeGreaterThan(0)
  })

  it('shows definition on hover for Privacy Score', () => {
    render(<JargonTerm term="Privacy Score">Privacy Score</JargonTerm>)
    const trigger = screen.getByRole('button')
    fireEvent.mouseEnter(trigger)
    expect(screen.getByRole('tooltip')).toHaveTextContent(/composite metric/i)
  })

  it('shows definition for Stealth Address Tree', () => {
    render(<JargonTerm term="Stealth Address Tree">tree</JargonTerm>)
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toHaveTextContent(/one-time recipient/i)
  })

  it('shows definition for Vault PDA', () => {
    render(<JargonTerm term="Vault PDA">PDA</JargonTerm>)
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toHaveTextContent(/program-derived address/i)
  })

  it('shows definition for fee 50 bps', () => {
    render(<JargonTerm term="fee 50 bps">50 bps</JargonTerm>)
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toHaveTextContent(/0\.5%/)
  })

  it('shows definition for Pedersen', () => {
    render(<JargonTerm term="Pedersen">Pedersen</JargonTerm>)
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toHaveTextContent(/commitment scheme/i)
  })

  it('shows definition for DKSAP', () => {
    render(<JargonTerm term="DKSAP">DKSAP</JargonTerm>)
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByRole('tooltip')).toHaveTextContent(/dual-key/i)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

```bash
pnpm test --run src/components/ui/__tests__/JargonTerm.test.tsx
```

Expected: FAIL — module not found.

### Task 3.7: Implement `<JargonTerm>`

**Files:**
- Create: `app/src/components/ui/JargonTerm.tsx`

- [ ] **Step 1: Implement wrapper**

```tsx
import type { ReactNode } from 'react'
import { Info } from '@phosphor-icons/react'
import { Tooltip } from './Tooltip'

export const JARGON_DEFINITIONS = {
  'Privacy Score':
    'Composite metric of address reuse, amount patterns, timing correlation, and counterparty exposure. Higher = more private.',
  'Stealth Address Tree':
    'Each leaf is a one-time recipient address. Connecting your wallet derives the tree from your viewing key.',
  'Vault PDA':
    'Program-Derived Address — the on-chain account holding shielded vault state. Owned by the Sipher Vault program, not by any wallet.',
  'fee 50 bps':
    '0.5% fee on shielded transfers — funds protocol development. Paid in the transferred token.',
  'Pedersen':
    'Cryptographic commitment scheme used to hide amounts. Each commitment combines value × G + blinding × H, where G and H are base points on the secp256k1 curve.',
  'DKSAP':
    "Dual-Key Stealth Address Protocol — sender derives a one-time recipient address from the recipient's spending + viewing public keys. Only the recipient can spend.",
} as const

export type JargonKey = keyof typeof JARGON_DEFINITIONS

export interface JargonTermProps {
  term: JargonKey
  children: ReactNode
}

export function JargonTerm({ term, children }: JargonTermProps) {
  return (
    <Tooltip content={JARGON_DEFINITIONS[term]}>
      <button type="button" className="inline-flex items-center gap-1 cursor-help underline decoration-dotted">
        {children}
        <Info size={12} className="text-text-muted" />
      </button>
    </Tooltip>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm test --run src/components/ui/__tests__/JargonTerm.test.tsx
```

Expected: PASS — all 7 cases.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/JargonTerm.tsx src/components/ui/__tests__/JargonTerm.test.tsx
git commit -m "feat(app): add JargonTerm wrapper with 6 term definitions"
```

### Task 3.8: Write `<Banner>` test

**Files:**
- Create: `app/src/components/ui/__tests__/Banner.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Banner } from '../Banner'

describe('Banner', () => {
  it('renders children', () => {
    render(<Banner kind="info">Connect a wallet</Banner>)
    expect(screen.getByText('Connect a wallet')).toBeInTheDocument()
  })

  it('uses role=status for info kind', () => {
    render(<Banner kind="info">x</Banner>)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('uses role=alert for warning + error kinds', () => {
    const { rerender } = render(<Banner kind="warning">x</Banner>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    rerender(<Banner kind="error">x</Banner>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('applies info variant tone classes', () => {
    const { container } = render(<Banner kind="info">x</Banner>)
    expect(container.firstChild).toHaveClass(/border-cyan/, /text-cyan/)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

```bash
pnpm test --run src/components/ui/__tests__/Banner.test.tsx
```

Expected: FAIL — module not found.

### Task 3.9: Implement `<Banner>`

**Files:**
- Create: `app/src/components/ui/Banner.tsx`

- [ ] **Step 1: Implement banner**

```tsx
import type { ReactNode } from 'react'

export interface BannerProps {
  kind: 'info' | 'warning' | 'error'
  children: ReactNode
}

const TONES: Record<BannerProps['kind'], string> = {
  info: 'border-cyan/40 text-cyan bg-cyan/5',
  warning: 'border-amber-500/40 text-amber-400 bg-amber-500/5',
  error: 'border-danger/40 text-danger bg-danger-soft',
}

export function Banner({ kind, children }: BannerProps) {
  const role = kind === 'info' ? 'status' : 'alert'
  return (
    <div
      role={role}
      data-testid="banner"
      className={`border rounded-md px-3 py-2 text-xs ${TONES[kind]}`}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm test --run src/components/ui/__tests__/Banner.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Banner.tsx src/components/ui/__tests__/Banner.test.tsx
git commit -m "feat(app): add Banner primitive"
```

### Task 3.10: Add Banner to unauthed Vault/Keys/Chains

**Files:**
- Modify: `app/src/views/VaultView.tsx`, `app/src/views/KeysView.tsx`, `app/src/views/ChainsView.tsx`
- Modify: their test files

- [ ] **Step 1: For each unauthed branch, add `<Banner>` above `<UnauthedEmptyState>`**

In VaultView.tsx unauthed branch (replace existing return):

```tsx
if (status !== 'authed') {
  return (
    <div className="flex flex-col gap-4">
      <Banner kind="info">
        Vault is a connected-wallet feature. Connect your wallet to deposit, manage stealth keys, and view your shielded balance.
      </Banner>
      <UnauthedEmptyState
        title="Shielded Vault"
        body={...}
        illustration={<RoutePreviewCard wallet="" />}
      />
    </div>
  )
}
```

Add similar block to KeysView.tsx and ChainsView.tsx (latter only if ChainsView currently has an unauthed gating; subagent verifies. If ChainsView shows public data even when unauthed, leave alone).

- [ ] **Step 2: Add tests asserting Banner presence**

In each modified test:

```tsx
it('renders connect-wallet Banner above UnauthedEmptyState when unauthed', () => {
  // ... mock unauthed
  render(...)
  const banner = screen.getByRole('status')
  expect(banner).toHaveTextContent(/connected-wallet feature|connect your wallet/i)
})
```

- [ ] **Step 3: Run tests**

```bash
pnpm test --run src/views/__tests__/VaultView.test.tsx \
                src/views/__tests__/KeysView.test.tsx \
                src/views/__tests__/ChainsView.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/views/VaultView.tsx src/views/KeysView.tsx src/views/ChainsView.tsx \
       src/views/__tests__/VaultView.test.tsx src/views/__tests__/KeysView.test.tsx src/views/__tests__/ChainsView.test.tsx
git commit -m "feat(app): add connect-wallet Banner on unauthed Vault/Keys/Chains (#204)"
```

### Task 3.11: Write `<AboutView>` test

**Files:**
- Create: `app/src/views/__tests__/AboutView.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AboutView from '../AboutView'

function renderAbout() {
  return render(
    <MemoryRouter>
      <AboutView />
    </MemoryRouter>,
  )
}

describe('AboutView', () => {
  it('renders the hero h1', () => {
    renderAbout()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('mentions both wallet and agent identities', () => {
    renderAbout()
    expect(screen.getByText(/wallet/i)).toBeInTheDocument()
    expect(screen.getByText(/agent/i)).toBeInTheDocument()
  })

  it('renders Open SIPHER link to /', () => {
    renderAbout()
    const link = screen.getByRole('link', { name: /open sipher/i })
    expect(link).toHaveAttribute('href', '/')
  })

  it('renders docs link with target=_blank', () => {
    renderAbout()
    const link = screen.getByRole('link', { name: /read the docs/i })
    expect(link).toHaveAttribute('href', expect.stringContaining('docs.sip-protocol.org'))
    expect(link).toHaveAttribute('target', '_blank')
  })
})
```

- [ ] **Step 2: Run test to verify failure**

```bash
pnpm test --run src/views/__tests__/AboutView.test.tsx
```

Expected: FAIL — module not found.

### Task 3.12: Implement `<AboutView>` (replaces AboutPlaceholderView)

**Files:**
- Create: `app/src/views/AboutView.tsx`
- Delete: `app/src/views/AboutPlaceholderView.tsx`
- Modify: `app/src/App.tsx` (swap import)

- [ ] **Step 1: Implement AboutView with hero + wallet/agent sections + CTAs**

```tsx
import { Link } from 'react-router-dom'

export default function AboutView() {
  return (
    <div data-testid="about-view" className="flex flex-col gap-12 max-w-4xl mx-auto py-8">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl md:text-5xl font-semibold leading-tight">
          Privacy-by-default for Solana
        </h1>
        <p className="text-base text-text-secondary leading-relaxed">
          SIPHER is a wallet and an autonomous agent for shielded payments, swaps, and stealth-address management. Stealth output by default. Real Pedersen commitments. Multi-chain.
        </p>
        <div className="flex gap-3">
          <Link
            to="/"
            className="text-sm px-4 py-2 rounded-md text-bg font-semibold"
            style={{ background: 'linear-gradient(90deg, var(--color-cyan), var(--color-violet))' }}
          >
            Open SIPHER
          </Link>
          <a
            href="https://docs.sip-protocol.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-4 py-2 rounded-md border border-line text-text-secondary hover:text-text"
          >
            Read the docs
          </a>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-strong rounded-2xl p-6 flex flex-col gap-3">
          <div className="text-2xs text-cyan" style={{ letterSpacing: 'var(--tracking-widest)' }}>
            ◆ WALLET
          </div>
          <h2 className="text-lg font-semibold">Stealth-first wallet</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Every received payment lands at a one-time stealth address. Viewing keys give selective disclosure for compliance. 12 chains supported via cross-chain shielded transfers.
          </p>
        </div>
        <div className="glass-strong rounded-2xl p-6 flex flex-col gap-3">
          <div className="text-2xs text-violet" style={{ letterSpacing: 'var(--tracking-widest)' }}>
            ◇ AGENT
          </div>
          <h2 className="text-lg font-semibold">Autonomous co-pilot</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            HERALD responds to mentions on X. SENTINEL audits high-risk actions before they fire. Ask SIPHER chat handles privacy operations conversationally — deposits, swaps, sweeps, threat checks.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Architecture</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Anchor program on Solana mainnet. Pedersen commitments hide amounts. Stealth addresses hide recipients. Viewing keys preserve compliance. Read the <a href="https://docs.sip-protocol.org" target="_blank" rel="noopener noreferrer" className="text-cyan underline">technical docs</a> for the full breakdown.
        </p>
      </section>

      <section className="flex flex-wrap gap-3">
        <a
          href="https://github.com/sip-protocol/sipher"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm px-4 py-2 rounded-md border border-line text-text-secondary hover:text-text"
        >
          Star on GitHub
        </a>
        <a
          href="https://x.com/SIPProtocol"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm px-4 py-2 rounded-md border border-line text-text-secondary hover:text-text"
        >
          Follow on X
        </a>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Replace AboutPlaceholderView import in App.tsx**

```tsx
// import AboutPlaceholderView from './views/AboutPlaceholderView'  // remove
import AboutView from './views/AboutView'  // add

// inside Routes:
<Route path="/about" element={<AboutView />} />
```

- [ ] **Step 3: Delete the placeholder**

```bash
rm src/views/AboutPlaceholderView.tsx
```

- [ ] **Step 4: Run tests**

```bash
pnpm test --run src/views/__tests__/AboutView.test.tsx
pnpm test --run    # full suite to catch any AboutPlaceholderView reference leaks
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/views/AboutView.tsx src/views/__tests__/AboutView.test.tsx src/App.tsx
git rm src/views/AboutPlaceholderView.tsx
git commit -m "feat(app): full AboutView marketing page (replaces placeholder, #200)"
```

### Task 3.13: Expand Privacy Graph empty-state copy

**Files:**
- Modify: `app/src/components/PrivacyGraph.tsx:63`
- Modify: `app/src/components/__tests__/PrivacyGraph.test.tsx`

- [ ] **Step 1: Read the existing PrivacyGraph file to find the empty-state line**

```bash
grep -n "Connect a wallet to see" src/components/PrivacyGraph.tsx
```

Expected: line ~63.

- [ ] **Step 2: Update the test to assert the new expanded copy**

```tsx
it('renders expanded educational empty-state copy when unauthed', () => {
  // ... mock unauthed
  render(<PrivacyGraph />)
  expect(screen.getByText(/each node is a one-time stealth address/i)).toBeInTheDocument()
  expect(screen.getByText(/connect a wallet and send\/receive shielded payments/i)).toBeInTheDocument()
})
```

(Replace any existing test that asserts the old short copy.)

- [ ] **Step 3: Run test to verify failure**

```bash
pnpm test --run src/components/__tests__/PrivacyGraph.test.tsx
```

Expected: FAIL on the new assertion.

- [ ] **Step 4: Update the empty-state copy in PrivacyGraph.tsx**

Replace:

```tsx
Connect a wallet to see your privacy graph.
```

with (a 2-line educational version, structure preserved):

```tsx
<p className="text-sm text-text-secondary">
  Each node is a one-time stealth address.
</p>
<p className="text-xs text-text-muted mt-1">
  Connect a wallet and send/receive shielded payments to populate.
</p>
```

(Adjust JSX to match existing card structure.)

- [ ] **Step 5: Run tests**

```bash
pnpm test --run src/components/__tests__/PrivacyGraph.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/PrivacyGraph.tsx src/components/__tests__/PrivacyGraph.test.tsx
git commit -m "feat(app): expand Privacy Graph educational empty-state copy (#200)"
```

### Task 3.14: Wire JargonTerm tooltips on key labels

**Files:**
- Modify: `app/src/views/DashboardView.tsx` (or wherever Privacy Score label, Pedersen mentions live)
- Modify: `app/src/views/VaultView.tsx` (Vault PDA, fee 50 bps in authed branch)
- Modify: their test files

- [ ] **Step 1: Find existing labels to wrap**

```bash
grep -rn "PRIVACY SCORE\|Privacy Score\|Vault PDA\|fee 50\|Pedersen\|DKSAP" src --include="*.tsx" --include="*.ts" | grep -v "__tests__"
```

- [ ] **Step 2: For each match, wrap the term in `<JargonTerm>`**

Example in PrivacyScoreCard.tsx (already exists):

```tsx
<div className="text-2xs text-text-muted" style={{ letterSpacing: 'var(--tracking-widest)' }}>
  <JargonTerm term="Privacy Score">PRIVACY SCORE</JargonTerm>
</div>
```

In DashboardView.tsx wherever Pedersen / DKSAP appear in feature descriptions, wrap inline.

In VaultView.tsx authed branch wherever "Vault PDA" or fee labels appear.

If a term isn't currently visible in the UI (e.g., Pedersen mentioned in a doc string only), no change needed — only wrap visible terms.

- [ ] **Step 3: Add a test asserting the wrap takes effect**

In each modified test:

```tsx
it('wraps Privacy Score label in JargonTerm tooltip', () => {
  render(<PrivacyScoreCard data={fakeData} />)
  fireEvent.mouseEnter(screen.getByText(/privacy score/i).closest('button')!)
  expect(screen.getByRole('tooltip')).toHaveTextContent(/composite metric/i)
})
```

- [ ] **Step 4: Run all affected tests**

```bash
pnpm test --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ...
git commit -m "feat(app): wrap jargon terms in JargonTerm tooltips (#200)"
```

### Task 3.15: Full PR3 verification gate

- [ ] **Step 1: Run full app test suite**

```bash
cd app && pnpm test --run
```

Expected: ~430+ tests pass (Tier 0+1 + PR1 + PR2 + ~30 new tests). Target: ~430-440 tests.

- [ ] **Step 2: Run repo-root tests**

```bash
cd .. && pnpm test --run
```

Expected: agent + sdk green.

- [ ] **Step 3: Typecheck**

```bash
cd app && pnpm typecheck
```

Expected: clean.

- [ ] **Step 4: Push branch**

```bash
git push -u origin feat/onboarding-content
```

### Task 3.16: Open PR3 + iterative copy review with RECTOR

- [ ] **Step 1: Create PR**

```bash
gh pr create --title "feat(app): Footer + Tooltip + JargonTerm + AboutView + Banner (Tier 2 PR3)" --body "$(cat <<'EOF'
## Summary

Closes #200 (onboarding gap), #204 (auth-fallback breadcrumb). Tier 2 PR3 of the QA sweep.

- New \`<Footer>\` component, mounted in App shell — docs / blog / GitHub / X / sip-protocol.org / © 2026 SIP Labs
- New \`<Tooltip>\` primitive — hover/focus-triggered, ARIA-described
- New \`<JargonTerm>\` wrapper with 6 term definitions (Privacy Score, Stealth Address Tree, Vault PDA, fee 50 bps, Pedersen, DKSAP)
- New \`<Banner>\` primitive (info/warning/error tones); used for connect-wallet breadcrumb on unauthed Vault/Keys/Chains
- New \`<AboutView>\` marketing page at \`/about\` (replaces PR2's AboutPlaceholderView)
- Privacy Graph empty-state copy expanded ("Each node is a one-time stealth address...")

## Copy review

@RECTOR — Vercel preview will include /about marketing copy + tooltip definitions + footer X handle. Please review and request edits inline. Iterations land as commits on this branch (NOT new PRs).

## Test plan

- [ ] Vercel preview /about renders hero + wallet identity + agent identity + CTAs
- [ ] Footer visible on /, /vault, /keys, /about, /privacy-report, /herald, NotFound
- [ ] Hover Privacy Score label → tooltip with composite-metric definition
- [ ] Hover Vault PDA label → tooltip with Program-Derived Address definition
- [ ] Unauthed visit to /vault → connect-wallet Banner above UnauthedEmptyState
- [ ] CI green (component + playwright)

## Spec

\`docs/superpowers/specs/2026-05-10-qa-sweep-tier-2-design.md\` PR3 section.
EOF
)"
```

- [ ] **Step 2: Wait for CI green**

```bash
gh pr checks --watch
```

- [ ] **Step 3: Dispatch spec-compliance reviewer subagent**

Use Agent tool with subagent_type=general-purpose, prompt:

> "Review PR #<PR_NUMBER> against the spec at \`docs/superpowers/specs/2026-05-10-qa-sweep-tier-2-design.md\` (PR3 section). Verify: \`<Footer>\` mounted in App shell, all 5 links + copyright; \`<Tooltip>\` primitive props match spec (content, children, side?); \`<JargonTerm>\` covers all 6 terms; \`<Banner>\` info/warning/error kinds; \`<AboutView>\` replaces AboutPlaceholderView with hero/wallet identity/agent identity/CTAs; Privacy Graph empty-state copy expanded; Banner mounted on unauthed Vault/Keys/Chains. Report any spec deviations."

- [ ] **Step 4: Dispatch code-quality reviewer subagent**

Use Agent tool with subagent_type=general-purpose, prompt:

> "Review PR #<PR_NUMBER> for code quality. Focus: (a) accessibility — Tooltip aria-describedby, Banner role=status/alert, AboutView semantic h1/h2, Footer nav landmark; (b) glass-neon consistency with existing tokens; (c) no semicolons; (d) JargonTerm trigger button has cursor-help and underline-decoration-dotted for affordance signaling; (e) Footer external links all have target=_blank + rel=noopener noreferrer; (f) AboutView responsive (md:grid-cols-2 etc.); (g) tests use MemoryRouter wrappers where needed. Report MUST-FIX vs POLISH separately."

- [ ] **Step 5: Apply review fixes; iterate copy with RECTOR via inline commits**

Copy iteration cycle: RECTOR reviews Vercel preview → comments on PR with edit requests → subagent applies edits as new commits on the branch → re-verify CI green → continue until RECTOR approves.

NEVER amend. NEVER squash. Each copy iteration is a new commit.

### Task 3.17: Merge PR3 + post-merge ritual

- [ ] **Step 1: Switch to main**

```bash
cd ~/local-dev/sipher && git checkout main
```

- [ ] **Step 2: Merge**

```bash
gh pr merge <PR_NUMBER> --merge --delete-branch
```

- [ ] **Step 3: Sync + cleanup**

```bash
git pull
git worktree remove .worktrees/feat-onboarding-content
git branch -d feat/onboarding-content
gh run list --limit 1
```

---

## Session-end ritual (after PR3 merges)

- [ ] **Step 1: Verify final test count**

```bash
cd ~/local-dev/sipher/app && pnpm test --run
```

Expected: ~430-440 tests pass / 70+ files / typecheck clean.

- [ ] **Step 2: Verify final issue close count**

```bash
gh issue list --repo sip-protocol/sipher --label "qa-skill:1778399617" --state open --limit 50
```

Expected: 21 open (33 - 6 closed in Tier 0+1 - 6 closed in Tier 2). Plus 4 followups #225-#228.

- [ ] **Step 3: Update sprint memory + write next-session handoff**

Edit `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/project_phase4b-redesign-sprint.md`:

- Append a "Tier 2 SHIPPED" section under the existing "QA Sweep — Tier 0 + 1" entry
- Document closed issues, test trajectory, key code patterns landed (UnauthedEmptyState API, useActiveView hook, JARGON_DEFINITIONS object, AboutView structure)
- Note any deferred items as Tier 4 followups

Write `~/Documents/secret/claude-strategy/sip-protocol/sipher/session-handoff-2026-05-1X-X.md` covering Tier 3 starting state.

Do NOT run `/quality:qa --diff-from` — saved for Phase D launch gate per K5.

- [ ] **Step 4: Verify HEAD CI green**

```bash
gh run list --limit 1
```

Expected: latest run on main is green.

---

## Spec coverage check

| Spec section | Implemented in |
|---|---|
| D1 Path A — 3 PRs ordered | Pre-flight + PR1/PR2/PR3 task structure |
| D2 React Router 7 | Task 2.2 (add dep) + 2.10 (BrowserRouter wiring) |
| D3 #215 Path 2 teaser modal | Task 1.8 + 1.9 |
| D4 /about route + Footer + tooltips + PG copy | Task 3.3 (Footer) + 3.4-3.7 (Tooltip + JargonTerm) + 3.11-3.12 (AboutView) + 3.13 (PG copy) |
| D5 SUBAGENT-driven w/ TDD + two-stage review | Embedded in every task (test-first steps) + Tasks 1.11/2.21/3.16 (review dispatches) |
| D6 /about placeholder in PR2, content in PR3 | Task 2.8 (placeholder) + 3.12 (full content replaces) |
| D7 #221 stays open as Tier 4 polish | Out of scope; not closed by any task |
| #190 (Vault Withdraw unauthed) | Tasks 1.4 + 1.5 |
| #194 (URL router) | All of PR2 (Tasks 2.1-2.22) |
| #200 (onboarding gap) | Tasks 3.2-3.7 + 3.11-3.13 |
| #201 (Keys blank page) | Tasks 1.6 + 1.7 |
| #204 (Connect wallet breadcrumb) | Tasks 3.8-3.10 (Banner) |
| #215 (View report dead CTA) | Tasks 1.8 + 1.9 |
| Verification cadence (per-PR gate + post-merge ritual) | Tasks 1.10/1.12, 2.20/2.22, 3.15/3.17 |
| Risks R1-R10 | Mitigations embedded in spec; subagent prompts reference |
