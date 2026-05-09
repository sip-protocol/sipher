# PR 7 — Keys + Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/keys` (all logged-in users) and `/settings` (admin-only) routes plus a `<Chip>` design-system primitive across the Sipher FE, backed by two thin no-storage backend endpoints.

**Architecture:** Read-only inspector + client-side cryptographic flows. New backend endpoints are stateless wrappers (`POST /api/keys/generate` → `executeViewingKey('generate')`; `GET /api/sentinel/config` → `getSentinelConfig()` + `FUND_MOVING_TOOLS`). FE generates and downloads viewing keys, snapshots the stealth-address list under passphrase encryption (PBKDF2-SHA256 310k + XChaCha20-Poly1305), and renders SENTINEL config as read-only chips for admins.

**Tech Stack:** TypeScript (strict, no semicolons), React 19 + Vite 6 + Tailwind 4, Zustand 5 (FE state), Express 5 + Vitest + supertest (BE), `@noble/hashes` + `@noble/ciphers` (crypto), Web Crypto API (PBKDF2).

**Spec:** [`docs/superpowers/specs/2026-05-09-pr7-keys-settings-design.md`](../specs/2026-05-09-pr7-keys-settings-design.md) (binding contract — 6 locked decisions D1–D6).

**Sprint context:** Phase 4b glass-neon redesign sprint, PR 7 of 9. Predecessor PR 6 shipped via #183 + #184 + #185. Successors: PR 8 (admin restyle), PR 9 (ROADMAP + Phase D launch prep).

---

## Files touched (full inventory)

### Created (frontend)

```
app/src/components/ui/Chip.tsx
app/src/components/ui/__tests__/Chip.test.tsx
app/src/components/keys/ViewKeyCard.tsx
app/src/components/keys/__tests__/ViewKeyCard.test.tsx
app/src/components/keys/StealthAddressBackup.tsx
app/src/components/keys/__tests__/StealthAddressBackup.test.tsx
app/src/views/KeysView.tsx
app/src/views/__tests__/KeysView.test.tsx
app/src/views/SettingsView.tsx
app/src/views/__tests__/SettingsView.test.tsx
app/src/stores/keys.ts
app/src/stores/__tests__/keys.test.ts
app/src/lib/crypto/passphrase-encrypt.ts
app/src/lib/crypto/__tests__/passphrase-encrypt.test.ts
app/src/api/keys.ts
```

### Created (backend)

```
packages/agent/src/routes/keys.ts
packages/agent/tests/routes/keys.test.ts
packages/agent/tests/routes/sentinel-config.test.ts
```

### Modified (frontend — Chip migrations)

```
app/src/components/vault/CooldownChip.tsx
app/src/components/vault/RefundList.tsx
app/src/components/vault/StealthAddressList.tsx
app/src/components/vault/TxStatusBadge.tsx
app/src/views/VaultView.tsx
```

### Modified (frontend — routing/nav)

```
app/src/stores/app.ts                  # View enum +'keys' +'settings'
app/src/App.tsx                         # case 'keys' / case 'settings'
app/src/components/Header.tsx           # NAV_ITEMS + WalletDropdown
app/src/components/BottomNav.tsx        # mobile drawer entries
app/src/styles/theme.css                # *-soft variants for herald + sentinel
```

### Modified (backend)

```
packages/agent/src/index.ts             # mount /api/keys router
packages/agent/src/routes/sentinel-api.ts  # add GET /config admin endpoint
```

---

## Pre-flight (do once before any task)

- [ ] **0.1 — Confirm clean main**

```bash
cd ~/local-dev/sipher
git checkout main && git pull origin main
git status   # expect: nothing to commit, working tree clean
git log --oneline -3
# expect: 3f39644 docs(spec): PR 7 keys + settings surfaces design
#         f196a58 Merge pull request #185 from sip-protocol/docs/redesign-pr6-complete
#         b2b2112 docs(redesign): mark PR 6 complete (PR 6a #183 + PR 6b #184)
```

- [ ] **0.2 — Confirm baseline test counts**

```bash
pnpm --filter @sipher/app test --run 2>&1 | grep -E "Test Files|Tests "
# expect: Test Files  50 passed (50)
#         Tests  291 passed (291)

pnpm --filter @sipher/agent test --run 2>&1 | grep -E "Test Files|Tests "
# expect: Test Files  114 passed (114)
#         Tests  1391 passed (1391)

pnpm --filter @sipher/app exec tsc --noEmit
# expect: clean (no output)
```

If counts diverge, do not start — investigate first.

- [ ] **0.3 — Worktree setup**

```bash
cd ~/local-dev/sipher
git worktree add .worktrees/feat-redesign-keys-settings -b feat/redesign-keys-settings main
cd .worktrees/feat-redesign-keys-settings
pnpm install
pnpm --filter @sipher/sdk build   # required first time after worktree creation
```

All subsequent tasks run in `.worktrees/feat-redesign-keys-settings/` unless noted.

---

## Task 1: Add `*-soft` token variants for herald + sentinel

**Why:** `<Chip tone="herald">` and `<Chip tone="sentinel">` need `bg-herald-soft` / `bg-sentinel-soft` Tailwind utilities. Base colors `--color-herald` / `--color-sentinel` exist (PR 1 tokens) but soft variants don't.

**Files:**
- Modify: `app/src/styles/tokens.css`
- Modify: `app/src/styles/theme.css`

- [ ] **Step 1: Verify which `*-soft` variants already exist**

```bash
grep -E "color-(herald|sentinel)" app/src/styles/tokens.css
# expect: --color-herald: #3B82F6;
#         --color-sentinel: #F59E0B; (and similar)
grep -E "(herald|sentinel)-soft" app/src/styles/tokens.css
# expect: nothing (these don't exist yet)
```

- [ ] **Step 2: Add soft variants in tokens.css**

After the existing `--color-herald` and `--color-sentinel` lines, add:

```css
  --color-herald-soft:      rgba(59, 130, 246, 0.16);   /* x agent — blue 16% */
  --color-sentinel-soft:    rgba(245, 158, 11, 0.16);   /* monitor — amber 16% */
```

- [ ] **Step 3: Map soft variants in theme.css**

Locate the `@theme` block where `--color-warning-soft` etc. are mapped. Add (matching existing pattern):

```css
  --color-herald-soft: var(--color-herald-soft);
  --color-sentinel-soft: var(--color-sentinel-soft);
```

- [ ] **Step 4: Verify Vite picks up the new utilities**

```bash
pnpm --filter @sipher/app exec tsc --noEmit
# expect: clean
```

- [ ] **Step 5: Commit**

```bash
git add app/src/styles/tokens.css app/src/styles/theme.css
git commit -m "feat(redesign): add herald-soft + sentinel-soft tone tokens"
```

---

## Task 2: `<Chip>` primitive (new + tests)

**Why:** Replaces the 5× duplicated `CHIP_BASE` constant with a typed primitive. Foundation for all PR 7 chips and future PRs.

**Files:**
- Create: `app/src/components/ui/Chip.tsx`
- Create: `app/src/components/ui/__tests__/Chip.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/src/components/ui/__tests__/Chip.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Chip } from '../Chip'

describe('Chip', () => {
  it('renders children', () => {
    render(<Chip>HELLO</Chip>)
    expect(screen.getByText('HELLO')).toBeInTheDocument()
  })

  it('defaults to neutral tone', () => {
    render(<Chip data-testid="chip">A</Chip>)
    const el = screen.getByTestId('chip')
    expect(el.className).toContain('border-line')
    expect(el.className).toContain('text-text-muted')
  })

  it.each([
    ['success', ['border-success/40', 'bg-success-soft', 'text-success']],
    ['danger', ['border-danger/40', 'bg-danger-soft', 'text-danger']],
    ['warning', ['border-warning/40', 'bg-warning-soft', 'text-warning']],
    ['cyan', ['border-cyan/40', 'bg-cyan-soft', 'text-cyan-hi']],
    ['accent', ['border-accent/40', 'bg-accent-soft', 'text-accent-hi']],
    ['herald', ['border-herald/40', 'bg-herald-soft', 'text-herald']],
    ['sentinel', ['border-sentinel/40', 'bg-sentinel-soft', 'text-sentinel']],
  ] as const)('applies %s tone classes', (tone, classes) => {
    render(<Chip tone={tone} data-testid="chip">A</Chip>)
    const el = screen.getByTestId('chip')
    classes.forEach((cls) => expect(el.className).toContain(cls))
  })

  it('renders icon slot before children', () => {
    render(
      <Chip icon={<span data-testid="icon">!</span>} data-testid="chip">LABEL</Chip>,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText('LABEL')).toBeInTheDocument()
  })

  it('forwards className for layering', () => {
    render(<Chip className="self-start mt-2" data-testid="chip">X</Chip>)
    const el = screen.getByTestId('chip')
    expect(el.className).toContain('self-start')
    expect(el.className).toContain('mt-2')
  })

  it('includes the rounded-pill base class', () => {
    render(<Chip data-testid="chip">X</Chip>)
    const el = screen.getByTestId('chip')
    expect(el.className).toContain('rounded-pill')
    expect(el.className).toContain('uppercase')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @sipher/app test --run app/src/components/ui/__tests__/Chip.test.tsx 2>&1 | tail -10
# expect: Failed to resolve import "../Chip" from "Chip.test.tsx"
```

- [ ] **Step 3: Write minimal implementation**

Create `app/src/components/ui/Chip.tsx`:

```tsx
import type { HTMLAttributes, ReactNode } from 'react'

export type ChipTone =
  | 'neutral'
  | 'success'
  | 'danger'
  | 'warning'
  | 'cyan'
  | 'accent'
  | 'herald'
  | 'sentinel'

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone
  icon?: ReactNode
  children: ReactNode
}

const BASE =
  'inline-flex items-center gap-1.5 border rounded-pill px-2.5 py-1 text-xs font-medium tracking-wide uppercase'

const TONE_CLASSES: Record<ChipTone, string> = {
  neutral: 'border-line text-text-muted',
  success: 'border-success/40 bg-success-soft text-success',
  danger: 'border-danger/40 bg-danger-soft text-danger',
  warning: 'border-warning/40 bg-warning-soft text-warning',
  cyan: 'border-cyan/40 bg-cyan-soft text-cyan-hi',
  accent: 'border-accent/40 bg-accent-soft text-accent-hi',
  herald: 'border-herald/40 bg-herald-soft text-herald',
  sentinel: 'border-sentinel/40 bg-sentinel-soft text-sentinel',
}

export function Chip({
  tone = 'neutral',
  icon,
  className,
  children,
  ...rest
}: ChipProps) {
  const merged = [BASE, TONE_CLASSES[tone], className].filter(Boolean).join(' ')
  return (
    <span className={merged} {...rest}>
      {icon}
      {children}
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @sipher/app test --run app/src/components/ui/__tests__/Chip.test.tsx 2>&1 | tail -5
# expect: Tests  6 passed (6)
```

- [ ] **Step 5: Commit**

```bash
git add app/src/components/ui/Chip.tsx app/src/components/ui/__tests__/Chip.test.tsx
git commit -m "feat(ui): add <Chip> primitive with 8 tones"
```

---

## Task 3: Migrate 5 `CHIP_BASE` sites to `<Chip>`

**Why:** D6 — eliminate the 5× duplication before adding any new chips. After this commit, `CHIP_BASE` exists in zero places.

**Files:**
- Modify: `app/src/components/vault/CooldownChip.tsx`
- Modify: `app/src/components/vault/RefundList.tsx`
- Modify: `app/src/components/vault/StealthAddressList.tsx`
- Modify: `app/src/components/vault/TxStatusBadge.tsx`
- Modify: `app/src/views/VaultView.tsx`

This task is mechanical — no new tests, just replace inline-string concatenation with `<Chip tone={…}>`. Existing snapshot/structure tests must continue to pass.

- [ ] **Step 1: Verify baseline tests pass**

```bash
pnpm --filter @sipher/app test --run 2>&1 | grep -E "Test Files|Tests "
# expect: 50 / 50, 291 / 291 (or 297 if Task 2 already committed in this branch — adjust)
```

- [ ] **Step 2: Migrate `CooldownChip.tsx`**

Replace the file contents with:

```tsx
import { useEffect, useState } from 'react'
import { Chip } from '../ui/Chip'

interface CooldownChipProps {
  refundableAt: number
  onElapsed?: () => void
}

function formatRemaining(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return 'Available now'
  if (secondsRemaining < 3600) {
    const m = Math.floor(secondsRemaining / 60)
    const s = secondsRemaining % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }
  const h = Math.floor(secondsRemaining / 3600)
  const m = Math.floor((secondsRemaining % 3600) / 60)
  return `${h}h ${m}m`
}

export function CooldownChip({ refundableAt, onElapsed }: CooldownChipProps) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const remaining = refundableAt - now
  const elapsed = remaining <= 0

  useEffect(() => {
    if (elapsed) return
    const id = setInterval(() => {
      const next = Math.floor(Date.now() / 1000)
      setNow(next)
      if (next >= refundableAt) {
        clearInterval(id)
        onElapsed?.()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [refundableAt, elapsed, onElapsed])

  return (
    <Chip
      tone={elapsed ? 'success' : 'neutral'}
      role="status"
      aria-live="polite"
    >
      {formatRemaining(remaining)}
    </Chip>
  )
}
```

- [ ] **Step 3: Migrate `RefundList.tsx`**

Replace lines 14–15 (`const CHIP_BASE = …`) and the `<span className={`${CHIP_BASE} …`}>` at line 38–40 with `<Chip>`:

```tsx
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { CooldownChip } from './CooldownChip'
import { TxStatusBadge } from './TxStatusBadge'
import type { Position } from './StealthAddressList'
import type { SignStatus } from '../../hooks/useTransactionSigner'

interface RefundListProps {
  records: Position[]
  onRefund: (token: string) => Promise<void> | void
  statusByToken: Record<string, SignStatus>
  signaturesByToken: Record<string, string>
}

export function RefundList({ records, onRefund, statusByToken, signaturesByToken }: RefundListProps) {
  if (records.length === 0) {
    return (
      <Card variant="default" className="p-6">
        <p className="text-sm text-text-muted">No active vault positions to refund.</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {records.map((p) => {
        const status = statusByToken[p.symbol] ?? 'idle'
        const signature = signaturesByToken[p.symbol]
        const busy = status === 'signing' || status === 'broadcasting'
        return (
          <Card
            key={p.depositRecordAddress}
            variant="default"
            className="p-4 flex items-center gap-3"
          >
            <Chip tone="cyan">{p.symbol}</Chip>
            <span className="text-sm font-mono">{p.balanceUiAmount}</span>
            <CooldownChip refundableAt={p.refundableAt} />
            <div className="ml-auto flex items-center gap-3">
              <TxStatusBadge status={status} signature={signature} />
              <button
                type="button"
                onClick={() => onRefund(p.symbol)}
                disabled={p.cooldownActive || busy}
                className="text-xs border border-line rounded-md px-3 py-1.5 hover:border-line-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Refund
              </button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Migrate `StealthAddressList.tsx`**

Remove the `CHIP_BASE` constant. Replace each `<span className={`${CHIP_BASE} …`}>` with `<Chip tone={…}>`:

```tsx
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { HashCell } from '../ui/HashCell'

export interface Position {
  mint: string
  symbol: string
  balance: string
  balanceUiAmount: number
  lockedAmount: string
  decimals: number
  lastDepositAt: number
  refundableAt: number
  cooldownActive: boolean
  depositRecordAddress: string
}

export interface StealthNode {
  index: number
  derivationPath: string
  stealthAddress: string
  parentIndex: number | null
  createdAt: string
}

interface StealthAddressListProps {
  positions: Position[]
  stealthTree: StealthNode[]
  loading: boolean
}

export function StealthAddressList({
  positions,
  stealthTree,
  loading,
}: StealthAddressListProps) {
  return (
    <div className="flex flex-col gap-4">
      <PositionsSection positions={positions} loading={loading} />
      <StealthTreeSection stealthTree={stealthTree} loading={loading} />
    </div>
  )
}

function PositionsSection({
  positions,
  loading,
}: {
  positions: Position[]
  loading: boolean
}) {
  return (
    <Card variant="default" className="p-4">
      <div
        className="text-2xs text-text-muted mb-3"
        style={{ letterSpacing: 'var(--tracking-widest)' }}
      >
        VAULT POSITIONS
      </div>
      {loading ? (
        <p className="text-xs text-text-muted">Loading…</p>
      ) : positions.length === 0 ? (
        <p className="text-xs text-text-muted">
          No vault positions yet — deposit to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {positions.map((p) => (
            <div
              key={p.depositRecordAddress}
              className="flex items-center justify-between text-xs font-mono"
            >
              <div className="flex items-center gap-2">
                <Chip tone="cyan">{p.symbol}</Chip>
                <span className="text-text">{p.balanceUiAmount}</span>
              </div>
              {p.cooldownActive ? (
                <Chip tone="neutral">Cooldown</Chip>
              ) : (
                <Chip tone="success">Refundable</Chip>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function StealthTreeSection({
  stealthTree,
  loading,
}: {
  stealthTree: StealthNode[]
  loading: boolean
}) {
  return (
    <Card variant="default" className="p-4">
      <div
        className="text-2xs text-text-muted mb-3"
        style={{ letterSpacing: 'var(--tracking-widest)' }}
      >
        STEALTH TREE
      </div>
      {loading ? (
        <p className="text-xs text-text-muted">Loading…</p>
      ) : stealthTree.length === 0 ? (
        <p className="text-xs text-text-muted">No stealth tree available.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {stealthTree.map((node) => (
            <div
              key={node.index}
              className="flex items-center justify-between text-xs font-mono"
            >
              <div className="flex items-center gap-2">
                <span className="text-text-muted">#{node.index}</span>
                <span className="text-text-secondary">{node.derivationPath}</span>
                <HashCell hash={node.stealthAddress} />
              </div>
            </div>
          ))}
          {stealthTree.length === 1 && (
            <Chip tone="neutral" className="self-start mt-2">
              M19 — Derived stealth tree expands when M19 ships
            </Chip>
          )}
        </div>
      )}
    </Card>
  )
}
```

- [ ] **Step 5: Migrate `TxStatusBadge.tsx`**

Replace contents with:

```tsx
import type { SignStatus } from '../../hooks/useTransactionSigner'
import { solscanUrl, useNetworkConfigStore } from '../../lib/networkConfig'
import { Chip } from '../ui/Chip'

interface TxStatusBadgeProps {
  status: SignStatus
  signature?: string
}

export function TxStatusBadge({ status, signature }: TxStatusBadgeProps) {
  const solscanSuffix = useNetworkConfigStore((s) => s.config?.solscanSuffix ?? '?cluster=devnet')

  if (status === 'idle') return null

  if (status === 'signing') {
    return (
      <Chip tone="accent" role="status" aria-live="polite">Signing…</Chip>
    )
  }

  if (status === 'broadcasting') {
    return (
      <Chip tone="cyan" role="status" aria-live="polite">Broadcasting…</Chip>
    )
  }

  if (status === 'confirmed') {
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-2">
        <Chip tone="success">Confirmed</Chip>
        {signature && (
          <a
            href={solscanUrl(signature, solscanSuffix)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-text-muted underline hover:text-text"
          >
            View on Solscan
          </a>
        )}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <Chip tone="danger" role="status" aria-live="polite">Failed — try again</Chip>
    )
  }

  return null
}
```

- [ ] **Step 6: Migrate `VaultView.tsx`**

Remove the `CHIP_BASE` constant (lines 41–42). In `ShieldedVaultPanel`, replace lines 127–135 with `<Chip>` calls:

```tsx
// Replace the two-chip block in ShieldedVaultPanel with:
<div className="flex flex-wrap gap-2">
  <Chip tone="neutral">{positions.length} positions</Chip>
  <Chip tone={hasPositions ? 'success' : 'neutral'}>
    {hasPositions ? 'Active' : 'Empty'}
  </Chip>
</div>
```

Add the import at the top of the file:

```tsx
import { Chip } from '../components/ui/Chip'
```

- [ ] **Step 7: Run all app tests to confirm zero regressions**

```bash
pnpm --filter @sipher/app test --run 2>&1 | grep -E "Test Files|Tests "
# expect: same counts as before Task 3 began; no new failures
```

- [ ] **Step 8: Run tsc to confirm types**

```bash
pnpm --filter @sipher/app exec tsc --noEmit
# expect: clean
```

- [ ] **Step 9: Commit**

```bash
git add app/src/components/vault/CooldownChip.tsx \
        app/src/components/vault/RefundList.tsx \
        app/src/components/vault/StealthAddressList.tsx \
        app/src/components/vault/TxStatusBadge.tsx \
        app/src/views/VaultView.tsx
git commit -m "refactor(redesign): migrate 5 CHIP_BASE sites to <Chip> primitive"
```

---

## Task 4: `useKeyStore` Zustand store

**Files:**
- Create: `app/src/stores/keys.ts`
- Create: `app/src/stores/__tests__/keys.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/src/stores/__tests__/keys.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useKeyStore } from '../keys'

describe('useKeyStore', () => {
  beforeEach(() => {
    useKeyStore.setState({ hash: null })
  })

  it('starts with hash null', () => {
    expect(useKeyStore.getState().hash).toBeNull()
  })

  it('set updates the hash', () => {
    useKeyStore.getState().set('0xabc123')
    expect(useKeyStore.getState().hash).toBe('0xabc123')
  })

  it('clear resets the hash to null', () => {
    useKeyStore.getState().set('0xabc123')
    useKeyStore.getState().clear()
    expect(useKeyStore.getState().hash).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @sipher/app test --run app/src/stores/__tests__/keys.test.ts 2>&1 | tail -5
# expect: Failed to resolve import "../keys"
```

- [ ] **Step 3: Write minimal implementation**

Create `app/src/stores/keys.ts`:

```ts
import { create } from 'zustand'

interface KeyState {
  hash: string | null
  set: (hash: string) => void
  clear: () => void
}

export const useKeyStore = create<KeyState>((set) => ({
  hash: null,
  set: (hash) => set({ hash }),
  clear: () => set({ hash: null }),
}))
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @sipher/app test --run app/src/stores/__tests__/keys.test.ts 2>&1 | tail -5
# expect: Tests  3 passed (3)
```

- [ ] **Step 5: Commit**

```bash
git add app/src/stores/keys.ts app/src/stores/__tests__/keys.test.ts
git commit -m "feat(redesign): add useKeyStore Zustand for in-memory viewing-key hash"
```

---

## Task 5: `passphrase-encrypt` lib (PBKDF2 + XChaCha20-Poly1305)

**Why:** Client-side passphrase-protected encryption for the stealth-address backup file. PBKDF2-SHA256 at 310 000 iters (OWASP 2023 minimum), XChaCha20-Poly1305 from `@noble/ciphers`.

**Files:**
- Create: `app/src/lib/crypto/passphrase-encrypt.ts`
- Create: `app/src/lib/crypto/__tests__/passphrase-encrypt.test.ts`

- [ ] **Step 1: Verify `@noble/ciphers` is available in app deps**

```bash
grep -E "@noble/ciphers|@noble/hashes" app/package.json
# expect: at least @noble/hashes; if @noble/ciphers missing, add it
```

If `@noble/ciphers` is missing, add it:

```bash
pnpm --filter @sipher/app add @noble/ciphers
```

- [ ] **Step 2: Write the failing test**

Create `app/src/lib/crypto/__tests__/passphrase-encrypt.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { encryptWithPassphrase, decryptWithPassphrase } from '../passphrase-encrypt'

describe('passphrase-encrypt', () => {
  const plaintext = new TextEncoder().encode(JSON.stringify({ hello: 'world', n: 1 }))

  it('produces output matching the schema (v1, salt b64, nonce b64, ct b64)', async () => {
    const blob = await encryptWithPassphrase(plaintext, 'correct horse battery staple')
    expect(blob.v).toBe(1)
    expect(blob.alg).toBe('xchacha20poly1305-pbkdf2sha256-310k')
    expect(typeof blob.salt).toBe('string')
    expect(typeof blob.nonce).toBe('string')
    expect(typeof blob.ct).toBe('string')
    // base64 strings, non-empty
    expect(blob.salt.length).toBeGreaterThan(0)
    expect(blob.nonce.length).toBeGreaterThan(0)
    expect(blob.ct.length).toBeGreaterThan(0)
  })

  it('produces a different salt + nonce per call', async () => {
    const a = await encryptWithPassphrase(plaintext, 'pw')
    const b = await encryptWithPassphrase(plaintext, 'pw')
    expect(a.salt).not.toBe(b.salt)
    expect(a.nonce).not.toBe(b.nonce)
    expect(a.ct).not.toBe(b.ct) // ciphertext differs because nonce differs
  })

  it('round-trips with the correct passphrase', async () => {
    const blob = await encryptWithPassphrase(plaintext, 'open-sesame')
    const recovered = await decryptWithPassphrase(blob, 'open-sesame')
    expect(new TextDecoder().decode(recovered)).toBe(new TextDecoder().decode(plaintext))
  })

  it('throws on wrong passphrase', async () => {
    const blob = await encryptWithPassphrase(plaintext, 'right')
    await expect(decryptWithPassphrase(blob, 'wrong')).rejects.toThrow()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm --filter @sipher/app test --run app/src/lib/crypto/__tests__/passphrase-encrypt.test.ts 2>&1 | tail -5
# expect: import resolution failure
```

- [ ] **Step 4: Write minimal implementation**

Create `app/src/lib/crypto/passphrase-encrypt.ts`:

```ts
import { xchacha20poly1305 } from '@noble/ciphers/chacha'

export interface EncryptedBlob {
  v: 1
  alg: 'xchacha20poly1305-pbkdf2sha256-310k'
  salt: string
  nonce: string
  ct: string
}

const ITERATIONS = 310_000
const SALT_BYTES = 16
const NONCE_BYTES = 24

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder().encode(passphrase)
  const baseKey = await crypto.subtle.importKey(
    'raw', enc, { name: 'PBKDF2' }, false, ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    256,
  )
  return new Uint8Array(bits)
}

export async function encryptWithPassphrase(
  plaintext: Uint8Array,
  passphrase: string,
): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))
  const key = await deriveKey(passphrase, salt)
  const cipher = xchacha20poly1305(key, nonce)
  const ct = cipher.encrypt(plaintext)
  return {
    v: 1,
    alg: 'xchacha20poly1305-pbkdf2sha256-310k',
    salt: toB64(salt),
    nonce: toB64(nonce),
    ct: toB64(ct),
  }
}

export async function decryptWithPassphrase(
  blob: EncryptedBlob,
  passphrase: string,
): Promise<Uint8Array> {
  if (blob.v !== 1 || blob.alg !== 'xchacha20poly1305-pbkdf2sha256-310k') {
    throw new Error('Unsupported blob format')
  }
  const salt = fromB64(blob.salt)
  const nonce = fromB64(blob.nonce)
  const ct = fromB64(blob.ct)
  const key = await deriveKey(passphrase, salt)
  const cipher = xchacha20poly1305(key, nonce)
  return cipher.decrypt(ct)
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter @sipher/app test --run app/src/lib/crypto/__tests__/passphrase-encrypt.test.ts 2>&1 | tail -5
# expect: Tests  4 passed (4)
```

If round-trip test takes longer than 2s, the iteration count may be too high for jsdom. Confirm with:

```bash
pnpm --filter @sipher/app test --run app/src/lib/crypto/__tests__/passphrase-encrypt.test.ts 2>&1 | grep "Duration"
```

If > 5s, lower `ITERATIONS` to 200_000 and update the alg string + spec risk-table iteration count.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/crypto/passphrase-encrypt.ts \
        app/src/lib/crypto/__tests__/passphrase-encrypt.test.ts \
        app/package.json pnpm-lock.yaml
git commit -m "feat(redesign): add passphrase-encrypt lib (PBKDF2 + XChaCha20-Poly1305)"
```

---

## Task 6: `POST /api/keys/generate` backend endpoint

**Files:**
- Create: `packages/agent/src/routes/keys.ts`
- Create: `packages/agent/tests/routes/keys.test.ts`
- Modify: `packages/agent/src/index.ts` (mount the router)

- [ ] **Step 1: Inspect existing route mount pattern**

```bash
grep -nE "app\.use.*verifyJwt|app\.use.*Router\(" packages/agent/src/index.ts | head -10
# Expect existing patterns like: app.use('/api/vault', verifyJwt, vaultRouter)
```

- [ ] **Step 2: Write the failing test**

Create `packages/agent/tests/routes/keys.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { keysRouter } from '../../src/routes/keys.js'
import { verifyJwt } from '../../src/middleware/auth.js'

const TEST_JWT_SECRET = 'test-secret-min-16-chars'
process.env.JWT_SECRET = TEST_JWT_SECRET

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/keys', verifyJwt, keysRouter)
  return app
}

function authToken(wallet = 'TestWallet1111111111111111111111111111111111') {
  return jwt.sign({ wallet }, TEST_JWT_SECRET, { expiresIn: '1h' })
}

describe('POST /api/keys/generate', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET
  })

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(makeApp()).post('/api/keys/generate')
    expect(res.status).toBe(401)
  })

  it('generates a viewing keypair and returns hash + downloadData', async () => {
    const res = await request(makeApp())
      .post('/api/keys/generate')
      .set('Authorization', `Bearer ${authToken()}`)
    expect(res.status).toBe(200)
    expect(typeof res.body.hash).toBe('string')
    expect(res.body.hash.length).toBeGreaterThan(0)
    expect(res.body.downloadData).toBeDefined()
    expect(typeof res.body.downloadData.blob).toBe('string')
    expect(typeof res.body.downloadData.filename).toBe('string')
  })

  it('returns a different hash on each call (no caching)', async () => {
    const a = await request(makeApp())
      .post('/api/keys/generate')
      .set('Authorization', `Bearer ${authToken()}`)
    const b = await request(makeApp())
      .post('/api/keys/generate')
      .set('Authorization', `Bearer ${authToken()}`)
    expect(a.body.hash).not.toBe(b.body.hash)
  })

  it('persists nothing to the sessions or audit_log tables', async () => {
    const { getDb } = await import('../../src/db.js')
    const db = getDb()
    const sessionsBefore = (db.prepare('SELECT COUNT(*) as n FROM sessions').get() as { n: number }).n
    const auditBefore = (db.prepare('SELECT COUNT(*) as n FROM audit_log').get() as { n: number }).n

    await request(makeApp())
      .post('/api/keys/generate')
      .set('Authorization', `Bearer ${authToken()}`)

    const sessionsAfter = (db.prepare('SELECT COUNT(*) as n FROM sessions').get() as { n: number }).n
    const auditAfter = (db.prepare('SELECT COUNT(*) as n FROM audit_log').get() as { n: number }).n
    expect(sessionsAfter).toBe(sessionsBefore)
    expect(auditAfter).toBe(auditBefore)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm --filter @sipher/agent test --run packages/agent/tests/routes/keys.test.ts 2>&1 | tail -5
# expect: Failed to resolve import "../../src/routes/keys.js"
```

- [ ] **Step 4: Write minimal implementation**

Create `packages/agent/src/routes/keys.ts`:

```ts
import { Router, type Request, type Response } from 'express'
import { executeViewingKey } from '../tools/viewing-key.js'

export const keysRouter: Router = Router()

/**
 * Generate a fresh viewing keypair.
 * No persistence — the response is the only artifact.
 *
 * @auth verifyJwt (mounted at app-level)
 * @returns 200 { hash, downloadData: { blob, filename } } | 500 { error }
 */
keysRouter.post('/generate', async (_req: Request, res: Response) => {
  try {
    const result = await executeViewingKey({ action: 'generate' })
    res.json({
      hash: result.details.viewingKeyHash,
      downloadData: result.downloadData,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'generate failed'
    res.status(500).json({ error: message })
  }
})
```

- [ ] **Step 5: Mount the router in `packages/agent/src/index.ts`**

Locate the auth-gated route mount section (where `vaultRouter` etc. are mounted) and add:

```ts
import { keysRouter } from './routes/keys.js'
// …
app.use('/api/keys', verifyJwt, keysRouter)
```

- [ ] **Step 6: Run test to verify it passes**

```bash
pnpm --filter @sipher/agent test --run packages/agent/tests/routes/keys.test.ts 2>&1 | tail -5
# expect: Tests  4 passed (4)
```

- [ ] **Step 7: Run the full agent suite to confirm zero regression**

```bash
pnpm --filter @sipher/agent test --run 2>&1 | grep -E "Test Files|Tests "
# expect: 115 / 115 (was 114), 1395 / 1395 (was 1391, +4)
```

- [ ] **Step 8: Commit**

```bash
git add packages/agent/src/routes/keys.ts \
        packages/agent/tests/routes/keys.test.ts \
        packages/agent/src/index.ts
git commit -m "feat(agent): add POST /api/keys/generate (no persistence)"
```

---

## Task 7: `GET /api/sentinel/config` admin endpoint

**Files:**
- Modify: `packages/agent/src/routes/sentinel-api.ts`
- Create: `packages/agent/tests/routes/sentinel-config.test.ts`

- [ ] **Step 1: Inspect requireOwner pattern**

```bash
grep -B2 -A5 "sentinelAdminRouter.get.*decisions" packages/agent/src/routes/sentinel-api.ts
# expect: existing admin gate pattern
```

- [ ] **Step 2: Write the failing test**

Create `packages/agent/tests/routes/sentinel-config.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { sentinelRouter } from '../../src/routes/sentinel-api.js'
import { verifyJwt } from '../../src/middleware/auth.js'

const TEST_JWT_SECRET = 'test-secret-min-16-chars'
const OWNER_WALLET = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/sentinel', verifyJwt, sentinelRouter)
  return app
}

function authToken(wallet: string) {
  return jwt.sign({ wallet }, TEST_JWT_SECRET, { expiresIn: '1h' })
}

describe('GET /api/sentinel/config', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET
    process.env.AUTHORIZED_WALLETS = `${OWNER_WALLET}:isAdmin=true`
  })

  it('returns 403 for non-admin wallets', async () => {
    const res = await request(makeApp())
      .get('/api/sentinel/config')
      .set('Authorization', `Bearer ${authToken('NonAdminWallet1111111111111111111111111111')}`)
    expect(res.status).toBe(403)
  })

  it('returns full SentinelConfig payload for admin', async () => {
    const res = await request(makeApp())
      .get('/api/sentinel/config')
      .set('Authorization', `Bearer ${authToken(OWNER_WALLET)}`)
    expect(res.status).toBe(200)
    // Mode + scope
    expect(['yolo', 'advisory', 'off']).toContain(res.body.mode)
    expect(['fund-actions', 'critical-only', 'never']).toContain(res.body.preflightScope)
    // Numeric thresholds
    expect(typeof res.body.preflightSkipAmount).toBe('number')
    expect(typeof res.body.largeTransferThreshold).toBe('number')
    expect(typeof res.body.cancelWindowMs).toBe('number')
    // Booleans
    expect(typeof res.body.threatCheckEnabled).toBe('boolean')
    expect(typeof res.body.blacklistAutonomy).toBe('boolean')
    expect(typeof res.body.blockOnError).toBe('boolean')
    // LLM
    expect(typeof res.body.model).toBe('string')
    expect(typeof res.body.dailyBudgetUsd).toBe('number')
    expect(typeof res.body.dailyCostUsd).toBe('number')
  })

  it('includes fundMovingTools array with the canonical tool list', async () => {
    const res = await request(makeApp())
      .get('/api/sentinel/config')
      .set('Authorization', `Bearer ${authToken(OWNER_WALLET)}`)
    expect(Array.isArray(res.body.fundMovingTools)).toBe(true)
    expect(res.body.fundMovingTools).toEqual(
      expect.arrayContaining([
        'send', 'deposit', 'swap', 'sweep', 'consolidate',
        'splitSend', 'scheduleSend', 'drip', 'recurring', 'refund',
      ]),
    )
  })

  it('reflects dailyDecisionCostUsd for dailyCostUsd', async () => {
    const { dailyDecisionCostUsd } = await import('../../src/db.js')
    const expected = dailyDecisionCostUsd()
    const res = await request(makeApp())
      .get('/api/sentinel/config')
      .set('Authorization', `Bearer ${authToken(OWNER_WALLET)}`)
    expect(res.body.dailyCostUsd).toBe(expected)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm --filter @sipher/agent test --run packages/agent/tests/routes/sentinel-config.test.ts 2>&1 | tail -10
# expect: 404 on /api/sentinel/config (route not yet defined)
```

- [ ] **Step 4: Add the endpoint to `sentinel-api.ts`**

In `packages/agent/src/routes/sentinel-api.ts`, add an import for `FUND_MOVING_TOOLS` near the top:

```ts
import { FUND_MOVING_TOOLS } from '../sentinel/preflight-rules.js'
```

Then add the new admin endpoint inside the admin router section (after the existing `decisions` GET, before `sentinelRouter.use(sentinelAdminRouter)`):

```ts
/**
 * Return the full SENTINEL operating config plus the fund-moving tool list.
 * Read-only; admin-only because thresholds reveal SENTINEL heuristics.
 *
 * @auth verifyJwt + requireOwner
 * @returns 200 SentinelConfig + { dailyCostUsd, fundMovingTools }
 * @see docs/sentinel/rest-api.md (TODO: document this endpoint after merge)
 */
sentinelAdminRouter.get('/config', (_req: Request, res: Response) => {
  const config = getSentinelConfig()
  res.json({
    mode: config.mode,
    preflightScope: config.preflightScope,
    preflightSkipAmount: config.preflightSkipAmount,
    largeTransferThreshold: config.largeTransferThreshold,
    threatCheckEnabled: config.threatCheckEnabled,
    blacklistAutonomy: config.blacklistAutonomy,
    cancelWindowMs: config.cancelWindowMs,
    rateLimitFundPerHour: config.rateLimitFundPerHour,
    rateLimitBlacklistPerHour: config.rateLimitBlacklistPerHour,
    scanInterval: config.scanInterval,
    activeScanInterval: config.activeScanInterval,
    autoRefundThreshold: config.autoRefundThreshold,
    model: config.model,
    dailyBudgetUsd: config.dailyBudgetUsd,
    dailyCostUsd: dailyDecisionCostUsd(),
    blockOnError: config.blockOnError,
    fundMovingTools: Array.from(FUND_MOVING_TOOLS),
  })
})
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter @sipher/agent test --run packages/agent/tests/routes/sentinel-config.test.ts 2>&1 | tail -5
# expect: Tests  4 passed (4)
```

- [ ] **Step 6: Run the full agent suite**

```bash
pnpm --filter @sipher/agent test --run 2>&1 | grep -E "Test Files|Tests "
# expect: 116 / 116, 1399 / 1399 (was 1395, +4)
```

- [ ] **Step 7: Commit**

```bash
git add packages/agent/src/routes/sentinel-api.ts \
        packages/agent/tests/routes/sentinel-config.test.ts
git commit -m "feat(agent): add admin GET /api/sentinel/config (read-only inspector)"
```

---

## Task 8: `apiFetch` keys helper + `ViewKeyCard` component

**Files:**
- Create: `app/src/api/keys.ts` (~10 LOC wrapper)
- Create: `app/src/components/keys/ViewKeyCard.tsx`
- Create: `app/src/components/keys/__tests__/ViewKeyCard.test.tsx`

- [ ] **Step 1: Add the API client wrapper**

Create `app/src/api/keys.ts`:

```ts
import { apiFetch } from './client'

export interface DownloadData {
  blob: string
  filename: string
}

export interface GenerateKeyResponse {
  hash: string
  downloadData: DownloadData
}

export async function generateKey(token: string): Promise<GenerateKeyResponse> {
  return apiFetch<GenerateKeyResponse>('/api/keys/generate', {
    method: 'POST',
    token,
  })
}
```

- [ ] **Step 2: Write the failing test**

Create `app/src/components/keys/__tests__/ViewKeyCard.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ViewKeyCard } from '../ViewKeyCard'
import { useKeyStore } from '../../../stores/keys'

vi.mock('../../../api/keys', () => ({
  generateKey: vi.fn(async () => ({
    hash: '0xtesthash000000000000000000000000000000000000000000000000000000ab',
    downloadData: { blob: 'eyJrZXkiOiJ4In0=', filename: 'sip-viewing-key.json' },
  })),
}))

vi.mock('../../../hooks/useAuthState', () => ({
  useAuthState: () => ({
    publicKey: 'TestWallet1111111111111111111111111111111111',
    token: 'fake-jwt',
    isAuthenticated: true,
    isAdmin: false,
  }),
}))

describe('ViewKeyCard', () => {
  beforeEach(() => {
    useKeyStore.setState({ hash: null })
    // anchor download stub
    HTMLAnchorElement.prototype.click = vi.fn()
  })

  it('renders empty state when no hash in the store', () => {
    render(<ViewKeyCard />)
    expect(screen.getByText(/no viewing key in this session/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument()
  })

  it('shows the generated hash + Copy + Rotate buttons after generate', async () => {
    render(<ViewKeyCard />)
    fireEvent.click(screen.getByRole('button', { name: /generate/i }))
    await waitFor(() => {
      expect(useKeyStore.getState().hash).toMatch(/^0xtesthash/)
    })
    expect(screen.getByRole('button', { name: /copy hash/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rotate/i })).toBeInTheDocument()
  })

  it('copies the hash to clipboard when Copy is clicked', async () => {
    useKeyStore.setState({ hash: '0xabcd' })
    const writeText = vi.fn()
    Object.assign(navigator, { clipboard: { writeText } })
    render(<ViewKeyCard />)
    fireEvent.click(screen.getByRole('button', { name: /copy hash/i }))
    expect(writeText).toHaveBeenCalledWith('0xabcd')
  })

  it('opens rotate confirm modal and replaces hash on confirm', async () => {
    useKeyStore.setState({ hash: '0xprevious' })
    render(<ViewKeyCard />)
    fireEvent.click(screen.getByRole('button', { name: /rotate/i }))
    expect(screen.getByText(/rotating invalidates this key/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /confirm rotate/i }))
    await waitFor(() => {
      expect(useKeyStore.getState().hash).toMatch(/^0xtesthash/)
    })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm --filter @sipher/app test --run app/src/components/keys/__tests__/ViewKeyCard.test.tsx 2>&1 | tail -5
# expect: Failed to resolve import "../ViewKeyCard"
```

- [ ] **Step 4: Implement `ViewKeyCard`**

Create `app/src/components/keys/ViewKeyCard.tsx`:

```tsx
import { useState } from 'react'
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { HashCell } from '../ui/HashCell'
import { Sheet } from '../ui/Sheet'
import { useKeyStore } from '../../stores/keys'
import { useAuthState } from '../../hooks/useAuthState'
import { generateKey, type GenerateKeyResponse } from '../../api/keys'

function downloadBlob(downloadData: { blob: string; filename: string }) {
  const bin = atob(downloadData.blob)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = downloadData.filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ViewKeyCard() {
  const hash = useKeyStore((s) => s.hash)
  const setHash = useKeyStore((s) => s.set)
  const { token } = useAuthState()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRotate, setConfirmRotate] = useState(false)

  async function doGenerate(): Promise<GenerateKeyResponse | null> {
    if (!token) return null
    setBusy(true)
    setError(null)
    try {
      const result = await generateKey(token)
      setHash(result.hash)
      downloadBlob(result.downloadData)
      return result
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate viewing key')
      return null
    } finally {
      setBusy(false)
    }
  }

  function copyHash() {
    if (hash) navigator.clipboard.writeText(hash)
  }

  return (
    <Card variant="default" className="p-5 flex flex-col gap-4">
      <div
        className="text-2xs text-text-muted"
        style={{ letterSpacing: 'var(--tracking-widest)' }}
      >
        ◆ VIEWING KEY
      </div>

      {hash === null ? (
        <>
          <p className="text-sm text-text-muted">
            No viewing key in this session. Generate one to enable selective disclosure.
          </p>
          <button
            type="button"
            onClick={doGenerate}
            disabled={busy || !token}
            className="self-start text-xs px-3 py-1.5 rounded-md text-bg font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(90deg, var(--color-cyan), var(--color-violet))' }}
          >
            {busy ? 'Generating…' : 'Generate'}
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Chip tone="cyan">Active</Chip>
            <HashCell hash={hash} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyHash}
              className="text-xs border border-line rounded-md px-3 py-1.5 hover:border-line-2"
            >
              Copy hash
            </button>
            <button
              type="button"
              onClick={() => setConfirmRotate(true)}
              disabled={busy}
              className="text-xs border border-line rounded-md px-3 py-1.5 hover:border-line-2 disabled:opacity-40"
            >
              {busy ? 'Working…' : 'Rotate'}
            </button>
          </div>
        </>
      )}

      {error && (
        <Card role="alert" variant="default" className="p-3">
          <p className="text-xs text-danger">{error}</p>
        </Card>
      )}

      {confirmRotate && (
        <Sheet open onClose={() => setConfirmRotate(false)} title="Rotate viewing key">
          <p className="text-sm text-text-muted mb-4">
            Rotating invalidates this key for new payments. Save the old key file if past
            payments still need auditor visibility.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmRotate(false)}
              className="text-xs border border-line rounded-md px-3 py-1.5 hover:border-line-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                setConfirmRotate(false)
                await doGenerate()
              }}
              className="text-xs px-3 py-1.5 rounded-md text-bg font-semibold"
              style={{ background: 'var(--color-warning)' }}
            >
              Confirm rotate
            </button>
          </div>
        </Sheet>
      )}
    </Card>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter @sipher/app test --run app/src/components/keys/__tests__/ViewKeyCard.test.tsx 2>&1 | tail -5
# expect: Tests  4 passed (4)
```

If `Sheet` doesn't accept `title` prop or has a different API, inspect `app/src/components/ui/Sheet.tsx` and adapt. Existing usage examples: search for `<Sheet` in `app/src/components/`.

- [ ] **Step 6: Commit**

```bash
git add app/src/api/keys.ts \
        app/src/components/keys/ViewKeyCard.tsx \
        app/src/components/keys/__tests__/ViewKeyCard.test.tsx
git commit -m "feat(redesign): add ViewKeyCard + /api/keys/generate FE wrapper"
```

---

## Task 9: `StealthAddressBackup` component

**Files:**
- Create: `app/src/components/keys/StealthAddressBackup.tsx`
- Create: `app/src/components/keys/__tests__/StealthAddressBackup.test.tsx`

- [ ] **Step 1: Confirm `/api/stealth/index` response shape**

```bash
grep -A10 "router.get.*stealth\|sendStealthIndex\|stealth-index" packages/agent/src/routes/stealth-index.ts | head -20
# Verify response is { tree: StealthNode[], rootWallet: string }
```

- [ ] **Step 2: Write the failing test**

Create `app/src/components/keys/__tests__/StealthAddressBackup.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StealthAddressBackup } from '../StealthAddressBackup'

vi.mock('../../../hooks/useAuthState', () => ({
  useAuthState: () => ({
    publicKey: 'TestWallet1111111111111111111111111111111111',
    token: 'fake-jwt',
    isAuthenticated: true,
    isAdmin: false,
  }),
}))

const apiFetchMock = vi.fn()
vi.mock('../../../api/client', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

const encryptMock = vi.fn(async () => ({
  v: 1, alg: 'xchacha20poly1305-pbkdf2sha256-310k',
  salt: 'c2FsdA==', nonce: 'bm9uY2U=', ct: 'Y3Q=',
}))
vi.mock('../../../lib/crypto/passphrase-encrypt', () => ({
  encryptWithPassphrase: (...args: unknown[]) => encryptMock(...args),
}))

describe('StealthAddressBackup', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    encryptMock.mockClear()
    HTMLAnchorElement.prototype.click = vi.fn()
  })

  it('renders loading skeleton on mount', async () => {
    apiFetchMock.mockReturnValue(new Promise(() => {})) // never resolves
    render(<StealthAddressBackup />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders empty-state copy when /api/stealth/index returns 0 addresses', async () => {
    apiFetchMock.mockResolvedValueOnce({ tree: [], rootWallet: '' })
    render(<StealthAddressBackup />)
    await waitFor(() => {
      expect(screen.getByText(/no stealth addresses yet/i)).toBeInTheDocument()
    })
  })

  it('renders count chip + Download button when addresses exist', async () => {
    apiFetchMock.mockResolvedValueOnce({
      tree: [{ index: 0, derivationPath: 'm/0', stealthAddress: '0xabc', parentIndex: null, createdAt: '' }],
      rootWallet: 'wallet',
    })
    render(<StealthAddressBackup />)
    await waitFor(() => {
      expect(screen.getByText(/1 addresses?/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /download encrypted backup/i })).toBeInTheDocument()
  })

  it('encrypts + downloads on submit', async () => {
    apiFetchMock.mockResolvedValueOnce({
      tree: [{ index: 0, derivationPath: 'm/0', stealthAddress: '0xabc', parentIndex: null, createdAt: '' }],
      rootWallet: 'wallet',
    })
    render(<StealthAddressBackup />)
    await waitFor(() => screen.getByRole('button', { name: /download encrypted backup/i }))
    fireEvent.click(screen.getByRole('button', { name: /download encrypted backup/i }))
    fireEvent.change(screen.getByLabelText(/^passphrase$/i), { target: { value: 'a-good-pw' } })
    fireEvent.change(screen.getByLabelText(/confirm passphrase/i), { target: { value: 'a-good-pw' } })
    fireEvent.click(screen.getByRole('button', { name: /^encrypt and download$/i }))
    await waitFor(() => expect(encryptMock).toHaveBeenCalled())
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled()
  })

  it('renders error banner on fetch failure with retry', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('boom'))
    render(<StealthAddressBackup />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    apiFetchMock.mockResolvedValueOnce({ tree: [], rootWallet: '' })
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    await waitFor(() => {
      expect(screen.getByText(/no stealth addresses yet/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm --filter @sipher/app test --run app/src/components/keys/__tests__/StealthAddressBackup.test.tsx 2>&1 | tail -5
# expect: import resolution failure
```

- [ ] **Step 4: Implement the component**

Create `app/src/components/keys/StealthAddressBackup.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../../api/client'
import { useAuthState } from '../../hooks/useAuthState'
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { Sheet } from '../ui/Sheet'
import { encryptWithPassphrase } from '../../lib/crypto/passphrase-encrypt'

interface StealthIndexResponse {
  tree: Array<{
    index: number
    derivationPath: string
    stealthAddress: string
    parentIndex: number | null
    createdAt: string
  }>
  rootWallet: string
}

function downloadEncryptedBlob(blob: object, filename: string) {
  const json = JSON.stringify(blob, null, 2)
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function StealthAddressBackup() {
  const { publicKey, token } = useAuthState()
  const [data, setData] = useState<StealthIndexResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [encrypting, setEncrypting] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  const aborterRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    aborterRef.current = controller
    setLoading(true)
    setError(null)
    apiFetch<StealthIndexResponse>('/api/stealth/index', { token, signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) setData(r)
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Failed to load stealth index')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [token, retryNonce])

  const count = data?.tree.length ?? 0

  async function handleSubmit() {
    if (!data) return
    if (passphrase.length < 8) return
    if (passphrase !== confirm) return
    setEncrypting(true)
    try {
      const plaintext = new TextEncoder().encode(JSON.stringify(data))
      const blob = await encryptWithPassphrase(plaintext, passphrase)
      const wallet8 = (publicKey ?? 'unknown').slice(0, 8)
      const filename = `sipher-stealth-backup-${wallet8}-${Math.floor(Date.now() / 1000)}.enc.json`
      downloadEncryptedBlob(blob, filename)
      setSheetOpen(false)
      setPassphrase('')
      setConfirm('')
    } finally {
      setEncrypting(false)
    }
  }

  return (
    <Card variant="default" className="p-5 flex flex-col gap-4">
      <div
        className="text-2xs text-text-muted"
        style={{ letterSpacing: 'var(--tracking-widest)' }}
      >
        ◆ STEALTH ADDRESS BACKUP
      </div>

      {loading && <p className="text-sm text-text-muted">Loading…</p>}

      {error && !loading && (
        <Card role="alert" variant="default" className="p-3 flex items-center justify-between">
          <p className="text-xs text-danger">{error}</p>
          <button
            type="button"
            onClick={() => setRetryNonce((n) => n + 1)}
            className="text-xs border border-line rounded-md px-2.5 py-1 hover:border-line-2"
          >
            Retry
          </button>
        </Card>
      )}

      {!loading && !error && count === 0 && (
        <p className="text-sm text-text-muted">
          No stealth addresses yet. Make a private deposit to populate this.
        </p>
      )}

      {!loading && !error && count > 0 && (
        <>
          <div className="flex items-center gap-2">
            <Chip tone="cyan">{count} addresses</Chip>
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="self-start text-xs px-3 py-1.5 rounded-md text-bg font-semibold"
            style={{ background: 'linear-gradient(90deg, var(--color-cyan), var(--color-violet))' }}
          >
            Download encrypted backup
          </button>
        </>
      )}

      {sheetOpen && (
        <Sheet open onClose={() => setSheetOpen(false)} title="Encrypt backup">
          <div className="flex flex-col gap-3">
            <label className="text-xs text-text-muted">
              Passphrase
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                aria-label="Passphrase"
                className="mt-1 w-full text-xs border border-line rounded-md px-2 py-1 bg-bg-2"
              />
            </label>
            <label className="text-xs text-text-muted">
              Confirm passphrase
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-label="Confirm passphrase"
                className="mt-1 w-full text-xs border border-line rounded-md px-2 py-1 bg-bg-2"
              />
            </label>
            {passphrase.length > 0 && passphrase.length < 8 && (
              <p className="text-xs text-danger">Passphrase must be at least 8 characters.</p>
            )}
            {passphrase.length >= 8 && passphrase.length < 12 && (
              <p className="text-xs text-warning">Use a stronger passphrase for stronger protection.</p>
            )}
            {passphrase !== confirm && confirm.length > 0 && (
              <p className="text-xs text-danger">Passphrases do not match.</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="text-xs border border-line rounded-md px-3 py-1.5 hover:border-line-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  encrypting ||
                  passphrase.length < 8 ||
                  passphrase !== confirm
                }
                className="text-xs px-3 py-1.5 rounded-md text-bg font-semibold disabled:opacity-40"
                style={{ background: 'linear-gradient(90deg, var(--color-cyan), var(--color-violet))' }}
              >
                {encrypting ? 'Encrypting…' : 'Encrypt and download'}
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </Card>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter @sipher/app test --run app/src/components/keys/__tests__/StealthAddressBackup.test.tsx 2>&1 | tail -5
# expect: Tests  5 passed (5)
```

- [ ] **Step 6: Commit**

```bash
git add app/src/components/keys/StealthAddressBackup.tsx \
        app/src/components/keys/__tests__/StealthAddressBackup.test.tsx
git commit -m "feat(redesign): add StealthAddressBackup card (passphrase-encrypted)"
```

---

## Task 10: `KeysView` view

**Files:**
- Create: `app/src/views/KeysView.tsx`
- Create: `app/src/views/__tests__/KeysView.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/src/views/__tests__/KeysView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import KeysView from '../KeysView'

vi.mock('../../components/keys/ViewKeyCard', () => ({
  ViewKeyCard: () => <div data-testid="view-key-card">VKC</div>,
}))
vi.mock('../../components/keys/StealthAddressBackup', () => ({
  StealthAddressBackup: () => <div data-testid="backup-card">SAB</div>,
}))
vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => ({
    publicKey: 'TestWallet1111111111111111111111111111111111',
    token: 'fake-jwt',
    isAuthenticated: true,
    isAdmin: false,
  }),
}))

describe('KeysView', () => {
  it('renders both ViewKeyCard and StealthAddressBackup', () => {
    render(<KeysView />)
    expect(screen.getByTestId('view-key-card')).toBeInTheDocument()
    expect(screen.getByTestId('backup-card')).toBeInTheDocument()
  })

  it('renders inside a 2-column grid on md+', () => {
    const { container } = render(<KeysView />)
    const grid = container.querySelector('[data-testid="keys-view"]')
    expect(grid?.className).toContain('grid')
    expect(grid?.className).toMatch(/md:grid-cols-2/)
  })

  it('redirects to dashboard when unauthenticated', async () => {
    vi.doMock('../../hooks/useAuthState', () => ({
      useAuthState: () => ({
        publicKey: null,
        token: null,
        isAuthenticated: false,
        isAdmin: false,
      }),
    }))
    vi.resetModules()
    const { default: KeysViewLocal } = await import('../KeysView')
    render(<KeysViewLocal />)
    expect(screen.queryByTestId('view-key-card')).toBeNull()
  })

  it('uses key columns labels', () => {
    render(<KeysView />)
    expect(screen.getByText(/viewing key management/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @sipher/app test --run app/src/views/__tests__/KeysView.test.tsx 2>&1 | tail -5
# expect: Failed to resolve import "../KeysView"
```

- [ ] **Step 3: Implement the view**

Create `app/src/views/KeysView.tsx`:

```tsx
import { useAuthState } from '../hooks/useAuthState'
import { ViewKeyCard } from '../components/keys/ViewKeyCard'
import { StealthAddressBackup } from '../components/keys/StealthAddressBackup'

export default function KeysView() {
  const { isAuthenticated } = useAuthState()
  if (!isAuthenticated) return null

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

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @sipher/app test --run app/src/views/__tests__/KeysView.test.tsx 2>&1 | tail -5
# expect: Tests  4 passed (4)
```

- [ ] **Step 5: Commit**

```bash
git add app/src/views/KeysView.tsx app/src/views/__tests__/KeysView.test.tsx
git commit -m "feat(redesign): add KeysView 2-column layout"
```

---

## Task 11: `SettingsView` view (admin-only inspector)

**Files:**
- Create: `app/src/views/SettingsView.tsx`
- Create: `app/src/views/__tests__/SettingsView.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/src/views/__tests__/SettingsView.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useNetworkConfigStore } from '../../lib/networkConfig'

const setActiveViewMock = vi.fn()
vi.mock('../../stores/app', () => ({
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({ setActiveView: setActiveViewMock, activeView: 'settings' }),
}))

const useAuthStateMock = vi.fn()
vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => useAuthStateMock(),
}))

const apiFetchMock = vi.fn()
vi.mock('../../api/client', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

const sentinelConfigFixture = {
  mode: 'advisory',
  preflightScope: 'fund-actions',
  preflightSkipAmount: 0.1,
  largeTransferThreshold: 10,
  threatCheckEnabled: true,
  blacklistAutonomy: true,
  cancelWindowMs: 30000,
  rateLimitFundPerHour: 5,
  rateLimitBlacklistPerHour: 20,
  scanInterval: 60000,
  activeScanInterval: 15000,
  autoRefundThreshold: 1,
  model: 'openrouter:anthropic/claude-sonnet-4.6',
  dailyBudgetUsd: 10,
  dailyCostUsd: 0,
  blockOnError: false,
  fundMovingTools: ['send', 'deposit', 'swap', 'sweep', 'consolidate', 'splitSend', 'scheduleSend', 'drip', 'recurring', 'refund'],
}

describe('SettingsView', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    setActiveViewMock.mockReset()
    useNetworkConfigStore.setState({
      config: {
        network: 'devnet',
        clusterName: 'devnet',
        publicRpcUrl: 'https://api.devnet.solana.com',
        programIds: { sipherVault: 'X', sipPrivacy: 'Y' },
        vaultConfig: 'Z',
        beta: true,
        solscanSuffix: '?cluster=devnet',
      },
      error: null,
    })
  })

  it('redirects non-admin to dashboard', async () => {
    useAuthStateMock.mockReturnValue({
      publicKey: 'X', token: 't', isAuthenticated: true, isAdmin: false,
    })
    const { default: SettingsView } = await import('../SettingsView')
    render(<SettingsView />)
    await waitFor(() => {
      expect(setActiveViewMock).toHaveBeenCalledWith('dashboard')
    })
  })

  it('renders network chip from useNetworkConfigStore', async () => {
    useAuthStateMock.mockReturnValue({
      publicKey: 'X', token: 't', isAuthenticated: true, isAdmin: true,
    })
    apiFetchMock.mockResolvedValue(sentinelConfigFixture)
    const { default: SettingsView } = await import('../SettingsView')
    render(<SettingsView />)
    await waitFor(() => {
      expect(screen.getByText(/devnet/i)).toBeInTheDocument()
    })
  })

  it('renders SENTINEL mode chip with warning tone for advisory', async () => {
    useAuthStateMock.mockReturnValue({
      publicKey: 'X', token: 't', isAuthenticated: true, isAdmin: true,
    })
    apiFetchMock.mockResolvedValue(sentinelConfigFixture)
    const { default: SettingsView } = await import('../SettingsView')
    render(<SettingsView />)
    await waitFor(() => {
      const chip = screen.getByText(/^advisory$/i)
      expect(chip).toBeInTheDocument()
      expect(chip.className).toContain('bg-warning-soft')
    })
  })

  it('renders all 10 fund-moving tools', async () => {
    useAuthStateMock.mockReturnValue({
      publicKey: 'X', token: 't', isAuthenticated: true, isAdmin: true,
    })
    apiFetchMock.mockResolvedValue(sentinelConfigFixture)
    const { default: SettingsView } = await import('../SettingsView')
    render(<SettingsView />)
    await waitFor(() => {
      sentinelConfigFixture.fundMovingTools.forEach((tool) => {
        expect(screen.getByText(tool, { selector: 'span' })).toBeInTheDocument()
      })
    })
  })

  it('renders dailyCostUsd / dailyBudgetUsd', async () => {
    useAuthStateMock.mockReturnValue({
      publicKey: 'X', token: 't', isAuthenticated: true, isAdmin: true,
    })
    apiFetchMock.mockResolvedValue({ ...sentinelConfigFixture, dailyCostUsd: 1.23 })
    const { default: SettingsView } = await import('../SettingsView')
    render(<SettingsView />)
    await waitFor(() => {
      expect(screen.getByText(/\$1\.23/)).toBeInTheDocument()
      expect(screen.getByText(/\$10/)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @sipher/app test --run app/src/views/__tests__/SettingsView.test.tsx 2>&1 | tail -5
# expect: import resolution failure
```

- [ ] **Step 3: Implement the view**

Create `app/src/views/SettingsView.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api/client'
import { useAuthState } from '../hooks/useAuthState'
import { useAppStore } from '../stores/app'
import { useNetworkConfigStore } from '../lib/networkConfig'
import { Card } from '../components/ui/Card'
import { Chip, type ChipTone } from '../components/ui/Chip'

interface SentinelConfigPayload {
  mode: 'yolo' | 'advisory' | 'off'
  preflightScope: string
  preflightSkipAmount: number
  largeTransferThreshold: number
  threatCheckEnabled: boolean
  blacklistAutonomy: boolean
  cancelWindowMs: number
  rateLimitFundPerHour: number
  rateLimitBlacklistPerHour: number
  scanInterval: number
  activeScanInterval: number
  autoRefundThreshold: number
  model: string
  dailyBudgetUsd: number
  dailyCostUsd: number
  blockOnError: boolean
  fundMovingTools: string[]
}

function modeTone(mode: SentinelConfigPayload['mode']): ChipTone {
  if (mode === 'yolo') return 'danger'
  if (mode === 'advisory') return 'warning'
  return 'neutral'
}

function networkTone(network: string): ChipTone {
  return network === 'mainnet' ? 'cyan' : 'warning'
}

export default function SettingsView() {
  const { token, isAdmin } = useAuthState()
  const setActiveView = useAppStore((s) => s.setActiveView)
  const network = useNetworkConfigStore((s) => s.config?.network)
  const [config, setConfig] = useState<SentinelConfigPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const aborterRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!isAdmin) {
      setActiveView('dashboard')
      return
    }
    if (!token) return
    const controller = new AbortController()
    aborterRef.current = controller
    apiFetch<SentinelConfigPayload>('/api/sentinel/config', {
      token, signal: controller.signal,
    })
      .then((r) => {
        if (!controller.signal.aborted) setConfig(r)
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Failed to load config')
        }
      })
    return () => controller.abort()
  }, [isAdmin, token, setActiveView])

  if (!isAdmin) return null

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-sm text-text-muted" style={{ letterSpacing: 'var(--tracking-widest)' }}>
        SETTINGS — READ-ONLY INSPECTOR
      </h1>

      <Card variant="default" className="p-4 flex flex-col gap-2">
        <div
          className="text-2xs text-text-muted"
          style={{ letterSpacing: 'var(--tracking-widest)' }}
        >
          NETWORK
        </div>
        <div className="flex items-center gap-2">
          <Chip tone={networkTone(network ?? '')}>{network ?? 'unknown'}</Chip>
          <span className="text-xs text-text-muted">Set via SIPHER_NETWORK env var.</span>
        </div>
      </Card>

      {error && (
        <Card role="alert" variant="default" className="p-3">
          <p className="text-xs text-danger">{error}</p>
        </Card>
      )}

      {config && (
        <>
          <Card variant="default" className="p-4 flex flex-col gap-2">
            <div
              className="text-2xs text-text-muted"
              style={{ letterSpacing: 'var(--tracking-widest)' }}
            >
              SENTINEL MODE
            </div>
            <div className="flex items-center gap-2">
              <Chip tone={modeTone(config.mode)}>{config.mode}</Chip>
              <span className="text-xs text-text-muted">
                Set via SENTINEL_MODE env var. Restart agent to change.
              </span>
            </div>
          </Card>

          <Card variant="default" className="p-4 flex flex-col gap-2">
            <div
              className="text-2xs text-text-muted"
              style={{ letterSpacing: 'var(--tracking-widest)' }}
            >
              PREFLIGHT ENVELOPE
            </div>
            <ConfigRow label="Scope" value={config.preflightScope} />
            <ConfigRow label="Skip amount" value={`${config.preflightSkipAmount} SOL`} />
            <ConfigRow label="Large transfer threshold" value={`${config.largeTransferThreshold} SOL`} />
            <ConfigRow label="Threat check enabled" value={String(config.threatCheckEnabled)} />
            <ConfigRow label="Blacklist autonomy" value={String(config.blacklistAutonomy)} />
            <ConfigRow label="Cancel window" value={`${config.cancelWindowMs / 1000}s`} />
            <ConfigRow label="Rate limit (fund/hr)" value={String(config.rateLimitFundPerHour)} />
            <ConfigRow label="Rate limit (blacklist/hr)" value={String(config.rateLimitBlacklistPerHour)} />
            <ConfigRow label="Scan interval" value={`${config.scanInterval / 1000}s`} />
            <ConfigRow label="Active scan interval" value={`${config.activeScanInterval / 1000}s`} />
            <ConfigRow label="Auto-refund threshold" value={String(config.autoRefundThreshold)} />
          </Card>

          <Card variant="default" className="p-4 flex flex-col gap-2">
            <div
              className="text-2xs text-text-muted"
              style={{ letterSpacing: 'var(--tracking-widest)' }}
            >
              LLM COST GUARD
            </div>
            <ConfigRow label="Model" value={config.model} />
            <ConfigRow
              label="Daily spend"
              value={`$${config.dailyCostUsd.toFixed(2)} / $${config.dailyBudgetUsd}`}
            />
            <ConfigRow label="Block on error" value={String(config.blockOnError)} />
          </Card>

          <Card variant="default" className="p-4 flex flex-col gap-2">
            <div
              className="text-2xs text-text-muted"
              style={{ letterSpacing: 'var(--tracking-widest)' }}
            >
              FUND-MOVING TOOLS (SENTINEL preflight required)
            </div>
            <p className="text-xs text-text-muted">
              Hardcoded in preflight-rules.ts; allowlist edits are deferred until audit-log infra lands.
            </p>
            <div className="flex flex-wrap gap-2">
              {config.fundMovingTools.map((tool) => (
                <Chip key={tool} tone="cyan">{tool}</Chip>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-muted">{label}</span>
      <Chip tone="neutral">{value}</Chip>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @sipher/app test --run app/src/views/__tests__/SettingsView.test.tsx 2>&1 | tail -5
# expect: Tests  5 passed (5)
```

- [ ] **Step 5: Commit**

```bash
git add app/src/views/SettingsView.tsx app/src/views/__tests__/SettingsView.test.tsx
git commit -m "feat(redesign): add SettingsView (admin-only read-only inspector)"
```

---

## Task 12: View enum + App.tsx routing

**Files:**
- Modify: `app/src/stores/app.ts`
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Extend View enum**

In `app/src/stores/app.ts` line 4, change the `View` type to include `'keys'` and `'settings'`:

```ts
export type View = 'dashboard' | 'vault' | 'herald' | 'squad' | 'chat' | 'privacyReport' | 'chains' | 'deposit' | 'withdraw' | 'keys' | 'settings'
```

- [ ] **Step 2: Add routing cases in `App.tsx`**

In `app/src/App.tsx`, locate the `renderView` function (around line 40) and add the two new cases. Add the imports at the top of the file:

```tsx
import KeysView from './views/KeysView'
import SettingsView from './views/SettingsView'
```

Then in the switch statement (after `case 'chains':` block):

```tsx
      case 'keys':
        return <KeysView />
      case 'settings':
        return <SettingsView />
```

- [ ] **Step 3: Verify tsc clean + tests pass**

```bash
pnpm --filter @sipher/app exec tsc --noEmit
pnpm --filter @sipher/app test --run 2>&1 | grep -E "Test Files|Tests "
```

- [ ] **Step 4: Commit**

```bash
git add app/src/stores/app.ts app/src/App.tsx
git commit -m "feat(redesign): wire keys + settings into View enum + App routing"
```

---

## Task 13: Header NAV_ITEMS + WalletDropdown wiring

**Files:**
- Modify: `app/src/components/Header.tsx`

- [ ] **Step 1: Inspect existing NAV_ITEMS structure**

```bash
grep -B2 -A8 "NAV_ITEMS" app/src/components/Header.tsx | head -30
```

Confirm the shape: `{ id: View, label: string, icon: IconType, adminOnly?: boolean, tabletOnly?: boolean }`.

- [ ] **Step 2: Add Key + Gear icon imports**

At the top of `app/src/components/Header.tsx`, add `Key` and `Gear` to the existing Phosphor icon import (next to `ChartBar`, `Vault`, etc.):

```tsx
import { Broadcast, ChartBar, ChatCircle, Gear, GlobeHemisphereWest, Key, UsersThree, Vault } from '@phosphor-icons/react'
```

(Adjust to whatever the existing import order is — keep alphabetical.)

- [ ] **Step 3: Add Keys + Settings entries to NAV_ITEMS**

After the existing `squad` entry:

```tsx
  { id: 'keys', label: 'Keys', icon: Key },
  { id: 'settings', label: 'Settings', icon: Gear, adminOnly: true },
```

- [ ] **Step 4: Verify the vault active matcher does NOT match keys/settings**

The vault active matcher should remain `(activeView === 'vault' || activeView === 'deposit' || activeView === 'withdraw')`. New routes have their own NAV_ITEMS entries.

- [ ] **Step 5: Inspect `WalletDropdown` and add Settings link if appropriate**

```bash
cat app/src/components/WalletDropdown.tsx
```

If the dropdown already auto-derives entries from a list, ensure Settings appears. If it has hand-coded entries, add a conditional Settings link gated on `isAdmin` from `useAuthState`. Sample addition:

```tsx
{isAdmin && (
  <button
    type="button"
    onClick={() => setActiveView('settings')}
    className="…"
  >
    Settings
  </button>
)}
```

(Adapt the styling to match existing dropdown items.)

- [ ] **Step 6: Run tsc + tests**

```bash
pnpm --filter @sipher/app exec tsc --noEmit
pnpm --filter @sipher/app test --run 2>&1 | grep -E "Test Files|Tests "
```

- [ ] **Step 7: Commit**

```bash
git add app/src/components/Header.tsx app/src/components/WalletDropdown.tsx
git commit -m "feat(redesign): add Keys + Settings nav items (Settings admin-only)"
```

---

## Task 14: BottomNav mobile drawer

**Files:**
- Modify: `app/src/components/BottomNav.tsx`

- [ ] **Step 1: Inspect drawer structure**

```bash
cat app/src/components/BottomNav.tsx
```

The drawer typically has a "More" button that opens a sheet listing additional nav items (Herald, Squad, Settings, Disconnect for admins; just disconnect/keys for users).

- [ ] **Step 2: Add Keys to drawer + Settings under admin section**

If the file uses a `DRAWER_ITEMS` array similar to NAV_ITEMS, append:

```tsx
  { id: 'keys', label: 'Keys', icon: Key },
  { id: 'settings', label: 'Settings', icon: Gear, adminOnly: true },
```

If the drawer is hand-coded, add Keys before Disconnect for all users, and Settings inside the existing `{isAdmin && (…)}` block alongside Herald/Squad.

- [ ] **Step 3: Run tsc + tests**

```bash
pnpm --filter @sipher/app exec tsc --noEmit
pnpm --filter @sipher/app test --run 2>&1 | grep -E "Test Files|Tests "
```

- [ ] **Step 4: Commit**

```bash
git add app/src/components/BottomNav.tsx
git commit -m "feat(redesign): surface Keys + Settings in mobile bottom-nav drawer"
```

---

## Task 15: Final verification + open PR

- [ ] **Step 1: Run full test suites**

```bash
pnpm --filter @sipher/app test --run 2>&1 | grep -E "Test Files|Tests "
# expect: Tests  319 passed (319) — was 291, +28
pnpm --filter @sipher/agent test --run 2>&1 | grep -E "Test Files|Tests "
# expect: Tests  1399 passed (1399) — was 1391, +8
pnpm --filter @sipher/app exec tsc --noEmit
# expect: clean
```

- [ ] **Step 2: Run the linter (if one exists in this repo)**

```bash
pnpm --filter @sipher/app exec eslint . 2>&1 | tail -20 || echo "no eslint"
```

- [ ] **Step 3: Manual smoke (dev server)**

Start the FE dev server in one terminal:

```bash
cd ~/local-dev/sipher/.worktrees/feat-redesign-keys-settings
pnpm --filter @sipher/agent dev   # backend on :5006
pnpm --filter @sipher/app dev     # frontend on :5173
```

Open `http://localhost:5173`, sign in with the `cipher-admin` wallet, and verify:
- `/keys` renders both cards. Click Generate — file downloads, hash chip appears.
- Click Rotate — modal appears, Confirm replaces the hash and triggers a new download.
- Stealth address backup empty state copy renders (PR 4 stub returns 0 addresses).
- `/settings` renders for admin: 5 sections, all chips read-only.
- Sign out, sign in with a non-admin wallet (or modify `AUTHORIZED_WALLETS`).
- `/keys` still renders.
- Direct URL nav to `/settings` redirects to dashboard.

- [ ] **Step 4: Push the branch**

```bash
git push -u origin feat/redesign-keys-settings
```

- [ ] **Step 5: Open the PR**

```bash
gh pr create --base main --head feat/redesign-keys-settings --title "feat(redesign): PR 7 — Keys + Settings surfaces" --body "$(cat <<'EOF'
## Summary

Ships `/keys` (all logged-in users) and `/settings` (admin-only) routes for the Phase 4b glass-neon redesign sprint. PR 7 of 9.

**Spec:** `docs/superpowers/specs/2026-05-09-pr7-keys-settings-design.md` (6 locked decisions D1–D6)
**Plan:** `docs/superpowers/plans/2026-05-09-pr7-keys-settings.md`

## Changes

- New `<Chip>` design-system primitive (8 tones); migrates 5 existing CHIP_BASE sites
- New `useKeyStore` Zustand for in-memory viewing-key hash
- New `passphrase-encrypt` lib (PBKDF2-SHA256 310k + XChaCha20-Poly1305)
- New thin backend `POST /api/keys/generate` (no persistence — wraps existing `executeViewingKey('generate')`)
- New admin-only backend `GET /api/sentinel/config` (read-only inspector for SENTINEL config + fund-moving tools list)
- New `KeysView` (2-column: ViewKeyCard + StealthAddressBackup) — visible to all logged-in users
- New `SettingsView` — 5 read-only sections (Network, SENTINEL mode, Preflight envelope, LLM cost guard, Fund-moving tools); admin-gated
- Tokens: `--color-herald-soft`, `--color-sentinel-soft` added
- Routing/nav: View enum extended; Header NAV_ITEMS + BottomNav drawer surfaces both routes

## Tests

- App: 291 → 319 (+28)
- Agent: 1391 → 1399 (+8)
- TSC: clean

## Test plan

- [x] CI is 7/7 green
- [x] Vercel preview renders KeysView + SettingsView correctly
- [ ] Manual: admin sees Settings nav item; non-admin does not
- [ ] Manual: direct URL `/settings` as non-admin → redirect to /dashboard
- [ ] Manual: ViewKeyCard generate downloads file + shows hash; rotate confirm replaces it
- [ ] Manual: StealthAddressBackup empty state renders (PR 4 stub)
- [ ] Manual: SettingsView renders all 5 sections; FUND_MOVING_TOOLS shows 10 tools

## Out of scope

- Persistent server-side viewing keys (D1 — deferred)
- Editable SENTINEL mode/thresholds (D5 — deferred)
- FUND_MOVING_TOOLS allowlist toggle (D4 — deferred)
- Backup decryption / restore UI (D2 — lands in M19)
EOF
)"
```

- [ ] **Step 6: Wait for CI green**

```bash
gh pr checks --watch
# expect: 7/7 green (Scan for secrets, Vercel, Vercel Preview Comments, component, playwright, test build-and-push, deploy skip)
```

- [ ] **Step 7: Switch to main BEFORE merging (avoid worktree-owns-main quirk)**

```bash
cd ~/local-dev/sipher       # parent worktree
git checkout main           # already there or switch
gh pr merge <PR#> --merge --delete-branch
```

- [ ] **Step 8: Sync local main + remove worktree**

```bash
git pull origin main
git worktree remove .worktrees/feat-redesign-keys-settings
git branch -D feat/redesign-keys-settings
git status   # expect: clean
git log --oneline -3
```

- [ ] **Step 9: Update sprint memory**

Edit `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/project_phase4b-redesign-sprint.md`: bump PR 7 to MERGED with the new SHA. Add a "PR 7 SHIPPED" note in the sprint progress section.

---

## Subagent dispatch guide

Tasks marked **subagent** below benefit from a fresh subagent dispatch with two-stage review (implementer → spec-reviewer → code-quality-reviewer). Tasks marked **inline** are mechanical enough to do in the parent session.

| Task | Mode | Reasoning |
|---|---|---|
| 1 — tokens | **inline** | 4-line CSS edit |
| 2 — `<Chip>` primitive | **subagent** | New file with 6 tests, type design matters |
| 3 — migrate 5 sites | **inline** | Mechanical, but `git status` after to catch stray edits |
| 4 — `useKeyStore` | **inline** | Trivial Zustand store, 3 tests |
| 5 — `passphrase-encrypt` | **subagent** | Crypto correctness; reviewer must verify PBKDF2 params + XChaCha20-Poly1305 nonce/salt sizes |
| 6 — keys backend | **subagent** | New route + tests + index.ts mount; reviewer verifies no DB writes |
| 7 — sentinel-config backend | **subagent** | New admin endpoint; reviewer verifies admin gate + payload completeness |
| 8 — ViewKeyCard | **subagent** | UI + state + side effects; reviewer verifies download flow + Sheet API |
| 9 — StealthAddressBackup | **subagent** | UI + crypto + AbortController; reviewer verifies error retry + passphrase validation |
| 10 — KeysView | **inline** | Two-component composition; trivial |
| 11 — SettingsView | **subagent** | Admin gate + 5 sections + read pattern; reviewer verifies all chip tones + redirect |
| 12 — View enum + App.tsx | **inline** | Two-line additions |
| 13 — Header NAV | **inline** | NAV_ITEMS array extension |
| 14 — BottomNav | **inline** | Same |
| 15 — verify + PR | **inline** | Single session, single PR |

After every subagent run: `git status` before committing — subagents have touched out-of-scope files in past sessions (caught in PR 6b).

---

## Self-review

**Spec coverage check:**

| Spec section | Plan task |
|---|---|
| D1 — viewing keys client-only + thin POST endpoint | Task 6 |
| D2 — StealthAddressBackup snapshots address list | Task 9 |
| D3 — /settings admin-only; /keys all users | Tasks 10, 11, 13 |
| D4 — FUND_MOVING_TOOLS read-only chip list | Task 7 (BE), Task 11 (FE) |
| D5 — SENTINEL_MODE read-only chip | Task 11 |
| D6 — `<Chip>` extraction is Task 0 | Tasks 1, 2, 3 |
| Architecture: 8 new files (FE) + 1 new file (BE) + 2 modified BE + 5 chip migrations + 5 routing/nav modifications | Tasks 1–14 |
| Component contracts: Chip, useKeyStore, passphrase-encrypt, ViewKeyCard, StealthAddressBackup, KeysView, SettingsView | Tasks 2, 4, 5, 8, 9, 10, 11 |
| Data flow: KeysView mount, SettingsView mount | Tasks 8, 9, 10, 11 |
| Error handling: 9 failure modes | Covered across Tasks 8, 9, 11 (toast/alert/redirect patterns) |
| Testing: +28 app, +8 agent | Confirmed; net delta verified at Task 15 step 1 |

**Placeholder scan:** No "TBD", "TODO", or "fill in details" in the plan. The TODO inside `sentinel-api.ts` JSDoc ("TODO: document this endpoint after merge") refers to follow-up doc work after PR 7 merges, not a plan placeholder.

**Type consistency check:**
- `ChipTone` defined once in Task 2; consumed in Tasks 8, 9, 11.
- `SentinelConfigPayload` defined once in Task 11; produced by Task 7's BE response.
- `GenerateKeyResponse` defined once in Task 8 step 1; consumed by ViewKeyCard.
- `EncryptedBlob` defined once in Task 5; consumed by StealthAddressBackup.

All names align across tasks. No drift.

---

## Carry-forward execution rules (from sprint)

1. NO AI attribution in commits/PRs/files.
2. NO semicolons in TS/TSX (single quotes for imports).
3. Conventional commits: `feat(ui):` for `<Chip>`, `feat(redesign):` for views, `feat(agent):` for backend, `test(...)`, `refactor(redesign):` for migrations, `docs(...)`.
4. NEVER amend commits; create new ones.
5. TDD: failing test → implement → passing test, per task.
6. CI must be green before merge — Vercel preview is the visual gate.
7. `--merge --delete-branch` (NOT squash). After merge: sync local main, remove worktree, delete local branch. Switch to main BEFORE running `gh pr merge` to avoid the worktree-owns-main quirk from PR 6b.
8. `superpowers:verification-before-completion` before any "task done" claim.
9. `git status` after every subagent run before committing.
