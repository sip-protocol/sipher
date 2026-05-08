# PR 6 Vault Flows — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the form-driven, real-on-chain Sipher Vault interaction layer for the redesigned web app, in two PRs (6a deposit + 6b refund).

**Architecture:** Frontend uses the existing `useTransactionSigner` hook to drive real wallet popups and broadcast confirmation. Backend exposes thin REST adapters over existing `@sipher/sdk` builders (`buildDepositTx`, `buildRefundTx`, `fetchDepositRecord`) — zero SDK changes. Privacy-score projection extends the existing endpoint with an optional `projectedAmount` body field; honest math (synthetic-tx re-run) drives the side-by-side gauge in `PrivacyPreviewPanel`. Sipher Vault is devnet-only, enforced both in UI (`BetaBanner` extension + disabled CTAs on mainnet) and server (`409 VAULT_UNAVAILABLE` on every new endpoint). PR 6a delivers VaultView restyle + DepositView + 3 backend routes; PR 6b adds WithdrawView (refund-to-self) + 1 backend route. Claim and private-send-to-stealth deferred to Phase 2 / M19.

**Tech Stack:** Vite 6 + React 19 + TypeScript 5.7 + Tailwind 4 + Zustand 5 + Vitest 3 (FE) · Express 5 + supertest + Vitest 3 (BE) · pnpm 10 + Turborepo · Vercel (FE host) · VPS Docker (BE host) · `@sipher/sdk` workspace package · `@solana/wallet-adapter-react`.

**Spec:** [`docs/superpowers/specs/2026-05-08-pr6-vault-flows-design.md`](../specs/2026-05-08-pr6-vault-flows-design.md) — binding for every decision in this plan.

---

## Scope summary

| | PR 6a | PR 6b |
|---|---|---|
| Branch | `feat/redesign-vault-flows-deposit` | `feat/redesign-vault-flows-withdraw` |
| Worktree | `.worktrees/feat-redesign-vault-flows-deposit/` | `.worktrees/feat-redesign-vault-flows-withdraw/` |
| Backend routes | 3 (`POST /api/vault/deposit-tx`, `GET /api/vault/positions`, extend `POST /v1/privacy/score`) | 1 (`POST /api/vault/refund-tx`) |
| New FE views | DepositView | WithdrawView |
| New FE components | StealthAddressList, RoutePreviewCard, PrivacyPreviewPanel, DepositForm, AssetSelector, TxStatusBadge | RefundList, CooldownChip |
| Modified FE files | VaultView, App.tsx, stores/app.ts, BetaBanner, Header | App.tsx, stores/app.ts |
| Estimated commits | 8 implementation + 1 manual smoke + 1 PR description = ~10 actionable tasks | 5 implementation + 1 manual smoke + 1 PR description = ~7 actionable tasks |
| Estimated LOC delta | ~+1,500 (incl. tests) | ~+700 (incl. tests) |
| Test count delta | App +45, Agent +17 | App +18, Agent +8 |

---

## File Structure (locked)

### PR 6a — files

**Created (frontend):**
- `app/src/views/DepositView.tsx`
- `app/src/components/vault/StealthAddressList.tsx`
- `app/src/components/vault/RoutePreviewCard.tsx`
- `app/src/components/vault/PrivacyPreviewPanel.tsx`
- `app/src/components/vault/DepositForm.tsx`
- `app/src/components/vault/AssetSelector.tsx`
- `app/src/components/vault/TxStatusBadge.tsx`
- `app/src/components/vault/__tests__/StealthAddressList.test.tsx`
- `app/src/components/vault/__tests__/RoutePreviewCard.test.tsx`
- `app/src/components/vault/__tests__/PrivacyPreviewPanel.test.tsx`
- `app/src/components/vault/__tests__/DepositForm.test.tsx`
- `app/src/components/vault/__tests__/AssetSelector.test.tsx`
- `app/src/components/vault/__tests__/TxStatusBadge.test.tsx`
- `app/src/views/__tests__/DepositView.test.tsx`

**Created (backend):**
- `packages/agent/src/routes/vault-deposit-tx.ts`
- `packages/agent/src/routes/vault-positions.ts`
- `packages/agent/tests/routes/vault-deposit-tx.test.ts`
- `packages/agent/tests/routes/vault-positions.test.ts`
- `packages/agent/tests/routes/privacy-score-projected.test.ts` (new test file against existing `src/routes/privacy.ts`)

**Modified:**
- `packages/agent/src/index.ts` — mount new routes
- `src/routes/privacy.ts` — extend body schema + algorithm to support `projectedAmount`/`projectedToken`
- `app/src/views/VaultView.tsx` — split-panel rewrite
- `app/src/views/__tests__/VaultView.test.tsx` (and `VaultView-actions.test.tsx`) — adapted to new layout
- `app/src/stores/app.ts` — add `'deposit'` to `View` type
- `app/src/App.tsx` — add `case 'deposit'` to `renderView`
- `app/src/components/Header.tsx` — extend Vault tab active matcher to include `'deposit'`
- `app/src/components/BetaBanner.tsx` — add devnet-only banner extension copy

### PR 6b — files

**Created (frontend):**
- `app/src/views/WithdrawView.tsx`
- `app/src/components/vault/RefundList.tsx`
- `app/src/components/vault/CooldownChip.tsx`
- `app/src/components/vault/__tests__/RefundList.test.tsx`
- `app/src/components/vault/__tests__/CooldownChip.test.tsx`
- `app/src/views/__tests__/WithdrawView.test.tsx`

**Created (backend):**
- `packages/agent/src/routes/vault-refund-tx.ts`
- `packages/agent/tests/routes/vault-refund-tx.test.ts`

**Modified:**
- `packages/agent/src/index.ts` — mount refund-tx route
- `app/src/stores/app.ts` — add `'withdraw'` to `View` type
- `app/src/App.tsx` — add `case 'withdraw'` to `renderView`
- `app/src/components/Header.tsx` — extend Vault tab active matcher to include `'withdraw'`

---

## Pre-flight (do once before PR 6a)

- [ ] **0.1 — Confirm clean main**

```bash
cd ~/local-dev/sipher
git checkout main && git pull origin main
git status   # expect: nothing to commit, working tree clean
git log --oneline -3
# expect: 74cb083 docs(spec): PR 6 vault flows design — split into 6a deposit + 6b refund
#         1d0ded9 Merge pull request #182 from sip-protocol/feat/redesign-chains
```

- [ ] **0.2 — Confirm spec is committed**

```bash
git log --oneline -- docs/superpowers/specs/2026-05-08-pr6-vault-flows-design.md | head -1
# expect: 74cb083 docs(spec): PR 6 vault flows design — split into 6a deposit + 6b refund
```

- [ ] **0.3 — Confirm baseline test counts**

```bash
pnpm --filter @sipher/agent test --run 2>&1 | tail -5
# expect: ~1357 agent tests passing (104 suites)

pnpm --filter sipher-app test --run 2>&1 | tail -5
# expect: 237 app tests passing
```

If counts diverge, do not start PR 6a — investigate first.

- [ ] **0.4 — Confirm SDK builds clean**

```bash
pnpm --filter "@sipher/sdk" build 2>&1 | tail -3
# expect: build succeeds (or "Done" message)
```

---

# PR 6a — `feat/redesign-vault-flows-deposit`

**Branch:** `feat/redesign-vault-flows-deposit` · **Worktree:** `.worktrees/feat-redesign-vault-flows-deposit/`
**Goal:** VaultView restyled as split-panel + DepositView with real on-chain signing + 3 new backend routes + PrivacyPreviewPanel with honest projected math.
**Acceptance:** Vercel preview shows new vault surface; manual smoke deposit on devnet succeeds and visible on Solscan; mainnet path renders banner + disabled CTAs; tests +45 app, +17 agent.

## PR 6a / Task 1: Worktree + verify deps

- [ ] **Step 1: Create worktree from main**

```bash
cd ~/local-dev/sipher
git worktree add -b feat/redesign-vault-flows-deposit \
  .worktrees/feat-redesign-vault-flows-deposit main
cd .worktrees/feat-redesign-vault-flows-deposit
pnpm install
pnpm --filter "@sipher/sdk" build
```

- [ ] **Step 2: Sanity check existing surfaces are present**

```bash
test -f app/src/hooks/useTransactionSigner.ts && echo "tx signer ok"
test -f app/src/components/AmountForm.tsx && echo "AmountForm ok"
test -f packages/agent/src/tools/deposit.ts && echo "deposit tool ok"
test -f packages/agent/src/routes/vault-api.ts && echo "vault-api ok"
test -f src/routes/privacy.ts && echo "v1 privacy route ok"
```

All five should print "ok".

## PR 6a / Task 2: Backend `POST /api/vault/deposit-tx`

**Files:**
- Create: `packages/agent/src/routes/vault-deposit-tx.ts`
- Create: `packages/agent/tests/routes/vault-deposit-tx.test.ts`
- Modify: `packages/agent/src/index.ts` (mount the route)

- [ ] **Step 1: Write the failing test first**

Create `packages/agent/tests/routes/vault-deposit-tx.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import express, { type Request, type Response, type NextFunction } from 'express'
import supertest from 'supertest'

const TEST_WALLET = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'

// Mock loadNetworkConfig to control devnet vs mainnet
vi.mock('../../src/config/network.js', () => ({
  loadNetworkConfig: vi.fn(() => ({ clusterName: 'devnet' })),
}))

// Mock the deposit tool (executeDeposit) — backend route is a thin REST wrapper
vi.mock('../../src/tools/deposit.js', () => ({
  executeDeposit: vi.fn(),
}))

import { executeDeposit } from '../../src/tools/deposit.js'
import { loadNetworkConfig } from '../../src/config/network.js'
import { vaultDepositTxRouter } from '../../src/routes/vault-deposit-tx.js'

function mockAuth(wallet: string | null) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (wallet) (req as unknown as { wallet: string }).wallet = wallet
    next()
  }
}

function createApp(wallet: string | null = TEST_WALLET) {
  const app = express()
  app.use(express.json())
  app.use('/api/vault', mockAuth(wallet), vaultDepositTxRouter)
  return app
}

beforeEach(() => {
  vi.mocked(executeDeposit).mockReset()
  vi.mocked(loadNetworkConfig).mockReturnValue({ clusterName: 'devnet' } as ReturnType<typeof loadNetworkConfig>)
})

describe('POST /api/vault/deposit-tx', () => {
  it('returns serializedTx + metadata for a valid SOL deposit', async () => {
    vi.mocked(executeDeposit).mockResolvedValueOnce({
      action: 'deposit',
      amount: 1.5,
      token: 'SOL',
      wallet: TEST_WALLET,
      status: 'awaiting_signature',
      message: 'ok',
      serializedTx: 'BASE64SERIALIZED',
      details: {
        vaultProgram: 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB',
        depositRecordAddress: 'DEPOSITRECORDPDA',
        vaultTokenAddress: 'VAULTTOKENPDA',
        amountBaseUnits: '1500000000',
        estimatedFee: '~5000 lamports (tx fee)',
        note: 'Funds enter the shared anonymity pool.',
      },
    })

    const res = await supertest(createApp())
      .post('/api/vault/deposit-tx')
      .send({ amount: 1.5, token: 'SOL' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      serializedTx: 'BASE64SERIALIZED',
      depositRecordAddress: 'DEPOSITRECORDPDA',
      vaultTokenAddress: 'VAULTTOKENPDA',
      amountBaseUnits: '1500000000',
      network: 'devnet',
    })
    expect(typeof res.body.feeBps).toBe('number')
  })

  it('returns 400 INVALID_AMOUNT when amount <= 0', async () => {
    const res = await supertest(createApp())
      .post('/api/vault/deposit-tx')
      .send({ amount: 0, token: 'SOL' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_AMOUNT')
  })

  it('returns 400 INVALID_TOKEN when token is missing', async () => {
    const res = await supertest(createApp())
      .post('/api/vault/deposit-tx')
      .send({ amount: 1, token: '' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })

  it('returns 401 envelope when JWT middleware did not attach req.wallet', async () => {
    const res = await supertest(createApp(null))
      .post('/api/vault/deposit-tx')
      .send({ amount: 1, token: 'SOL' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 409 VAULT_UNAVAILABLE on mainnet-beta', async () => {
    vi.mocked(loadNetworkConfig).mockReturnValueOnce({ clusterName: 'mainnet-beta' } as ReturnType<typeof loadNetworkConfig>)

    const res = await supertest(createApp())
      .post('/api/vault/deposit-tx')
      .send({ amount: 1.5, token: 'SOL' })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('VAULT_UNAVAILABLE')
    expect(res.body.error.message).toMatch(/devnet/i)
  })

  it('propagates SDK errors as 500 with a normalized envelope', async () => {
    vi.mocked(executeDeposit).mockRejectedValueOnce(new Error('SDK boom'))

    const res = await supertest(createApp())
      .post('/api/vault/deposit-tx')
      .send({ amount: 1.5, token: 'SOL' })

    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('INTERNAL')
    expect(res.body.error.message).toMatch(/SDK boom/)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm --filter @sipher/agent test -- vault-deposit-tx --run 2>&1 | tail -10
# expect: FAIL — Cannot find module '../../src/routes/vault-deposit-tx.js'
```

- [ ] **Step 3: Implement the route**

Create `packages/agent/src/routes/vault-deposit-tx.ts`:

```ts
import { Router, type Request, type Response } from 'express'
import { executeDeposit } from '../tools/deposit.js'
import { loadNetworkConfig } from '../config/network.js'
import { DEFAULT_FEE_BPS } from '@sipher/sdk'

export const vaultDepositTxRouter = Router()

const VALID_TOKENS = ['SOL', 'USDC', 'USDT'] as const
type ValidToken = (typeof VALID_TOKENS)[number]

function isValidToken(token: unknown): token is ValidToken {
  return typeof token === 'string' && (VALID_TOKENS as readonly string[]).includes(token.toUpperCase())
}

vaultDepositTxRouter.post('/deposit-tx', async (req: Request, res: Response) => {
  const wallet = req.wallet
  if (!wallet) {
    res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authenticated wallet required',
      },
    })
    return
  }

  const network = loadNetworkConfig().clusterName
  if (network !== 'devnet') {
    res.status(409).json({
      error: {
        code: 'VAULT_UNAVAILABLE',
        message: 'Sipher Vault is on devnet only — switch network',
      },
    })
    return
  }

  const { amount, token } = req.body as { amount?: number; token?: string }

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({
      error: { code: 'INVALID_AMOUNT', message: 'Amount must be > 0' },
    })
    return
  }

  if (!isValidToken(token)) {
    res.status(400).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token must be SOL, USDC, or USDT',
      },
    })
    return
  }

  try {
    const result = await executeDeposit({ amount, token: token.toUpperCase(), wallet })
    if (!result.serializedTx) {
      res.status(500).json({
        error: {
          code: 'INTERNAL',
          message: 'deposit tool returned no serialized transaction',
        },
      })
      return
    }
    res.json({
      serializedTx: result.serializedTx,
      depositRecordAddress: result.details.depositRecordAddress,
      vaultTokenAddress: result.details.vaultTokenAddress,
      amountBaseUnits: result.details.amountBaseUnits,
      feeBps: DEFAULT_FEE_BPS,
      network,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    res.status(500).json({
      error: { code: 'INTERNAL', message },
    })
  }
})
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm --filter @sipher/agent test -- vault-deposit-tx --run 2>&1 | tail -10
# expect: 6 tests passing
```

- [ ] **Step 5: Mount route in `packages/agent/src/index.ts`**

Find the existing vault router mount near line 192 and add the new route below it:

```ts
// Vault activity feed (per-wallet) — JWT required
app.use('/api/vault', verifyJwt, vaultRouter)

// Vault deposit-tx builder — JWT required (PR 6a)
app.use('/api/vault', verifyJwt, vaultDepositTxRouter)
```

Add the import at the top of the file alongside other route imports:

```ts
import { vaultDepositTxRouter } from './routes/vault-deposit-tx.js'
```

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/routes/vault-deposit-tx.ts \
        packages/agent/tests/routes/vault-deposit-tx.test.ts \
        packages/agent/src/index.ts
git commit -m "feat(agent): POST /api/vault/deposit-tx — REST adapter for deposit tx builder"
```

## PR 6a / Task 3: Backend `GET /api/vault/positions`

**Files:**
- Create: `packages/agent/src/routes/vault-positions.ts`
- Create: `packages/agent/tests/routes/vault-positions.test.ts`
- Modify: `packages/agent/src/index.ts` (mount the route)

- [ ] **Step 1: Write the failing test first**

Create `packages/agent/tests/routes/vault-positions.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import express, { type Request, type Response, type NextFunction } from 'express'
import supertest from 'supertest'
import { PublicKey } from '@solana/web3.js'

const TEST_WALLET = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'

vi.mock('../../src/config/network.js', () => ({
  loadNetworkConfig: vi.fn(() => ({ clusterName: 'devnet' })),
}))

vi.mock('@sipher/sdk', async () => {
  const actual = await vi.importActual<typeof import('@sipher/sdk')>('@sipher/sdk')
  return {
    ...actual,
    fetchDepositRecord: vi.fn(),
    createConnection: vi.fn(() => ({})),
  }
})

import { fetchDepositRecord } from '@sipher/sdk'
import { loadNetworkConfig } from '../../src/config/network.js'
import { vaultPositionsRouter } from '../../src/routes/vault-positions.js'

function mockAuth(wallet: string | null) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (wallet) (req as unknown as { wallet: string }).wallet = wallet
    next()
  }
}

function createApp(wallet: string | null = TEST_WALLET) {
  const app = express()
  app.use('/api/vault', mockAuth(wallet), vaultPositionsRouter)
  return app
}

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

beforeEach(() => {
  vi.mocked(fetchDepositRecord).mockReset()
  vi.mocked(loadNetworkConfig).mockReturnValue({ clusterName: 'devnet' } as ReturnType<typeof loadNetworkConfig>)
})

describe('GET /api/vault/positions', () => {
  it('returns empty positions when no records exist', async () => {
    vi.mocked(fetchDepositRecord).mockResolvedValue(null)

    const res = await supertest(createApp()).get('/api/vault/positions')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      positions: [],
      network: 'devnet',
      available: true,
    })
  })

  it('returns one row per non-zero deposit_record', async () => {
    vi.mocked(fetchDepositRecord).mockImplementation(async (_conn, _depositor, mint) => {
      if (mint.toBase58() === SOL_MINT) {
        return {
          depositor: new PublicKey(TEST_WALLET),
          tokenMint: new PublicKey(SOL_MINT),
          balance: 2_500_000_000n,
          lockedAmount: 0n,
          totalDeposits: 1n,
          lastDepositAt: 1715000000n,
        }
      }
      return null
    })

    const res = await supertest(createApp()).get('/api/vault/positions')

    expect(res.status).toBe(200)
    expect(res.body.positions).toHaveLength(1)
    expect(res.body.positions[0]).toMatchObject({
      mint: SOL_MINT,
      symbol: 'SOL',
      balance: '2500000000',
      balanceUiAmount: 2.5,
      lockedAmount: '0',
      decimals: 9,
      lastDepositAt: 1715000000,
      cooldownActive: expect.any(Boolean),
    })
    expect(typeof res.body.positions[0].refundableAt).toBe('number')
    expect(typeof res.body.positions[0].depositRecordAddress).toBe('string')
  })

  it('skips records with zero balance', async () => {
    vi.mocked(fetchDepositRecord).mockResolvedValue({
      depositor: new PublicKey(TEST_WALLET),
      tokenMint: new PublicKey(SOL_MINT),
      balance: 0n,
      lockedAmount: 0n,
      totalDeposits: 0n,
      lastDepositAt: 0n,
    })

    const res = await supertest(createApp()).get('/api/vault/positions')
    expect(res.body.positions).toEqual([])
  })

  it('returns available:false on mainnet-beta', async () => {
    vi.mocked(loadNetworkConfig).mockReturnValueOnce({ clusterName: 'mainnet-beta' } as ReturnType<typeof loadNetworkConfig>)

    const res = await supertest(createApp()).get('/api/vault/positions')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      positions: [],
      network: 'mainnet-beta',
      available: false,
      reason: 'mainnet-beta_no_vault',
    })
  })

  it('returns available:false with rpc_unavailable when fetch throws', async () => {
    vi.mocked(fetchDepositRecord).mockRejectedValue(new Error('rpc dead'))

    const res = await supertest(createApp()).get('/api/vault/positions')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      positions: [],
      available: false,
      reason: 'rpc_unavailable',
    })
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm --filter @sipher/agent test -- vault-positions --run 2>&1 | tail -10
# expect: FAIL — Cannot find module '../../src/routes/vault-positions.js'
```

- [ ] **Step 3: Implement the route**

Create `packages/agent/src/routes/vault-positions.ts`:

```ts
import { Router, type Request, type Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import {
  WSOL_MINT,
  USDC_MINT,
  USDT_MINT,
  fetchDepositRecord,
  deriveDepositRecordPDA,
  createConnection,
  SIPHER_VAULT_PROGRAM_ID,
} from '@sipher/sdk'
import { loadNetworkConfig } from '../config/network.js'

const REFUND_TIMEOUT_SECONDS = 86400 // matches sipher_vault devnet config

const KNOWN_MINTS: { mint: PublicKey; symbol: string; decimals: number }[] = [
  { mint: WSOL_MINT, symbol: 'SOL', decimals: 9 },
  { mint: USDC_MINT, symbol: 'USDC', decimals: 6 },
  { mint: USDT_MINT, symbol: 'USDT', decimals: 6 },
]

interface Position {
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

export const vaultPositionsRouter = Router()

vaultPositionsRouter.get('/positions', async (req: Request, res: Response) => {
  const wallet = req.wallet
  if (!wallet) {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Authenticated wallet required' },
    })
    return
  }

  const network = loadNetworkConfig().clusterName
  if (network !== 'devnet') {
    res.json({
      positions: [],
      network,
      available: false,
      reason: 'mainnet-beta_no_vault',
    })
    return
  }

  let depositor: PublicKey
  try {
    depositor = new PublicKey(wallet)
  } catch {
    res.status(400).json({
      error: { code: 'INVALID_WALLET', message: 'Wallet is not a valid base58 pubkey' },
    })
    return
  }

  const connection = createConnection(network)
  const positions: Position[] = []
  const nowSeconds = Math.floor(Date.now() / 1000)

  try {
    for (const { mint, symbol, decimals } of KNOWN_MINTS) {
      const record = await fetchDepositRecord(connection, depositor, mint)
      if (!record || record.balance === 0n) continue

      const [pda] = deriveDepositRecordPDA(depositor, mint, SIPHER_VAULT_PROGRAM_ID)
      const lastDepositAt = Number(record.lastDepositAt)
      const refundableAt = lastDepositAt + REFUND_TIMEOUT_SECONDS

      positions.push({
        mint: mint.toBase58(),
        symbol,
        balance: record.balance.toString(),
        balanceUiAmount: Number(record.balance) / 10 ** decimals,
        lockedAmount: record.lockedAmount.toString(),
        decimals,
        lastDepositAt,
        refundableAt,
        cooldownActive: nowSeconds < refundableAt,
        depositRecordAddress: pda.toBase58(),
      })
    }
  } catch (err) {
    console.warn('[vault-positions] fetch failed:', err instanceof Error ? err.message : err)
    res.json({
      positions: [],
      network,
      available: false,
      reason: 'rpc_unavailable',
    })
    return
  }

  res.json({
    positions,
    network,
    available: true,
  })
})
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm --filter @sipher/agent test -- vault-positions --run 2>&1 | tail -10
# expect: 5 tests passing
```

- [ ] **Step 5: Mount route in `packages/agent/src/index.ts`**

Add below the deposit-tx mount:

```ts
// Vault positions list (deposit_records by mint) — JWT required (PR 6a)
app.use('/api/vault', verifyJwt, vaultPositionsRouter)
```

Import at top alongside other route imports:

```ts
import { vaultPositionsRouter } from './routes/vault-positions.js'
```

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/routes/vault-positions.ts \
        packages/agent/tests/routes/vault-positions.test.ts \
        packages/agent/src/index.ts
git commit -m "feat(agent): GET /api/vault/positions — deposit_records grouped by mint"
```

## PR 6a / Task 4: Extend `POST /v1/privacy/score` for `projectedAmount`

**Files:**
- Modify: `src/routes/privacy.ts` (add optional `projectedAmount`/`projectedToken` body fields + synthetic-tx algorithm)
- Create: `packages/agent/tests/routes/privacy-score-projected.test.ts` (the v1 mode-2 app is loaded by the agent in non-test contexts; we test the route module directly)

- [ ] **Step 1: Read current `src/routes/privacy.ts` end-to-end**

```bash
wc -l src/routes/privacy.ts   # 290 lines
```

Current scope: route accepts `{ address, limit }` body, returns `{ success, data: { score, grade, transactionsAnalyzed, factors, recommendations } }`. Four factor analyzers consume `txData[]`, `amounts[]`, `timestamps[]`. We will append a synthetic record to each input and re-run.

- [ ] **Step 2: Write the failing test first**

Create `packages/agent/tests/routes/privacy-score-projected.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import express from 'express'
import supertest from 'supertest'

// Mock the v1 solana service to avoid hitting devnet RPC in unit tests
vi.mock('../../../../src/services/solana.js', () => ({
  getConnection: vi.fn(() => ({
    getSignaturesForAddress: vi.fn().mockResolvedValue([]),
    getTransaction: vi.fn().mockResolvedValue(null),
  })),
}))

import privacyRouter from '../../../../src/routes/privacy.js'

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/v1', privacyRouter)
  return app
}

const TEST_ADDRESS = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'

describe('POST /v1/privacy/score (projected extension)', () => {
  it('returns identical shape when projectedAmount is absent (backwards-compatible)', async () => {
    const res = await supertest(createApp())
      .post('/v1/privacy/score')
      .send({ address: TEST_ADDRESS, limit: 50 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toMatchObject({
      address: TEST_ADDRESS,
      score: expect.any(Number),
      grade: expect.any(String),
      transactionsAnalyzed: expect.any(Number),
      factors: expect.objectContaining({
        addressReuse: expect.any(Object),
        amountPatterns: expect.any(Object),
        timingCorrelation: expect.any(Object),
        counterpartyExposure: expect.any(Object),
      }),
      recommendations: expect.any(Array),
    })
    expect(res.body.data.projected).toBeUndefined()
  })

  it('returns projected block when projectedAmount + projectedToken provided', async () => {
    const res = await supertest(createApp())
      .post('/v1/privacy/score')
      .send({
        address: TEST_ADDRESS,
        limit: 50,
        projectedAmount: 1.5,
        projectedToken: 'SOL',
      })

    expect(res.status).toBe(200)
    expect(res.body.data.projected).toBeDefined()
    expect(res.body.data.projected).toMatchObject({
      score: expect.any(Number),
      grade: expect.any(String),
      factors: expect.objectContaining({
        addressReuse: expect.objectContaining({ score: expect.any(Number), detail: expect.any(String) }),
        amountPatterns: expect.objectContaining({ score: expect.any(Number) }),
        timingCorrelation: expect.objectContaining({ score: expect.any(Number) }),
        counterpartyExposure: expect.objectContaining({ score: expect.any(Number) }),
      }),
      delta: expect.objectContaining({
        score: expect.any(Number),
        addressReuse: expect.any(Number),
        amountPatterns: expect.any(Number),
        timingCorrelation: expect.any(Number),
        counterpartyExposure: expect.any(Number),
      }),
    })
  })

  it('defaults projectedToken to SOL when only projectedAmount is provided', async () => {
    const res = await supertest(createApp())
      .post('/v1/privacy/score')
      .send({ address: TEST_ADDRESS, projectedAmount: 0.25 })

    expect(res.status).toBe(200)
    expect(res.body.data.projected).toBeDefined()
  })

  it('returns 400 INVALID_PROJECTED_AMOUNT when projectedAmount is 0', async () => {
    const res = await supertest(createApp())
      .post('/v1/privacy/score')
      .send({ address: TEST_ADDRESS, projectedAmount: 0 })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('INVALID_PROJECTED_AMOUNT')
  })

  it('returns 400 INVALID_PROJECTED_AMOUNT when projectedAmount is negative', async () => {
    const res = await supertest(createApp())
      .post('/v1/privacy/score')
      .send({ address: TEST_ADDRESS, projectedAmount: -1 })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_PROJECTED_AMOUNT')
  })

  it('returns 400 INVALID_TOKEN when projectedToken is unknown', async () => {
    const res = await supertest(createApp())
      .post('/v1/privacy/score')
      .send({ address: TEST_ADDRESS, projectedAmount: 1, projectedToken: 'BOGUS' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })
})
```

- [ ] **Step 3: Run test, verify it fails**

```bash
pnpm --filter @sipher/agent test -- privacy-score-projected --run 2>&1 | tail -20
# expect: FAIL — body.data.projected is undefined when projectedAmount is provided
```

- [ ] **Step 4: Extend `src/routes/privacy.ts`**

Update the schema and handler. Replace the existing `scoreSchema`:

```ts
const scoreSchema = z.object({
  address: z.string().min(32).max(44),
  limit: z.number().int().min(10).max(500).default(100),
  // projectedAmount + projectedToken are validated explicitly in the handler
  // (NOT via zod) so that the error codes (INVALID_PROJECTED_AMOUNT, INVALID_TOKEN)
  // match the spec envelope rather than zod's default schema-error shape.
  projectedAmount: z.number().optional(),
  projectedToken: z.string().optional(),
})
```

Add a token-decimals helper near the top of the file (below `KNOWN_PROGRAMS`):

```ts
const TOKEN_DECIMALS: Record<string, number> = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
}

function projectedAmountToBase(amount: number, token: string): bigint {
  const decimals = TOKEN_DECIMALS[token]
  if (decimals === undefined) throw new Error(`Unknown token: ${token}`)
  return BigInt(Math.round(amount * 10 ** decimals))
}
```

In the route handler, after the four `analyze*` calls but before the `res.json` block, add the projection branch. Find the existing line that constructs `factors`:

```ts
const factors = { addressReuse, amountPatterns, timingCorrelation, counterpartyExposure }
```

After it, add:

```ts
let projectedBlock: {
  score: number
  grade: string
  factors: Record<string, { score: number; detail: string }>
  delta: {
    score: number
    addressReuse: number
    amountPatterns: number
    timingCorrelation: number
    counterpartyExposure: number
  }
} | undefined

if (req.body.projectedAmount !== undefined) {
  if (typeof req.body.projectedAmount !== 'number' || !Number.isFinite(req.body.projectedAmount) || req.body.projectedAmount <= 0) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_PROJECTED_AMOUNT', message: 'projectedAmount must be > 0' },
    })
    return
  }

  const projectedToken = req.body.projectedToken ?? 'SOL'
  if (!(projectedToken in TOKEN_DECIMALS)) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'projectedToken must be SOL, USDC, or USDT' },
    })
    return
  }

  const projectedBaseUnits = projectedAmountToBase(req.body.projectedAmount, projectedToken)

  // Append a synthetic shielded deposit record to the analysis input.
  // - Fresh stealth destination: 32 zero bytes encoded as base58 (will never collide with a real address)
  const SYNTHETIC_STEALTH_ADDR = '1' + '1'.repeat(43) // 44-char base58 placeholder, never matches real chain
  const synthTxData = [...txData, { to: new Set([SYNTHETIC_STEALTH_ADDR]), from: address }]
  const synthAmounts = [...amounts, projectedBaseUnits]
  const synthTimestamps = [...timestamps, Math.floor(Date.now() / 1000)]

  const pAddressReuse = analyzeAddressReuse(synthTxData, address)
  const pAmountPatterns = analyzeAmountPatterns(synthAmounts)
  const pTimingCorrelation = analyzeTimingCorrelation(synthTimestamps)
  const pCounterpartyExposure = analyzeCounterpartyExposure(synthTxData, KNOWN_PROGRAMS)

  const pFactors = {
    addressReuse: pAddressReuse,
    amountPatterns: pAmountPatterns,
    timingCorrelation: pTimingCorrelation,
    counterpartyExposure: pCounterpartyExposure,
  }
  const pTotalWeight = Object.values(pFactors).reduce((sum, f) => sum + f.weight, 0)
  const pWeighted = Object.values(pFactors).reduce((sum, f) => sum + f.score * f.weight, 0)
  const pScore = Math.round(pWeighted / pTotalWeight)
  const pGrade = computeGrade(pScore)

  projectedBlock = {
    score: pScore,
    grade: pGrade,
    factors: {
      addressReuse: { score: pAddressReuse.score, detail: pAddressReuse.detail },
      amountPatterns: { score: pAmountPatterns.score, detail: pAmountPatterns.detail },
      timingCorrelation: { score: pTimingCorrelation.score, detail: pTimingCorrelation.detail },
      counterpartyExposure: { score: pCounterpartyExposure.score, detail: pCounterpartyExposure.detail },
    },
    delta: {
      score: pScore - score,
      addressReuse: pAddressReuse.score - addressReuse.score,
      amountPatterns: pAmountPatterns.score - amountPatterns.score,
      timingCorrelation: pTimingCorrelation.score - timingCorrelation.score,
      counterpartyExposure: pCounterpartyExposure.score - counterpartyExposure.score,
    },
  }
}
```

Replace the existing `res.json` to optionally include `projected`:

```ts
res.json({
  success: true,
  data: {
    address,
    score,
    grade,
    transactionsAnalyzed: signatures.length,
    factors: {
      addressReuse: { score: addressReuse.score, detail: addressReuse.detail },
      amountPatterns: { score: amountPatterns.score, detail: amountPatterns.detail },
      timingCorrelation: { score: timingCorrelation.score, detail: timingCorrelation.detail },
      counterpartyExposure: { score: counterpartyExposure.score, detail: counterpartyExposure.detail },
    },
    recommendations,
    ...(projectedBlock ? { projected: projectedBlock } : {}),
  },
})
```

- [ ] **Step 5: Run test, verify it passes**

```bash
pnpm --filter @sipher/agent test -- privacy-score-projected --run 2>&1 | tail -10
# expect: 6 tests passing
```

- [ ] **Step 6: Verify existing privacy tests still pass (backwards-compat)**

```bash
pnpm --filter @sipher/agent test -- privacy --run 2>&1 | tail -10
# expect: all green; backwards-compat tests included
```

- [ ] **Step 7: Commit**

```bash
git add src/routes/privacy.ts \
        packages/agent/tests/routes/privacy-score-projected.test.ts
git commit -m "feat(privacy): POST /v1/privacy/score accepts projectedAmount + projectedToken"
```

## PR 6a / Task 5: `AssetSelector` + `TxStatusBadge` primitives

**Files:**
- Create: `app/src/components/vault/AssetSelector.tsx`
- Create: `app/src/components/vault/TxStatusBadge.tsx`
- Create: `app/src/components/vault/__tests__/AssetSelector.test.tsx`
- Create: `app/src/components/vault/__tests__/TxStatusBadge.test.tsx`

- [ ] **Step 1: Write the failing AssetSelector test**

Create `app/src/components/vault/__tests__/AssetSelector.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AssetSelector } from '../AssetSelector'

describe('AssetSelector', () => {
  it('renders one button per asset', () => {
    render(<AssetSelector assets={['SOL', 'USDC', 'USDT']} value="SOL" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'SOL' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'USDC' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'USDT' })).toBeInTheDocument()
  })

  it('marks the selected asset with aria-pressed=true', () => {
    render(<AssetSelector assets={['SOL', 'USDC', 'USDT']} value="USDC" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'USDC' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'SOL' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange when a different asset is clicked', () => {
    const onChange = vi.fn()
    render(<AssetSelector assets={['SOL', 'USDC', 'USDT']} value="SOL" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'USDC' }))
    expect(onChange).toHaveBeenCalledWith('USDC')
  })
})
```

- [ ] **Step 2: Implement AssetSelector**

Create `app/src/components/vault/AssetSelector.tsx`:

```tsx
import { Pill } from '../ui/Pill'

interface AssetSelectorProps {
  assets: readonly string[]
  value: string
  onChange: (asset: string) => void
}

export function AssetSelector({ assets, value, onChange }: AssetSelectorProps) {
  return (
    <div className="flex gap-2" role="group" aria-label="Select asset">
      {assets.map((asset) => {
        const active = asset === value
        return (
          <button
            key={asset}
            type="button"
            onClick={() => onChange(asset)}
            aria-pressed={active}
            className="focus:outline-none focus:ring-2 focus:ring-cyan rounded-full"
          >
            <Pill variant={active ? 'cyan' : 'default'}>{asset}</Pill>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Run test, verify pass**

```bash
pnpm --filter sipher-app test -- AssetSelector --run 2>&1 | tail -8
# expect: 3 tests pass
```

- [ ] **Step 4: Write the failing TxStatusBadge test**

Create `app/src/components/vault/__tests__/TxStatusBadge.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TxStatusBadge } from '../TxStatusBadge'

describe('TxStatusBadge', () => {
  it('renders idle status without label', () => {
    const { container } = render(<TxStatusBadge status="idle" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders signing status with explicit label', () => {
    render(<TxStatusBadge status="signing" />)
    expect(screen.getByText(/signing/i)).toBeInTheDocument()
  })

  it('renders broadcasting status with explicit label', () => {
    render(<TxStatusBadge status="broadcasting" />)
    expect(screen.getByText(/broadcasting/i)).toBeInTheDocument()
  })

  it('renders confirmed status with Solscan link when signature provided', () => {
    render(<TxStatusBadge status="confirmed" signature="ABCDEF" />)
    expect(screen.getByText(/confirmed/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /solscan/i })
    expect(link).toHaveAttribute('href', expect.stringContaining('ABCDEF'))
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('renders error status with retry-friendly copy', () => {
    render(<TxStatusBadge status="error" />)
    expect(screen.getByText(/failed/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Implement TxStatusBadge**

Create `app/src/components/vault/TxStatusBadge.tsx`:

```tsx
import { Pill } from '../ui/Pill'
import type { SignStatus } from '../../hooks/useTransactionSigner'

interface TxStatusBadgeProps {
  status: SignStatus
  signature?: string
}

const SOLSCAN_BASE = 'https://solscan.io/tx'

export function TxStatusBadge({ status, signature }: TxStatusBadgeProps) {
  if (status === 'idle') return null

  if (status === 'signing') {
    return <Pill variant="violet">Signing…</Pill>
  }

  if (status === 'broadcasting') {
    return <Pill variant="cyan">Broadcasting…</Pill>
  }

  if (status === 'confirmed') {
    return (
      <div className="flex items-center gap-2">
        <Pill variant="green">Confirmed</Pill>
        {signature && (
          <a
            href={`${SOLSCAN_BASE}/${signature}?cluster=devnet`}
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
    return <Pill variant="danger">Failed — try again</Pill>
  }

  return null
}
```

If `Pill` doesn't have `'danger'` and `'green'` variants yet, fall back to default + className override:

```tsx
<Pill className="border-danger text-danger">Failed — try again</Pill>
```

- [ ] **Step 6: Run test, verify pass**

```bash
pnpm --filter sipher-app test -- TxStatusBadge --run 2>&1 | tail -8
# expect: 5 tests pass
```

- [ ] **Step 7: Commit**

```bash
git add app/src/components/vault/AssetSelector.tsx \
        app/src/components/vault/TxStatusBadge.tsx \
        app/src/components/vault/__tests__/AssetSelector.test.tsx \
        app/src/components/vault/__tests__/TxStatusBadge.test.tsx
git commit -m "feat(ui): AssetSelector + TxStatusBadge vault primitives"
```

## PR 6a / Task 6: `DepositForm` (composes AmountForm)

**Files:**
- Create: `app/src/components/vault/DepositForm.tsx`
- Create: `app/src/components/vault/__tests__/DepositForm.test.tsx`

- [ ] **Step 1: Write the failing test first**

Create `app/src/components/vault/__tests__/DepositForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DepositForm } from '../DepositForm'

const baseProps = {
  onSubmit: vi.fn(),
  maxByAsset: { SOL: 5, USDC: 100, USDT: 100 },
  disabled: false,
  status: 'idle' as const,
}

describe('DepositForm', () => {
  it('renders an AssetSelector with SOL, USDC, USDT', () => {
    render(<DepositForm {...baseProps} />)
    expect(screen.getByRole('button', { name: 'SOL' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'USDC' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'USDT' })).toBeInTheDocument()
  })

  it('renders an amount input with the SOL max by default', () => {
    render(<DepositForm {...baseProps} />)
    expect(screen.getByText(/Max:.*5/)).toBeInTheDocument()
  })

  it('switches max when AssetSelector value changes', () => {
    render(<DepositForm {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'USDC' }))
    expect(screen.getByText(/Max:.*100/)).toBeInTheDocument()
  })

  it('calls onSubmit with (amount, asset) when AmountForm submits', () => {
    const onSubmit = vi.fn()
    render(<DepositForm {...baseProps} onSubmit={onSubmit} />)
    const input = screen.getByPlaceholderText('0.0')
    fireEvent.change(input, { target: { value: '1.5' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onSubmit).toHaveBeenCalledWith(1.5, 'SOL')
  })

  it('renders TxStatusBadge based on status prop', () => {
    render(<DepositForm {...baseProps} status="signing" />)
    expect(screen.getByText(/signing/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm --filter sipher-app test -- DepositForm --run 2>&1 | tail -8
# expect: FAIL — module not found
```

- [ ] **Step 3: Implement DepositForm**

Create `app/src/components/vault/DepositForm.tsx`:

```tsx
import { useState } from 'react'
import AmountForm from '../AmountForm'
import { AssetSelector } from './AssetSelector'
import { TxStatusBadge } from './TxStatusBadge'
import type { SignStatus } from '../../hooks/useTransactionSigner'

interface DepositFormProps {
  onSubmit: (amount: number, asset: string) => Promise<void>
  maxByAsset: Record<string, number>
  disabled: boolean
  status: SignStatus
  signature?: string
}

const ASSETS = ['SOL', 'USDC', 'USDT'] as const

export function DepositForm({
  onSubmit,
  maxByAsset,
  disabled,
  status,
  signature,
}: DepositFormProps) {
  const [asset, setAsset] = useState<string>('SOL')
  const max = maxByAsset[asset] ?? 0

  const handleSubmit = (amount: number) => {
    if (disabled) return
    void onSubmit(amount, asset)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <span
          className="text-2xs text-text-muted"
          style={{ letterSpacing: 'var(--tracking-widest)' }}
        >
          ASSET
        </span>
        <AssetSelector assets={ASSETS} value={asset} onChange={setAsset} />
      </div>
      <AmountForm
        action="Deposit"
        max={max}
        onSubmit={handleSubmit}
        onCancel={() => {}}
      />
      <TxStatusBadge status={status} signature={signature} />
    </div>
  )
}
```

Note: `AmountForm` already accepts `onCancel`. We pass a no-op because cancel is owned by the parent view (the `← Back` chip handles cancellation at the view level, not form level).

- [ ] **Step 4: Run test, verify pass**

```bash
pnpm --filter sipher-app test -- DepositForm --run 2>&1 | tail -8
# expect: 5 tests pass
```

- [ ] **Step 5: Commit**

```bash
git add app/src/components/vault/DepositForm.tsx \
        app/src/components/vault/__tests__/DepositForm.test.tsx
git commit -m "feat(ui): DepositForm composes AmountForm + AssetSelector + TxStatusBadge"
```

## PR 6a / Task 7: `RoutePreviewCard` + `PrivacyPreviewPanel` + `StealthAddressList`

**Files:**
- Create: `app/src/components/vault/RoutePreviewCard.tsx`
- Create: `app/src/components/vault/PrivacyPreviewPanel.tsx`
- Create: `app/src/components/vault/StealthAddressList.tsx`
- Create: 3 test files mirroring each component

- [ ] **Step 1: RoutePreviewCard test**

Create `app/src/components/vault/__tests__/RoutePreviewCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RoutePreviewCard } from '../RoutePreviewCard'

describe('RoutePreviewCard', () => {
  it('renders 3 numbered steps', () => {
    render(<RoutePreviewCard wallet="C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N" amount={1.5} asset="SOL" />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders You / Vault PDA / Stealth labels', () => {
    render(<RoutePreviewCard wallet="C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N" />)
    expect(screen.getByText(/You/)).toBeInTheDocument()
    expect(screen.getByText(/Vault PDA/)).toBeInTheDocument()
    expect(screen.getByText(/Stealth/)).toBeInTheDocument()
  })

  it('renders placeholder dashes when amount is 0', () => {
    render(<RoutePreviewCard wallet="C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N" amount={0} asset="SOL" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Implement RoutePreviewCard**

Create `app/src/components/vault/RoutePreviewCard.tsx`:

```tsx
import { Card } from '../ui/Card'
import { HashCell } from '../ui/HashCell'

interface RoutePreviewCardProps {
  wallet: string
  amount?: number
  asset?: string
  stealthIndex?: number
  vaultPda?: string
}

const DEFAULT_VAULT_PDA = 'CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u' // sipher_vault devnet config PDA

export function RoutePreviewCard({
  wallet,
  amount,
  asset,
  stealthIndex,
  vaultPda = DEFAULT_VAULT_PDA,
}: RoutePreviewCardProps) {
  const amountLabel = amount && amount > 0 && asset ? `${amount} ${asset}` : '—'
  const stealthLabel = stealthIndex !== undefined ? `Stealth #${stealthIndex}` : 'Derived on deposit'

  return (
    <Card variant="default" className="p-4">
      <div
        className="text-2xs text-text-muted mb-3"
        style={{ letterSpacing: 'var(--tracking-widest)' }}
      >
        ROUTE PREVIEW
      </div>
      <div className="flex flex-col gap-2 font-mono text-xs">
        <Step n={1} label="You" detail={<HashCell address={wallet} />} />
        <div className="ml-3 text-text-muted">↓ {amountLabel}</div>
        <Step n={2} label="Vault PDA" detail={<HashCell address={vaultPda} />} />
        <div className="ml-3 text-text-muted">↓</div>
        <Step n={3} label={stealthLabel} detail={<span className="text-text-muted">{amountLabel}</span>} />
      </div>
    </Card>
  )
}

function Step({ n, label, detail }: { n: number; label: string; detail: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-5 h-5 inline-flex items-center justify-center rounded-full border border-cyan text-cyan text-2xs">
        {n}
      </span>
      <span className="text-text-secondary">{label}</span>
      <span className="ml-auto">{detail}</span>
    </div>
  )
}
```

- [ ] **Step 3: Run RoutePreviewCard test, verify pass**

```bash
pnpm --filter sipher-app test -- RoutePreviewCard --run 2>&1 | tail -8
# expect: 3 tests pass
```

- [ ] **Step 4: PrivacyPreviewPanel test**

Create `app/src/components/vault/__tests__/PrivacyPreviewPanel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PrivacyPreviewPanel } from '../PrivacyPreviewPanel'

vi.mock('../../../api/client', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('../../../hooks/useAuthState', () => ({
  useAuthState: () => ({ token: 'test-token' }),
}))

import { apiFetch } from '../../../api/client'

beforeEach(() => {
  ;(apiFetch as ReturnType<typeof vi.fn>).mockReset()
})

const fakeResponse = {
  data: {
    address: 'C1phr...85N',
    score: 68,
    grade: 'C',
    transactionsAnalyzed: 50,
    factors: {
      addressReuse: { score: 70, detail: '40 unique counterparties across 50 txs' },
      amountPatterns: { score: 80, detail: 'No round amount patterns' },
      timingCorrelation: { score: 75, detail: 'No periodic transfers' },
      counterpartyExposure: { score: 60, detail: '2 known programs' },
    },
    recommendations: [],
    projected: {
      score: 78,
      grade: 'B',
      factors: {
        addressReuse: { score: 78, detail: '41 unique counterparties' },
        amountPatterns: { score: 80, detail: 'No round patterns' },
        timingCorrelation: { score: 75, detail: 'No periodic transfers' },
        counterpartyExposure: { score: 80, detail: '2 known programs' },
      },
      delta: { score: 10, addressReuse: 8, amountPatterns: 0, timingCorrelation: 0, counterpartyExposure: 20 },
    },
  },
}

describe('PrivacyPreviewPanel', () => {
  it('renders side-by-side gauges (NOW + PROJECTED) when projected data lands', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakeResponse)
    render(<PrivacyPreviewPanel address="C1phr...85N" projectedAmount={1.5} projectedToken="SOL" debounceMs={0} />)
    await waitFor(() => {
      expect(screen.getByText(/NOW/i)).toBeInTheDocument()
      expect(screen.getByText(/PROJECTED/i)).toBeInTheDocument()
    })
    expect(screen.getByText('68')).toBeInTheDocument()
    expect(screen.getByText('78')).toBeInTheDocument()
  })

  it('renders factor delta values with sign prefix', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakeResponse)
    render(<PrivacyPreviewPanel address="C1phr...85N" projectedAmount={1.5} projectedToken="SOL" debounceMs={0} />)
    await waitFor(() => {
      expect(screen.getByText(/\+8/)).toBeInTheDocument()
      expect(screen.getByText(/\+20/)).toBeInTheDocument()
    })
  })

  it('renders empty-state copy when projectedAmount is 0', () => {
    render(<PrivacyPreviewPanel address="C1phr...85N" projectedAmount={0} projectedToken="SOL" />)
    expect(screen.getByText(/enter an amount/i)).toBeInTheDocument()
  })

  it('handles already-at-100 case with explicit copy', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        ...fakeResponse.data,
        score: 100,
        projected: { ...fakeResponse.data.projected, score: 100, delta: { score: 0, addressReuse: 0, amountPatterns: 0, timingCorrelation: 0, counterpartyExposure: 0 } },
      },
    })
    render(<PrivacyPreviewPanel address="C1phr...85N" projectedAmount={1} projectedToken="SOL" debounceMs={0} />)
    await waitFor(() => {
      expect(screen.getByText(/already at maximum/i)).toBeInTheDocument()
    })
  })

  it('handles no-history case with explicit copy', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        ...fakeResponse.data,
        transactionsAnalyzed: 0,
        projected: { ...fakeResponse.data.projected, delta: { score: 0, addressReuse: 0, amountPatterns: 0, timingCorrelation: 0, counterpartyExposure: 0 } },
      },
    })
    render(<PrivacyPreviewPanel address="C1phr...85N" projectedAmount={1} projectedToken="SOL" debounceMs={0} />)
    await waitFor(() => {
      expect(screen.getByText(/no prior history/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 5: Implement PrivacyPreviewPanel**

Create `app/src/components/vault/PrivacyPreviewPanel.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { Card } from '../ui/Card'
import { Gauge } from '../ui/Gauge'
import { apiFetch } from '../../api/client'
import { useAuthState } from '../../hooks/useAuthState'

interface FactorBlock {
  score: number
  detail: string
}

interface ProjectedBlock {
  score: number
  grade: string
  factors: Record<string, FactorBlock>
  delta: {
    score: number
    addressReuse: number
    amountPatterns: number
    timingCorrelation: number
    counterpartyExposure: number
  }
}

interface ScoreResponse {
  data: {
    address: string
    score: number
    grade: string
    transactionsAnalyzed: number
    factors: Record<string, FactorBlock>
    recommendations: string[]
    projected?: ProjectedBlock
  }
}

interface PrivacyPreviewPanelProps {
  address: string
  projectedAmount: number
  projectedToken: string
  debounceMs?: number
}

export function PrivacyPreviewPanel({
  address,
  projectedAmount,
  projectedToken,
  debounceMs = 300,
}: PrivacyPreviewPanelProps) {
  const { token } = useAuthState()
  const [data, setData] = useState<ScoreResponse['data'] | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (projectedAmount <= 0) {
      abortRef.current?.abort()
      return
    }

    timeoutRef.current = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const res = await apiFetch<ScoreResponse>('/v1/privacy/score', {
          method: 'POST',
          token,
          body: JSON.stringify({ address, projectedAmount, projectedToken, limit: 100 }),
          signal: controller.signal,
        })
        setData(res.data)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        // network errors fall through to null state
      }
    }, debounceMs)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [address, projectedAmount, projectedToken, debounceMs, token])

  if (projectedAmount <= 0) {
    return (
      <Card variant="default" className="p-4">
        <div className="text-2xs text-text-muted mb-2" style={{ letterSpacing: 'var(--tracking-widest)' }}>
          PRIVACY PREVIEW
        </div>
        <p className="text-xs text-text-muted">Enter an amount to preview projected privacy.</p>
      </Card>
    )
  }

  const projected = data?.projected

  let copy: string | null = null
  if (data && data.transactionsAnalyzed === 0) {
    copy = 'No prior history — projection is identical to current.'
  } else if (data && data.score === 100 && projected?.delta.score === 0) {
    copy = 'Already at maximum — deposit doesn\'t change score.'
  }

  return (
    <Card variant="default" className="p-4">
      <div className="text-2xs text-text-muted mb-3" style={{ letterSpacing: 'var(--tracking-widest)' }}>
        PRIVACY PREVIEW
      </div>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xs text-text-muted">NOW</span>
          <Gauge value={data?.score ?? 0} max={100} gradeLabel={data?.grade ?? '—'} ariaLabel="Current privacy score" size={80} />
        </div>
        <div className="text-cyan text-xl">→</div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xs text-cyan">PROJECTED</span>
          <Gauge value={projected?.score ?? 0} max={100} gradeLabel={projected?.grade ?? '—'} ariaLabel="Projected privacy score" size={80} />
        </div>
      </div>
      {projected && (
        <div className="grid grid-cols-2 gap-2 text-2xs">
          <DeltaLine label="Address reuse" value={projected.delta.addressReuse} />
          <DeltaLine label="Amount patterns" value={projected.delta.amountPatterns} />
          <DeltaLine label="Timing" value={projected.delta.timingCorrelation} />
          <DeltaLine label="Counterparty" value={projected.delta.counterpartyExposure} />
        </div>
      )}
      {copy && <p className="mt-3 text-xs text-text-muted">{copy}</p>}
    </Card>
  )
}

function DeltaLine({ label, value }: { label: string; value: number }) {
  const sign = value > 0 ? '+' : ''
  const colorClass = value > 0 ? 'text-green' : value < 0 ? 'text-danger' : 'text-text-muted'
  return (
    <div className="flex justify-between">
      <span className="text-text-muted">{label}</span>
      <span className={`font-mono ${colorClass}`}>{sign}{value}</span>
    </div>
  )
}
```

If `Gauge` doesn't accept a `size` prop, omit it. Verify `Gauge`'s contract — adapt as needed.

- [ ] **Step 6: Run PrivacyPreviewPanel test, verify pass**

```bash
pnpm --filter sipher-app test -- PrivacyPreviewPanel --run 2>&1 | tail -8
# expect: 5 tests pass
```

- [ ] **Step 7: StealthAddressList test**

Create `app/src/components/vault/__tests__/StealthAddressList.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StealthAddressList } from '../StealthAddressList'

const fakePosition = {
  mint: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  balance: '2500000000',
  balanceUiAmount: 2.5,
  lockedAmount: '0',
  decimals: 9,
  lastDepositAt: 1715000000,
  refundableAt: 1715086400,
  cooldownActive: true,
  depositRecordAddress: 'DEPOSITRECORDPDA',
}

const fakeNode = {
  index: 0,
  derivationPath: "m/0'",
  stealthAddress: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
  parentIndex: null,
  createdAt: '2026-05-08T00:00:00Z',
}

describe('StealthAddressList', () => {
  it('renders the Vault Positions section with one row per position', () => {
    render(<StealthAddressList positions={[fakePosition]} stealthTree={[fakeNode]} loading={false} />)
    expect(screen.getByText(/Vault Positions/i)).toBeInTheDocument()
    expect(screen.getByText('SOL')).toBeInTheDocument()
    expect(screen.getByText(/2\.5/)).toBeInTheDocument()
  })

  it('renders the Stealth Tree section with one row per node', () => {
    render(<StealthAddressList positions={[]} stealthTree={[fakeNode]} loading={false} />)
    expect(screen.getByText(/Stealth Tree/i)).toBeInTheDocument()
    expect(screen.getByText("m/0'")).toBeInTheDocument()
  })

  it('renders M19 banner when stealthTree has only the root node', () => {
    render(<StealthAddressList positions={[]} stealthTree={[fakeNode]} loading={false} />)
    expect(screen.getByText(/M19/i)).toBeInTheDocument()
  })

  it('renders empty-positions empty-state copy', () => {
    render(<StealthAddressList positions={[]} stealthTree={[]} loading={false} />)
    expect(screen.getByText(/no vault positions yet/i)).toBeInTheDocument()
  })

  it('renders loading state when loading=true', () => {
    render(<StealthAddressList positions={[]} stealthTree={[]} loading={true} />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 8: Implement StealthAddressList**

Create `app/src/components/vault/StealthAddressList.tsx`:

```tsx
import { Card } from '../ui/Card'
import { Pill } from '../ui/Pill'
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

export function StealthAddressList({ positions, stealthTree, loading }: StealthAddressListProps) {
  return (
    <div className="flex flex-col gap-4">
      <PositionsSection positions={positions} loading={loading} />
      <StealthTreeSection stealthTree={stealthTree} loading={loading} />
    </div>
  )
}

function PositionsSection({ positions, loading }: { positions: Position[]; loading: boolean }) {
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
        <p className="text-xs text-text-muted">No vault positions yet — deposit to get started.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {positions.map((p) => (
            <div
              key={p.mint}
              className="flex items-center justify-between text-xs font-mono"
            >
              <div className="flex items-center gap-2">
                <Pill variant="cyan">{p.symbol}</Pill>
                <span className="text-text">{p.balanceUiAmount}</span>
              </div>
              <Pill variant={p.cooldownActive ? 'default' : 'green'}>
                {p.cooldownActive ? 'Cooldown' : 'Refundable'}
              </Pill>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function StealthTreeSection({ stealthTree, loading }: { stealthTree: StealthNode[]; loading: boolean }) {
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
                <HashCell address={node.stealthAddress} />
              </div>
            </div>
          ))}
          {stealthTree.length === 1 && (
            <Pill variant="default" className="self-start mt-2">
              M19 — Derived stealth tree expands when M19 ships
            </Pill>
          )}
        </div>
      )}
    </Card>
  )
}
```

- [ ] **Step 9: Run StealthAddressList test, verify pass**

```bash
pnpm --filter sipher-app test -- StealthAddressList --run 2>&1 | tail -8
# expect: 5 tests pass
```

- [ ] **Step 10: Commit**

```bash
git add app/src/components/vault/RoutePreviewCard.tsx \
        app/src/components/vault/PrivacyPreviewPanel.tsx \
        app/src/components/vault/StealthAddressList.tsx \
        app/src/components/vault/__tests__/RoutePreviewCard.test.tsx \
        app/src/components/vault/__tests__/PrivacyPreviewPanel.test.tsx \
        app/src/components/vault/__tests__/StealthAddressList.test.tsx
git commit -m "feat(ui): RoutePreviewCard + PrivacyPreviewPanel + StealthAddressList"
```

## PR 6a / Task 8: `DepositView` route + nav wire-in

**Files:**
- Create: `app/src/views/DepositView.tsx`
- Create: `app/src/views/__tests__/DepositView.test.tsx`
- Modify: `app/src/stores/app.ts` (extend View type)
- Modify: `app/src/App.tsx` (add case)
- Modify: `app/src/components/Header.tsx` (extend Vault tab matcher)

- [ ] **Step 1: Extend View type**

Edit `app/src/stores/app.ts` line 4:

```ts
export type View = 'dashboard' | 'vault' | 'herald' | 'squad' | 'chat' | 'privacyReport' | 'chains' | 'deposit'
```

- [ ] **Step 2: Write the failing DepositView test**

Create `app/src/views/__tests__/DepositView.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DepositView from '../DepositView'

const setActiveView = vi.fn()

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => ({ token: 'test-token', wallet: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N' }),
}))

vi.mock('../../stores/app', async () => {
  const actual = await vi.importActual<typeof import('../../stores/app')>('../../stores/app')
  return {
    ...actual,
    useAppStore: Object.assign(
      (selector: (s: { setActiveView: typeof setActiveView }) => unknown) =>
        selector({ setActiveView }),
      { getState: () => ({ setActiveView }) }
    ),
  }
})

vi.mock('../../hooks/useTransactionSigner', () => ({
  useTransactionSigner: () => ({
    signAndBroadcast: vi.fn().mockResolvedValue({ signature: 'CONFIRMED_SIG' }),
    status: 'idle',
    setStatus: vi.fn(),
    reset: vi.fn(),
  }),
}))

vi.mock('../../lib/networkConfig', () => ({
  useNetworkConfigStore: (selector: (s: { config: { network: string } }) => unknown) =>
    selector({ config: { network: 'devnet' } }),
}))

import { apiFetch } from '../../api/client'

beforeEach(() => {
  ;(apiFetch as ReturnType<typeof vi.fn>).mockReset()
  setActiveView.mockReset()
})

describe('DepositView', () => {
  it('renders the form with AssetSelector and an amount input', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ wallet: 'C1phr...85N', balances: { sol: 5, tokens: [], status: 'ok' } }) // /api/vault
      .mockResolvedValueOnce({ positions: [], available: true, network: 'devnet' }) // /api/vault/positions

    render(<DepositView />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'SOL' })).toBeInTheDocument()
      expect(screen.getByPlaceholderText('0.0')).toBeInTheDocument()
    })
  })

  it('renders ← Back to Vault chip that calls setActiveView("vault")', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ wallet: 'C1phr...85N', balances: { sol: 5, tokens: [], status: 'ok' } })
      .mockResolvedValueOnce({ positions: [], available: true, network: 'devnet' })

    render(<DepositView />)
    await waitFor(() => {
      const back = screen.getByRole('button', { name: /back to vault/i })
      fireEvent.click(back)
      expect(setActiveView).toHaveBeenCalledWith('vault')
    })
  })

  it('renders disabled state and banner copy when network is mainnet', async () => {
    vi.doMock('../../lib/networkConfig', () => ({
      useNetworkConfigStore: (selector: (s: { config: { network: string } }) => unknown) =>
        selector({ config: { network: 'mainnet' } }),
    }))
    ;(apiFetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ wallet: 'C1phr...85N', balances: { sol: 5, tokens: [], status: 'ok' } })
      .mockResolvedValueOnce({ positions: [], available: false, reason: 'mainnet-beta_no_vault', network: 'mainnet-beta' })

    const Reloaded = (await import('../DepositView')).default
    render(<Reloaded />)
    await waitFor(() => {
      expect(screen.getByText(/devnet only/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 3: Run test, verify it fails**

```bash
pnpm --filter sipher-app test -- DepositView --run 2>&1 | tail -10
# expect: FAIL — module not found
```

- [ ] **Step 4: Implement DepositView**

Create `app/src/views/DepositView.tsx`:

```tsx
import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft } from '@phosphor-icons/react'
import { apiFetch } from '../api/client'
import { useAuthState } from '../hooks/useAuthState'
import { useAppStore } from '../stores/app'
import { useTransactionSigner } from '../hooks/useTransactionSigner'
import { useNetworkConfigStore } from '../lib/networkConfig'
import { DepositForm } from '../components/vault/DepositForm'
import { RoutePreviewCard } from '../components/vault/RoutePreviewCard'
import { PrivacyPreviewPanel } from '../components/vault/PrivacyPreviewPanel'
import { Card } from '../components/ui/Card'

interface VaultData {
  wallet: string
  balances: { sol: number; tokens: { mint: string; symbol: string; uiAmount: number }[]; status: string }
}

interface PositionsResponse {
  positions: { mint: string; symbol: string; balanceUiAmount: number }[]
  available: boolean
  reason?: string
  network: string
}

const DEPOSIT_SUCCESS_REDIRECT_MS = 2000

export default function DepositView() {
  const { token } = useAuthState()
  const setActiveView = useAppStore((s) => s.setActiveView)
  const network = useNetworkConfigStore((s) => s.config?.network ?? '')
  const isMainnet = network === 'mainnet'

  const [vaultData, setVaultData] = useState<VaultData | null>(null)
  const [pendingAmount, setPendingAmount] = useState(0)
  const [pendingAsset, setPendingAsset] = useState('SOL')
  const [error, setError] = useState<string | null>(null)

  const { signAndBroadcast, status, reset } = useTransactionSigner()
  const [signature, setSignature] = useState<string | undefined>()

  useEffect(() => {
    if (!token) return
    apiFetch<VaultData>('/api/vault', { token }).then(setVaultData).catch(() => null)
    // /api/vault/positions is fetched here only to verify availability; positions list lives on VaultView
    apiFetch<PositionsResponse>('/api/vault/positions', { token }).catch(() => null)
  }, [token])

  const maxByAsset: Record<string, number> = {
    SOL: vaultData?.balances.sol ?? 0,
    USDC: vaultData?.balances.tokens.find((t) => t.symbol === 'USDC')?.uiAmount ?? 0,
    USDT: vaultData?.balances.tokens.find((t) => t.symbol === 'USDT')?.uiAmount ?? 0,
  }

  const handleSubmit = useCallback(
    async (amount: number, asset: string) => {
      setError(null)
      setPendingAmount(amount)
      setPendingAsset(asset)
      try {
        const { serializedTx } = await apiFetch<{ serializedTx: string }>('/api/vault/deposit-tx', {
          method: 'POST',
          token,
          body: JSON.stringify({ amount, token: asset }),
        })
        const result = await signAndBroadcast(serializedTx)
        if (result.error) {
          setError(result.error)
          return
        }
        setSignature(result.signature)
        setTimeout(() => setActiveView('vault'), DEPOSIT_SUCCESS_REDIRECT_MS)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    },
    [signAndBroadcast, token, setActiveView]
  )

  if (isMainnet) {
    return (
      <div className="flex flex-col gap-4 max-w-3xl mx-auto">
        <BackChip onClick={() => setActiveView('vault')} />
        <Card variant="default" className="p-6">
          <p className="text-sm text-text">
            Sipher Vault is on devnet only — switch network to deposit/withdraw.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto">
      <BackChip onClick={() => setActiveView('vault')} />
      <h1 className="text-2xl font-semibold">Shield to vault</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3">
          <DepositForm
            onSubmit={handleSubmit}
            maxByAsset={maxByAsset}
            disabled={status === 'signing' || status === 'broadcasting'}
            status={status}
            signature={signature}
          />
          {error && (
            <Card variant="default" className="p-3 border-danger">
              <p className="text-xs text-danger mb-2">{error}</p>
              <button
                type="button"
                onClick={() => { reset(); setError(null) }}
                className="text-xs underline"
              >
                Try again
              </button>
            </Card>
          )}
          <RoutePreviewCard
            wallet={vaultData?.wallet ?? ''}
            amount={pendingAmount}
            asset={pendingAsset}
          />
        </div>
        <PrivacyPreviewPanel
          address={vaultData?.wallet ?? ''}
          projectedAmount={pendingAmount}
          projectedToken={pendingAsset}
        />
      </div>
    </div>
  )
}

function BackChip({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start flex items-center gap-1 text-xs text-text-secondary border border-line rounded-md px-2 py-1 hover:border-line-2 hover:text-text"
    >
      <ArrowLeft size={12} /> Back to Vault
    </button>
  )
}
```

- [ ] **Step 5: Wire DepositView into App.tsx**

Edit `app/src/App.tsx`. Add the import alongside other view imports:

```ts
import DepositView from './views/DepositView'
```

Add the case in `renderView` (right after `chains`):

```ts
case 'deposit':
  return <DepositView />
```

- [ ] **Step 6: Extend Header Vault tab matcher**

Edit `app/src/components/Header.tsx`. Find the section that determines whether the Vault tab is "active" (likely a comparison `activeView === 'vault'`). Replace with:

```tsx
const isVaultActive = ['vault', 'deposit', 'withdraw'].includes(activeView)
// ...
<button className={isVaultActive ? activeClass : inactiveClass} ...>
```

If BottomNav has the same pattern, mirror it. Search both files for `activeView === 'vault'`.

- [ ] **Step 7: Run DepositView test, verify pass**

```bash
pnpm --filter sipher-app test -- DepositView --run 2>&1 | tail -10
# expect: 3 tests pass
```

- [ ] **Step 8: Commit**

```bash
git add app/src/views/DepositView.tsx \
        app/src/views/__tests__/DepositView.test.tsx \
        app/src/stores/app.ts \
        app/src/App.tsx \
        app/src/components/Header.tsx
git commit -m "feat(redesign): DepositView route + nav wire-in"
```

## PR 6a / Task 9: VaultView split-panel restyle + BetaBanner extension

**Files:**
- Modify: `app/src/views/VaultView.tsx`
- Modify: `app/src/views/__tests__/VaultView.test.tsx` (or `VaultView-actions.test.tsx`)
- Modify: `app/src/components/BetaBanner.tsx`

- [ ] **Step 1: Read current VaultView and BetaBanner**

```bash
wc -l app/src/views/VaultView.tsx app/src/components/BetaBanner.tsx
```

VaultView is 242 lines; BetaBanner ~50 lines.

- [ ] **Step 2: Rewrite VaultView for split-panel**

Replace the entire body of `app/src/views/VaultView.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { ArrowDownLeft, MaskHappy } from '@phosphor-icons/react'
import { apiFetch } from '../api/client'
import { useAuthState } from '../hooks/useAuthState'
import { useAppStore } from '../stores/app'
import { useNetworkConfigStore } from '../lib/networkConfig'
import { Card } from '../components/ui/Card'
import { Pill } from '../components/ui/Pill'
import { HashCell } from '../components/ui/HashCell'
import { StealthAddressList, type Position, type StealthNode } from '../components/vault/StealthAddressList'
import { RoutePreviewCard } from '../components/vault/RoutePreviewCard'

interface VaultData {
  wallet: string
  network: string
  balances: { sol: number; tokens: { mint: string; symbol: string; uiAmount: number; decimals: number; amount: string }[]; status: string }
}

interface PositionsResponse {
  positions: Position[]
  available: boolean
  reason?: string
  network: string
}

interface StealthIndexResponse {
  tree: StealthNode[]
  rootWallet: string
}

export default function VaultView() {
  const { token } = useAuthState()
  const setActiveView = useAppStore((s) => s.setActiveView)
  const network = useNetworkConfigStore((s) => s.config?.network ?? '')
  const isMainnet = network === 'mainnet'

  const [vault, setVault] = useState<VaultData | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [stealthTree, setStealthTree] = useState<StealthNode[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    Promise.all([
      apiFetch<VaultData>('/api/vault', { token }).then(setVault).catch(() => null),
      apiFetch<PositionsResponse>('/api/vault/positions', { token })
        .then((r) => setPositions(r.positions))
        .catch(() => null),
      apiFetch<StealthIndexResponse>('/api/stealth/index', { token })
        .then((r) => setStealthTree(r.tree))
        .catch(() => null),
    ]).finally(() => setLoading(false))
  }, [token])

  return (
    <div data-testid="vault-view" className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ShieldedVaultPanel
        positions={positions}
        stealthTree={stealthTree}
        loading={loading}
        onWithdraw={() => setActiveView('withdraw')}
        disabled={isMainnet}
      />
      <UnshieldedWalletPanel
        wallet={vault?.wallet ?? ''}
        sol={vault?.balances.sol ?? 0}
        onDeposit={() => setActiveView('deposit')}
        disabled={isMainnet}
      />
    </div>
  )
}

function ShieldedVaultPanel({
  positions,
  stealthTree,
  loading,
  onWithdraw,
  disabled,
}: {
  positions: Position[]
  stealthTree: StealthNode[]
  loading: boolean
  onWithdraw: () => void
  disabled: boolean
}) {
  const totalSol = positions.find((p) => p.symbol === 'SOL')?.balanceUiAmount ?? 0
  return (
    <Card variant="default" className="p-5 flex flex-col gap-4">
      <div
        className="text-2xs text-text-muted"
        style={{ letterSpacing: 'var(--tracking-widest)' }}
      >
        ◆ SHIELDED VAULT
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-mono">{totalSol}</span>
        <span className="text-sm text-text-muted">SOL</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Pill variant="cyan">{positions.length} positions</Pill>
        <Pill variant={positions.length > 0 ? 'green' : 'default'}>
          {positions.length > 0 ? 'Active' : 'Empty'}
        </Pill>
      </div>
      <StealthAddressList positions={positions} stealthTree={stealthTree} loading={loading} />
      <button
        type="button"
        onClick={onWithdraw}
        disabled={disabled || positions.length === 0}
        className="self-start border border-line rounded-md px-3 py-1.5 text-xs hover:border-line-2 disabled:opacity-40 disabled:cursor-not-allowed"
        title={disabled ? 'Devnet only — switch network' : ''}
      >
        Withdraw
      </button>
    </Card>
  )
}

function UnshieldedWalletPanel({
  wallet,
  sol,
  onDeposit,
  disabled,
}: {
  wallet: string
  sol: number
  onDeposit: () => void
  disabled: boolean
}) {
  return (
    <Card variant="default" className="p-5 flex flex-col gap-4">
      <div
        className="text-2xs text-text-muted"
        style={{ letterSpacing: 'var(--tracking-widest)' }}
      >
        ○ UNSHIELDED WALLET
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-mono">{sol}</span>
        <span className="text-sm text-text-muted">SOL</span>
      </div>
      {wallet && <HashCell address={wallet} />}
      <RoutePreviewCard wallet={wallet} />
      <button
        type="button"
        onClick={onDeposit}
        disabled={disabled || sol <= 0}
        className="self-start text-xs px-3 py-1.5 rounded-md text-bg font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: 'linear-gradient(90deg, var(--color-cyan), var(--color-violet))' }}
        title={disabled ? 'Devnet only — switch network' : ''}
      >
        Shield to vault
      </button>
    </Card>
  )
}
```

- [ ] **Step 3: Update VaultView tests**

Edit `app/src/views/__tests__/VaultView.test.tsx` (or migrate `VaultView-actions.test.tsx` if that's where tests live). Drop tests for the old inline AmountForm/ConfirmCard flow; add tests for the new split-panel:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import VaultView from '../VaultView'

const setActiveView = vi.fn()

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => ({ token: 'test-token' }),
}))

vi.mock('../../stores/app', async () => {
  const actual = await vi.importActual<typeof import('../../stores/app')>('../../stores/app')
  return {
    ...actual,
    useAppStore: (selector: (s: { setActiveView: typeof setActiveView }) => unknown) =>
      selector({ setActiveView }),
  }
})

vi.mock('../../lib/networkConfig', () => ({
  useNetworkConfigStore: (selector: (s: { config: { network: string } }) => unknown) =>
    selector({ config: { network: 'devnet' } }),
}))

import { apiFetch } from '../../api/client'

const mockedFetch = apiFetch as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockedFetch.mockReset()
  setActiveView.mockReset()
})

const fakeVault = { wallet: 'C1phr...85N', network: 'devnet', balances: { sol: 5, tokens: [], status: 'ok' } }
const fakePositions = { positions: [], available: true, network: 'devnet' }
const fakeTree = { tree: [{ index: 0, derivationPath: "m/0'", stealthAddress: 'C1phr...85N', parentIndex: null, createdAt: '2026-05-08' }], rootWallet: 'C1phr...85N' }

describe('VaultView (split-panel)', () => {
  it('fires three parallel fetches on mount', async () => {
    mockedFetch.mockImplementation((path: string) => {
      if (path === '/api/vault') return Promise.resolve(fakeVault)
      if (path === '/api/vault/positions') return Promise.resolve(fakePositions)
      if (path === '/api/stealth/index') return Promise.resolve(fakeTree)
      return Promise.reject(new Error('unexpected path: ' + path))
    })

    render(<VaultView />)
    await waitFor(() => {
      expect(mockedFetch).toHaveBeenCalledWith('/api/vault', expect.anything())
      expect(mockedFetch).toHaveBeenCalledWith('/api/vault/positions', expect.anything())
      expect(mockedFetch).toHaveBeenCalledWith('/api/stealth/index', expect.anything())
    })
  })

  it('renders ShieldedVault and UnshieldedWallet panels', async () => {
    mockedFetch.mockImplementation((path: string) => {
      if (path === '/api/vault') return Promise.resolve(fakeVault)
      if (path === '/api/vault/positions') return Promise.resolve(fakePositions)
      if (path === '/api/stealth/index') return Promise.resolve(fakeTree)
      return Promise.reject(new Error('unexpected'))
    })
    render(<VaultView />)
    await waitFor(() => {
      expect(screen.getByText(/SHIELDED VAULT/)).toBeInTheDocument()
      expect(screen.getByText(/UNSHIELDED WALLET/)).toBeInTheDocument()
    })
  })

  it('Shield to vault CTA routes to deposit view', async () => {
    mockedFetch.mockImplementation((path: string) => {
      if (path === '/api/vault') return Promise.resolve(fakeVault)
      if (path === '/api/vault/positions') return Promise.resolve(fakePositions)
      if (path === '/api/stealth/index') return Promise.resolve(fakeTree)
      return Promise.reject(new Error('unexpected'))
    })
    render(<VaultView />)
    await waitFor(() => {
      const cta = screen.getByRole('button', { name: /shield to vault/i })
      fireEvent.click(cta)
      expect(setActiveView).toHaveBeenCalledWith('deposit')
    })
  })

  it('Withdraw CTA disabled when no positions', async () => {
    mockedFetch.mockImplementation((path: string) => {
      if (path === '/api/vault') return Promise.resolve(fakeVault)
      if (path === '/api/vault/positions') return Promise.resolve(fakePositions)
      if (path === '/api/stealth/index') return Promise.resolve(fakeTree)
      return Promise.reject(new Error('unexpected'))
    })
    render(<VaultView />)
    await waitFor(() => {
      const withdrawBtn = screen.getByRole('button', { name: /withdraw/i })
      expect(withdrawBtn).toBeDisabled()
    })
  })
})
```

- [ ] **Step 4: Extend BetaBanner**

Edit `app/src/components/BetaBanner.tsx`. Add a new condition that surfaces a vault-specific banner when the active view is `vault`/`deposit`/`withdraw` AND network is mainnet (FE store uses `'mainnet' | 'devnet'`, NOT `'mainnet-beta'` — that string is only used in the backend's `clusterName`). Read the current BetaBanner first; add the conditional copy without disturbing existing beta logic:

```tsx
import { useAppStore } from '../stores/app'
import { useNetworkConfigStore } from '../lib/networkConfig'

interface BetaBannerProps { beta: boolean }

const VAULT_VIEWS = new Set(['vault', 'deposit', 'withdraw'])

export function BetaBanner({ beta }: BetaBannerProps) {
  const activeView = useAppStore((s) => s.activeView)
  const network = useNetworkConfigStore((s) => s.config?.network ?? '')

  const showVaultDevnetBanner = VAULT_VIEWS.has(activeView) && network === 'mainnet'

  if (showVaultDevnetBanner) {
    return (
      <div className="bg-bg-2 border-b border-amber/40 text-amber text-xs px-4 py-1.5 text-center">
        Sipher Vault is on devnet only — switch network to deposit/withdraw.
      </div>
    )
  }

  if (!beta) return null

  return (
    <div className="bg-bg-2 border-b border-line text-text-muted text-xs px-4 py-1 text-center">
      Beta — open feedback welcome
    </div>
  )
}
```

(Adapt the existing copy if the current BetaBanner displays different text.)

- [ ] **Step 5: Run the relevant test suites**

```bash
pnpm --filter sipher-app test -- VaultView --run 2>&1 | tail -10
pnpm --filter sipher-app test -- BetaBanner --run 2>&1 | tail -10
# expect both to pass
```

- [ ] **Step 6: Run full app test suite**

```bash
pnpm --filter sipher-app test --run 2>&1 | tail -8
# expect: ~282 passing (237 baseline + ~45 new), 0 failing
```

- [ ] **Step 7: Commit**

```bash
git add app/src/views/VaultView.tsx \
        app/src/views/__tests__/VaultView.test.tsx \
        app/src/views/__tests__/VaultView-actions.test.tsx \
        app/src/components/BetaBanner.tsx
git commit -m "feat(redesign): VaultView split-panel + BetaBanner devnet-only extension"
```

## PR 6a / Task 10: Manual smoke + open PR

- [ ] **Step 1: Build and serve locally**

```bash
pnpm --filter sipher-app build
cd .worktrees/feat-redesign-vault-flows-deposit
# Run agent + frontend together, verify deposit on devnet
```

- [ ] **Step 2: Devnet smoke test**

From the running app:
1. Connect Phantom wallet on devnet
2. Authenticate (sign-in flow)
3. Navigate to /vault — confirm split-panel renders
4. Click "Shield to vault" — confirm DepositView loads
5. Type 0.01 SOL, click Sign & deposit
6. Confirm Phantom popup → approve
7. Watch TxStatusBadge: signing → broadcasting → confirmed
8. Confirm auto-redirect to /vault after 2s
9. Confirm new position appears in ShieldedVault panel
10. Capture screenshots for PR description

- [ ] **Step 3: Push branch and open PR**

```bash
git push -u origin feat/redesign-vault-flows-deposit
gh pr create --title "feat(redesign): PR 6a — Vault split-panel + DepositView with real signing" --body "$(cat <<'EOF'
## Summary
- VaultView restyled as glass-neon split-panel (ShieldedVault left, UnshieldedWallet right)
- New full-page DepositView with real on-chain signing via existing useTransactionSigner
- Three new backend routes: POST /api/vault/deposit-tx, GET /api/vault/positions, extended POST /v1/privacy/score
- Hybrid StealthAddressList — vault positions (real, by mint) + stealth tree (stub from /api/stealth/index)
- PrivacyPreviewPanel with honest projected math (synthetic-tx re-run)
- Mainnet path renders BetaBanner extension + disabled CTAs

## Test plan
- [ ] App tests pass (~282)
- [ ] Agent tests pass (~1,374)
- [ ] Manual smoke deposit on devnet (screenshot below)
- [ ] Vercel preview renders new vault surface
- [ ] Mainnet path: BetaBanner banner visible, CTAs disabled

## Spec
docs/superpowers/specs/2026-05-08-pr6-vault-flows-design.md (commit 74cb083)

## Out of scope
PR 6b (refund flow) ships separately.

## Smoke screenshots
[paste devnet deposit screenshots]
EOF
)"
```

- [ ] **Step 4: Wait for CI green, address feedback if any**

Vercel preview deploys on push (~30-60s). Click through Deposit on the preview to verify behavior. Address review feedback inline; never amend — new commits per change.

- [ ] **Step 5: Merge with `--merge --delete-branch`**

```bash
gh pr merge --merge --delete-branch
```

After merge, sync local main + clean worktree:

```bash
cd ~/local-dev/sipher
git checkout main
git pull origin main
git worktree remove .worktrees/feat-redesign-vault-flows-deposit
git branch -d feat/redesign-vault-flows-deposit
```

---

# PR 6b — `feat/redesign-vault-flows-withdraw`

**Branch:** `feat/redesign-vault-flows-withdraw` · **Worktree:** `.worktrees/feat-redesign-vault-flows-withdraw/`
**Goal:** WithdrawView with per-mint refund rows + cooldown chip + real on-chain refund signing.
**Acceptance:** Manual smoke refund on devnet succeeds (after 24h cooldown elapsed); tests +18 app, +8 agent.

## PR 6b / Task 1: Worktree + verify deps

- [ ] **Step 1: Create worktree from main (after PR 6a merged)**

```bash
cd ~/local-dev/sipher
git pull origin main   # pull PR 6a merge
git worktree add -b feat/redesign-vault-flows-withdraw \
  .worktrees/feat-redesign-vault-flows-withdraw main
cd .worktrees/feat-redesign-vault-flows-withdraw
pnpm install
pnpm --filter "@sipher/sdk" build
```

- [ ] **Step 2: Confirm 6a surfaces are present**

```bash
test -f app/src/views/DepositView.tsx && echo "6a deposit view ok"
test -f app/src/components/vault/StealthAddressList.tsx && echo "6a list ok"
test -f packages/agent/src/routes/vault-positions.ts && echo "6a positions ok"
```

## PR 6b / Task 2: Backend `POST /api/vault/refund-tx`

**Files:**
- Create: `packages/agent/src/routes/vault-refund-tx.ts`
- Create: `packages/agent/tests/routes/vault-refund-tx.test.ts`
- Modify: `packages/agent/src/index.ts`

- [ ] **Step 1: Write the failing test first**

Create `packages/agent/tests/routes/vault-refund-tx.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import express, { type Request, type Response, type NextFunction } from 'express'
import supertest from 'supertest'
import { PublicKey, Transaction } from '@solana/web3.js'

const TEST_WALLET = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'

vi.mock('../../src/config/network.js', () => ({
  loadNetworkConfig: vi.fn(() => ({ clusterName: 'devnet' })),
}))

vi.mock('@sipher/sdk', async () => {
  const actual = await vi.importActual<typeof import('@sipher/sdk')>('@sipher/sdk')
  return {
    ...actual,
    fetchDepositRecord: vi.fn(),
    buildRefundTx: vi.fn(),
    createConnection: vi.fn(() => ({})),
  }
})

import { fetchDepositRecord, buildRefundTx } from '@sipher/sdk'
import { loadNetworkConfig } from '../../src/config/network.js'
import { vaultRefundTxRouter } from '../../src/routes/vault-refund-tx.js'

function mockAuth(wallet: string | null) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (wallet) (req as unknown as { wallet: string }).wallet = wallet
    next()
  }
}

function createApp(wallet: string | null = TEST_WALLET) {
  const app = express()
  app.use(express.json())
  app.use('/api/vault', mockAuth(wallet), vaultRefundTxRouter)
  return app
}

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const NOW_SECONDS = 1715200000

beforeEach(() => {
  vi.mocked(fetchDepositRecord).mockReset()
  vi.mocked(buildRefundTx).mockReset()
  vi.mocked(loadNetworkConfig).mockReturnValue({ clusterName: 'devnet' } as ReturnType<typeof loadNetworkConfig>)
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW_SECONDS * 1000))
})

describe('POST /api/vault/refund-tx', () => {
  it('returns serializedTx + refundAmount when balance > 0 and cooldown elapsed', async () => {
    vi.mocked(fetchDepositRecord).mockResolvedValueOnce({
      depositor: new PublicKey(TEST_WALLET),
      tokenMint: new PublicKey(SOL_MINT),
      balance: 1_000_000_000n,
      lockedAmount: 0n,
      totalDeposits: 1n,
      lastDepositAt: BigInt(NOW_SECONDS - 100_000), // > 24h ago
    })
    const tx = new Transaction()
    vi.mocked(buildRefundTx).mockResolvedValueOnce({
      transaction: tx,
      depositRecordAddress: new PublicKey('11111111111111111111111111111111'),
      vaultTokenAddress: new PublicKey('11111111111111111111111111111111'),
      refundAmount: 1_000_000_000n,
    } as unknown as Awaited<ReturnType<typeof buildRefundTx>>)

    const res = await supertest(createApp())
      .post('/api/vault/refund-tx')
      .send({ token: 'SOL' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      refundAmount: '1000000000',
      network: 'devnet',
    })
    expect(typeof res.body.serializedTx).toBe('string')
  })

  it('returns 404 NOT_FOUND when no deposit record exists', async () => {
    vi.mocked(fetchDepositRecord).mockResolvedValueOnce(null)

    const res = await supertest(createApp())
      .post('/api/vault/refund-tx')
      .send({ token: 'SOL' })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('returns 404 NOT_FOUND when balance is zero', async () => {
    vi.mocked(fetchDepositRecord).mockResolvedValueOnce({
      depositor: new PublicKey(TEST_WALLET),
      tokenMint: new PublicKey(SOL_MINT),
      balance: 0n,
      lockedAmount: 0n,
      totalDeposits: 0n,
      lastDepositAt: 0n,
    })

    const res = await supertest(createApp())
      .post('/api/vault/refund-tx')
      .send({ token: 'SOL' })

    expect(res.status).toBe(404)
  })

  it('returns 409 COOLDOWN_ACTIVE with secondsRemaining when within 24h window', async () => {
    vi.mocked(fetchDepositRecord).mockResolvedValueOnce({
      depositor: new PublicKey(TEST_WALLET),
      tokenMint: new PublicKey(SOL_MINT),
      balance: 1_000_000_000n,
      lockedAmount: 0n,
      totalDeposits: 1n,
      lastDepositAt: BigInt(NOW_SECONDS - 1000), // < 24h ago
    })

    const res = await supertest(createApp())
      .post('/api/vault/refund-tx')
      .send({ token: 'SOL' })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('COOLDOWN_ACTIVE')
    expect(res.body.error.secondsRemaining).toBeGreaterThan(0)
  })

  it('returns 401 envelope when JWT did not attach req.wallet', async () => {
    const res = await supertest(createApp(null))
      .post('/api/vault/refund-tx')
      .send({ token: 'SOL' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 409 VAULT_UNAVAILABLE on mainnet-beta', async () => {
    vi.mocked(loadNetworkConfig).mockReturnValueOnce({ clusterName: 'mainnet-beta' } as ReturnType<typeof loadNetworkConfig>)

    const res = await supertest(createApp())
      .post('/api/vault/refund-tx')
      .send({ token: 'SOL' })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('VAULT_UNAVAILABLE')
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm --filter @sipher/agent test -- vault-refund-tx --run 2>&1 | tail -10
# expect: FAIL — module not found
```

- [ ] **Step 3: Implement the route**

Create `packages/agent/src/routes/vault-refund-tx.ts`:

```ts
import { Router, type Request, type Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import {
  WSOL_MINT,
  USDC_MINT,
  USDT_MINT,
  fetchDepositRecord,
  buildRefundTx,
  createConnection,
  resolveTokenMint,
} from '@sipher/sdk'
import { loadNetworkConfig } from '../config/network.js'

const REFUND_TIMEOUT_SECONDS = 86400
const VALID_TOKENS = ['SOL', 'USDC', 'USDT']

export const vaultRefundTxRouter = Router()

vaultRefundTxRouter.post('/refund-tx', async (req: Request, res: Response) => {
  const wallet = req.wallet
  if (!wallet) {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Authenticated wallet required' },
    })
    return
  }

  const network = loadNetworkConfig().clusterName
  if (network !== 'devnet') {
    res.status(409).json({
      error: {
        code: 'VAULT_UNAVAILABLE',
        message: 'Sipher Vault is on devnet only',
      },
    })
    return
  }

  const { token } = req.body as { token?: string }
  if (typeof token !== 'string' || !VALID_TOKENS.includes(token.toUpperCase())) {
    res.status(400).json({
      error: { code: 'INVALID_TOKEN', message: 'Token must be SOL, USDC, or USDT' },
    })
    return
  }

  let depositor: PublicKey
  try {
    depositor = new PublicKey(wallet)
  } catch {
    res.status(400).json({
      error: { code: 'INVALID_WALLET', message: 'Wallet is not a valid base58 pubkey' },
    })
    return
  }

  const tokenMint = resolveTokenMint(token.toUpperCase())
  const connection = createConnection(network)

  let record
  try {
    record = await fetchDepositRecord(connection, depositor, tokenMint)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    res.status(500).json({ error: { code: 'INTERNAL', message } })
    return
  }

  if (!record || record.balance === 0n) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'No deposit found for this token' },
    })
    return
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const lastDepositAt = Number(record.lastDepositAt)
  const refundableAt = lastDepositAt + REFUND_TIMEOUT_SECONDS
  if (nowSeconds < refundableAt) {
    res.status(409).json({
      error: {
        code: 'COOLDOWN_ACTIVE',
        message: 'Refund cooldown not yet elapsed',
        secondsRemaining: refundableAt - nowSeconds,
      },
    })
    return
  }

  try {
    const depositorTokenAccount = await getAssociatedTokenAddress(tokenMint, depositor)
    const result = await buildRefundTx(connection, depositor, tokenMint, depositorTokenAccount)
    const serializedTx = result.transaction
      .serialize({ requireAllSignatures: false })
      .toString('base64')
    res.json({
      serializedTx,
      refundAmount: result.refundAmount.toString(),
      network,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    res.status(500).json({ error: { code: 'INTERNAL', message } })
  }
})
```

- [ ] **Step 4: Run test, verify pass**

```bash
pnpm --filter @sipher/agent test -- vault-refund-tx --run 2>&1 | tail -10
# expect: 6 tests passing
```

- [ ] **Step 5: Mount route in `packages/agent/src/index.ts`**

Add below the deposit-tx + positions mounts:

```ts
// Vault refund-tx builder — JWT required (PR 6b)
app.use('/api/vault', verifyJwt, vaultRefundTxRouter)
```

Import at top:

```ts
import { vaultRefundTxRouter } from './routes/vault-refund-tx.js'
```

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/routes/vault-refund-tx.ts \
        packages/agent/tests/routes/vault-refund-tx.test.ts \
        packages/agent/src/index.ts
git commit -m "feat(agent): POST /api/vault/refund-tx — REST adapter for refund tx builder"
```

## PR 6b / Task 3: `CooldownChip` component

**Files:**
- Create: `app/src/components/vault/CooldownChip.tsx`
- Create: `app/src/components/vault/__tests__/CooldownChip.test.tsx`

- [ ] **Step 1: Write the failing test first**

Create `app/src/components/vault/__tests__/CooldownChip.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { CooldownChip } from '../CooldownChip'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-08T00:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CooldownChip', () => {
  it('renders Available now when refundableAt is in the past', () => {
    const past = Math.floor(Date.now() / 1000) - 60
    render(<CooldownChip refundableAt={past} />)
    expect(screen.getByText(/available now/i)).toBeInTheDocument()
  })

  it('renders countdown copy in mm:ss when within 1h', () => {
    const future = Math.floor(Date.now() / 1000) + 600 // 10 minutes
    render(<CooldownChip refundableAt={future} />)
    expect(screen.getByText(/10:00|10m/i)).toBeInTheDocument()
  })

  it('renders countdown copy in Xh Ym when ≥1h', () => {
    const future = Math.floor(Date.now() / 1000) + 5 * 3600 // 5 hours
    render(<CooldownChip refundableAt={future} />)
    expect(screen.getByText(/5h/)).toBeInTheDocument()
  })

  it('flips to Available now when timer ticks past zero', () => {
    const future = Math.floor(Date.now() / 1000) + 2
    const onElapsed = vi.fn()
    render(<CooldownChip refundableAt={future} onElapsed={onElapsed} />)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByText(/available now/i)).toBeInTheDocument()
    expect(onElapsed).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Implement CooldownChip**

Create `app/src/components/vault/CooldownChip.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Pill } from '../ui/Pill'

interface CooldownChipProps {
  refundableAt: number // unix seconds
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
    <Pill variant={elapsed ? 'green' : 'default'}>
      {formatRemaining(remaining)}
    </Pill>
  )
}
```

- [ ] **Step 3: Run test, verify pass**

```bash
pnpm --filter sipher-app test -- CooldownChip --run 2>&1 | tail -8
# expect: 4 tests pass
```

- [ ] **Step 4: Commit**

```bash
git add app/src/components/vault/CooldownChip.tsx \
        app/src/components/vault/__tests__/CooldownChip.test.tsx
git commit -m "feat(ui): CooldownChip self-ticking countdown for vault refund window"
```

## PR 6b / Task 4: `RefundList` component

**Files:**
- Create: `app/src/components/vault/RefundList.tsx`
- Create: `app/src/components/vault/__tests__/RefundList.test.tsx`

- [ ] **Step 1: Write the failing test first**

Create `app/src/components/vault/__tests__/RefundList.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RefundList } from '../RefundList'

const fakePosition = {
  mint: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  balance: '2500000000',
  balanceUiAmount: 2.5,
  lockedAmount: '0',
  decimals: 9,
  lastDepositAt: 1715000000,
  refundableAt: 1715086400,
  cooldownActive: false,
  depositRecordAddress: 'DEPOSITRECORDPDA',
}

describe('RefundList', () => {
  it('renders a row per record with mint + balance + Refund button', () => {
    render(
      <RefundList
        records={[fakePosition]}
        onRefund={vi.fn()}
        statusByToken={{}}
        signaturesByToken={{}}
      />
    )
    expect(screen.getByText('SOL')).toBeInTheDocument()
    expect(screen.getByText(/2\.5/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refund/i })).toBeInTheDocument()
  })

  it('disables Refund when cooldownActive', () => {
    render(
      <RefundList
        records={[{ ...fakePosition, cooldownActive: true }]}
        onRefund={vi.fn()}
        statusByToken={{}}
        signaturesByToken={{}}
      />
    )
    expect(screen.getByRole('button', { name: /refund/i })).toBeDisabled()
  })

  it('calls onRefund(token) when Refund clicked', () => {
    const onRefund = vi.fn()
    render(
      <RefundList
        records={[fakePosition]}
        onRefund={onRefund}
        statusByToken={{}}
        signaturesByToken={{}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /refund/i }))
    expect(onRefund).toHaveBeenCalledWith('SOL')
  })

  it('renders empty-state copy when records is empty', () => {
    render(
      <RefundList
        records={[]}
        onRefund={vi.fn()}
        statusByToken={{}}
        signaturesByToken={{}}
      />
    )
    expect(screen.getByText(/no active vault positions/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Implement RefundList**

Create `app/src/components/vault/RefundList.tsx`:

```tsx
import { Card } from '../ui/Card'
import { Pill } from '../ui/Pill'
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

export function RefundList({
  records,
  onRefund,
  statusByToken,
  signaturesByToken,
}: RefundListProps) {
  if (records.length === 0) {
    return (
      <Card variant="default" className="p-6">
        <p className="text-sm text-text-muted">
          No active vault positions to refund.
        </p>
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
          <Card key={p.mint} variant="default" className="p-4 flex items-center gap-3">
            <Pill variant="cyan">{p.symbol}</Pill>
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

- [ ] **Step 3: Run test, verify pass**

```bash
pnpm --filter sipher-app test -- RefundList --run 2>&1 | tail -8
# expect: 4 tests pass
```

- [ ] **Step 4: Commit**

```bash
git add app/src/components/vault/RefundList.tsx \
        app/src/components/vault/__tests__/RefundList.test.tsx
git commit -m "feat(ui): RefundList per-record vault refund flow"
```

## PR 6b / Task 5: `WithdrawView` route + nav wire-in

**Files:**
- Create: `app/src/views/WithdrawView.tsx`
- Create: `app/src/views/__tests__/WithdrawView.test.tsx`
- Modify: `app/src/stores/app.ts`
- Modify: `app/src/App.tsx`
- Modify: `app/src/components/Header.tsx` (already extended in 6a — verify)

- [ ] **Step 1: Extend View type**

Edit `app/src/stores/app.ts` line 4:

```ts
export type View = 'dashboard' | 'vault' | 'herald' | 'squad' | 'chat' | 'privacyReport' | 'chains' | 'deposit' | 'withdraw'
```

- [ ] **Step 2: Write the failing WithdrawView test**

Create `app/src/views/__tests__/WithdrawView.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WithdrawView from '../WithdrawView'

const setActiveView = vi.fn()
const signAndBroadcast = vi.fn()

vi.mock('../../api/client', () => ({ apiFetch: vi.fn() }))
vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => ({ token: 'test-token' }),
}))
vi.mock('../../stores/app', async () => {
  const actual = await vi.importActual<typeof import('../../stores/app')>('../../stores/app')
  return {
    ...actual,
    useAppStore: (selector: (s: { setActiveView: typeof setActiveView }) => unknown) =>
      selector({ setActiveView }),
  }
})
vi.mock('../../hooks/useTransactionSigner', () => ({
  useTransactionSigner: () => ({
    signAndBroadcast,
    status: 'idle',
    setStatus: vi.fn(),
    reset: vi.fn(),
  }),
}))
vi.mock('../../lib/networkConfig', () => ({
  useNetworkConfigStore: (selector: (s: { config: { network: string } }) => unknown) =>
    selector({ config: { network: 'devnet' } }),
}))

import { apiFetch } from '../../api/client'
const mockedFetch = apiFetch as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockedFetch.mockReset()
  setActiveView.mockReset()
  signAndBroadcast.mockReset()
})

const fakePosition = {
  mint: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  balance: '2500000000',
  balanceUiAmount: 2.5,
  lockedAmount: '0',
  decimals: 9,
  lastDepositAt: 1715000000,
  refundableAt: 1715086400,
  cooldownActive: false,
  depositRecordAddress: 'DEPOSITRECORDPDA',
}

describe('WithdrawView', () => {
  it('renders RefundList with positions from /api/vault/positions', async () => {
    mockedFetch.mockResolvedValueOnce({ positions: [fakePosition], available: true, network: 'devnet' })
    render(<WithdrawView />)
    await waitFor(() => {
      expect(screen.getByText('SOL')).toBeInTheDocument()
    })
  })

  it('renders Back chip that calls setActiveView("vault")', async () => {
    mockedFetch.mockResolvedValueOnce({ positions: [], available: true, network: 'devnet' })
    render(<WithdrawView />)
    await waitFor(() => {
      const back = screen.getByRole('button', { name: /back to vault/i })
      fireEvent.click(back)
      expect(setActiveView).toHaveBeenCalledWith('vault')
    })
  })

  it('clicking Refund calls /api/vault/refund-tx and signAndBroadcast', async () => {
    mockedFetch.mockImplementation((path: string) => {
      if (path === '/api/vault/positions') return Promise.resolve({ positions: [fakePosition], available: true, network: 'devnet' })
      if (path === '/api/vault/refund-tx') return Promise.resolve({ serializedTx: 'BASE64TX', refundAmount: '2500000000' })
      return Promise.reject(new Error('unexpected'))
    })
    signAndBroadcast.mockResolvedValueOnce({ signature: 'CONFIRMED_SIG' })

    render(<WithdrawView />)
    await waitFor(() => screen.getByText('SOL'))
    fireEvent.click(screen.getByRole('button', { name: /refund/i }))
    await waitFor(() => {
      expect(mockedFetch).toHaveBeenCalledWith('/api/vault/refund-tx', expect.objectContaining({ method: 'POST' }))
      expect(signAndBroadcast).toHaveBeenCalledWith('BASE64TX')
    })
  })

  it('renders disabled state on mainnet', async () => {
    vi.doMock('../../lib/networkConfig', () => ({
      useNetworkConfigStore: (selector: (s: { config: { network: string } }) => unknown) =>
        selector({ config: { network: 'mainnet' } }),
    }))
    mockedFetch.mockResolvedValueOnce({ positions: [], available: false, reason: 'mainnet-beta_no_vault', network: 'mainnet-beta' })

    const Reloaded = (await import('../WithdrawView')).default
    render(<Reloaded />)
    await waitFor(() => {
      expect(screen.getByText(/devnet only/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 3: Run test, verify it fails**

```bash
pnpm --filter sipher-app test -- WithdrawView --run 2>&1 | tail -10
# expect: FAIL — module not found
```

- [ ] **Step 4: Implement WithdrawView**

Create `app/src/views/WithdrawView.tsx`:

```tsx
import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft } from '@phosphor-icons/react'
import { apiFetch } from '../api/client'
import { useAuthState } from '../hooks/useAuthState'
import { useAppStore } from '../stores/app'
import { useTransactionSigner } from '../hooks/useTransactionSigner'
import { useNetworkConfigStore } from '../lib/networkConfig'
import { Card } from '../components/ui/Card'
import { RefundList } from '../components/vault/RefundList'
import type { Position } from '../components/vault/StealthAddressList'
import type { SignStatus } from '../hooks/useTransactionSigner'

interface PositionsResponse {
  positions: Position[]
  available: boolean
  reason?: string
  network: string
}

export default function WithdrawView() {
  const { token } = useAuthState()
  const setActiveView = useAppStore((s) => s.setActiveView)
  const network = useNetworkConfigStore((s) => s.config?.network ?? '')
  const isMainnet = network === 'mainnet'

  const [positions, setPositions] = useState<Position[]>([])
  const [statusByToken, setStatusByToken] = useState<Record<string, SignStatus>>({})
  const [signaturesByToken, setSignaturesByToken] = useState<Record<string, string>>({})
  const [errorByToken, setErrorByToken] = useState<Record<string, string>>({})

  const { signAndBroadcast } = useTransactionSigner()

  const refresh = useCallback(() => {
    if (!token) return
    apiFetch<PositionsResponse>('/api/vault/positions', { token })
      .then((r) => setPositions(r.positions))
      .catch(() => null)
  }, [token])

  useEffect(() => { refresh() }, [refresh])

  const handleRefund = useCallback(
    async (tokenSymbol: string) => {
      setErrorByToken((s) => ({ ...s, [tokenSymbol]: '' }))
      setStatusByToken((s) => ({ ...s, [tokenSymbol]: 'signing' }))
      try {
        const { serializedTx } = await apiFetch<{ serializedTx: string; refundAmount: string }>(
          '/api/vault/refund-tx',
          { method: 'POST', token, body: JSON.stringify({ token: tokenSymbol }) }
        )
        setStatusByToken((s) => ({ ...s, [tokenSymbol]: 'broadcasting' }))
        const result = await signAndBroadcast(serializedTx)
        if (result.error) {
          setStatusByToken((s) => ({ ...s, [tokenSymbol]: 'error' }))
          setErrorByToken((s) => ({ ...s, [tokenSymbol]: result.error ?? 'unknown error' }))
          return
        }
        setStatusByToken((s) => ({ ...s, [tokenSymbol]: 'confirmed' }))
        if (result.signature) {
          setSignaturesByToken((s) => ({ ...s, [tokenSymbol]: result.signature! }))
        }
        // Re-fetch positions; balance should now be 0
        setTimeout(() => refresh(), 1500)
      } catch (err) {
        setStatusByToken((s) => ({ ...s, [tokenSymbol]: 'error' }))
        setErrorByToken((s) => ({
          ...s,
          [tokenSymbol]: err instanceof Error ? err.message : 'unknown error',
        }))
      }
    },
    [signAndBroadcast, token, refresh]
  )

  if (isMainnet) {
    return (
      <div className="flex flex-col gap-4 max-w-3xl mx-auto">
        <BackChip onClick={() => setActiveView('vault')} />
        <Card variant="default" className="p-6">
          <p className="text-sm text-text">
            Sipher Vault is on devnet only — switch network to deposit/withdraw.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto">
      <BackChip onClick={() => setActiveView('vault')} />
      <h1 className="text-2xl font-semibold">Refund from vault</h1>
      <p className="text-xs text-text-muted">
        Each refund returns deposited balance to your wallet. The on-chain 24h cooldown is enforced
        per record.
      </p>
      <RefundList
        records={positions}
        onRefund={handleRefund}
        statusByToken={statusByToken}
        signaturesByToken={signaturesByToken}
      />
      {Object.entries(errorByToken)
        .filter(([_, msg]) => msg)
        .map(([tok, msg]) => (
          <Card key={tok} variant="default" className="p-3 border-danger">
            <p className="text-xs text-danger">
              {tok}: {msg}
            </p>
          </Card>
        ))}
    </div>
  )
}

function BackChip({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start flex items-center gap-1 text-xs text-text-secondary border border-line rounded-md px-2 py-1 hover:border-line-2 hover:text-text"
    >
      <ArrowLeft size={12} /> Back to Vault
    </button>
  )
}
```

- [ ] **Step 5: Wire WithdrawView into App.tsx**

Edit `app/src/App.tsx`. Import:

```ts
import WithdrawView from './views/WithdrawView'
```

Add the case:

```ts
case 'withdraw':
  return <WithdrawView />
```

- [ ] **Step 6: Verify Header matcher includes 'withdraw'**

Already extended in PR 6a Task 8 Step 6 to `['vault', 'deposit', 'withdraw']`. Verify the array is exact:

```bash
grep -n "vault.*deposit.*withdraw\|withdraw.*deposit.*vault" app/src/components/Header.tsx
# expect at least one match
```

- [ ] **Step 7: Run WithdrawView test, verify pass**

```bash
pnpm --filter sipher-app test -- WithdrawView --run 2>&1 | tail -10
# expect: 4 tests pass
```

- [ ] **Step 8: Run full app + agent suites**

```bash
pnpm --filter sipher-app test --run 2>&1 | tail -8
pnpm --filter @sipher/agent test --run 2>&1 | tail -8
# expect: ~300 app tests, ~1,382 agent tests, 0 failing
```

- [ ] **Step 9: Commit**

```bash
git add app/src/views/WithdrawView.tsx \
        app/src/views/__tests__/WithdrawView.test.tsx \
        app/src/stores/app.ts \
        app/src/App.tsx
git commit -m "feat(redesign): WithdrawView route + per-record refund flow"
```

## PR 6b / Task 6: Manual smoke + open PR

- [ ] **Step 1: Devnet smoke (refund)**

This requires a deposit record that has elapsed the 24h cooldown. Two paths:

**Path A — use an existing aged record.** If you have a devnet deposit ≥24h old (from PR 6a smoke or prior testing), proceed directly.

**Path B — fresh deposit + wait.** Deposit 0.01 SOL via PR 6a flow today; come back tomorrow to refund.

Steps once cooldown elapsed:

1. Connect wallet (devnet)
2. Auth
3. Navigate to /vault
4. Click "Withdraw" CTA — confirm WithdrawView loads
5. Confirm RefundList shows the SOL row with "Available now" chip
6. Click Refund — confirm Phantom popup
7. Approve — TxStatusBadge: signing → broadcasting → confirmed
8. Confirm row updates after re-fetch (balance = 0 OR row removed)
9. Capture screenshots

- [ ] **Step 2: Push branch and open PR**

```bash
git push -u origin feat/redesign-vault-flows-withdraw
gh pr create --title "feat(redesign): PR 6b — WithdrawView with per-record refund flow" --body "$(cat <<'EOF'
## Summary
- New full-page WithdrawView with per-mint refund rows
- 24h cooldown chip with self-ticking countdown
- POST /api/vault/refund-tx — REST adapter for buildRefundTx
- Real on-chain refund via existing useTransactionSigner

## Test plan
- [ ] App tests pass (~300)
- [ ] Agent tests pass (~1,382)
- [ ] Manual smoke refund on devnet (screenshot below)
- [ ] Mainnet path: BetaBanner banner visible, view shows disabled state
- [ ] Vercel preview renders WithdrawView

## Spec
docs/superpowers/specs/2026-05-08-pr6-vault-flows-design.md (commit 74cb083)

## Builds on PR 6a
This PR depends on PR 6a (deposit path) merged first. Refund consumes deposit_records created by deposit flow.

## Out of scope
Claim flow (Phase 2 / M19) and private-send-to-stealth (already in chat send tool).

## Smoke screenshots
[paste devnet refund screenshots]
EOF
)"
```

- [ ] **Step 3: Wait for CI green**

- [ ] **Step 4: Merge with `--merge --delete-branch`**

```bash
gh pr merge --merge --delete-branch
```

After merge:

```bash
cd ~/local-dev/sipher
git checkout main
git pull origin main
git worktree remove .worktrees/feat-redesign-vault-flows-withdraw
git branch -d feat/redesign-vault-flows-withdraw
```

## PR 6b / Task 7: Memory + handoff

- [ ] **Step 1: Update memory**

Edit `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/project_phase4b-redesign-sprint.md` to flip PR 6 status from "next" to merged with the two PR numbers.

- [ ] **Step 2: Update sprint plan**

Edit `docs/superpowers/plans/2026-05-07-glass-neon-redesign.md` PR 6 section to mark it complete and reference both 6a/6b PR numbers.

- [ ] **Step 3: Final commit**

```bash
git add ~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/project_phase4b-redesign-sprint.md \
        docs/superpowers/plans/2026-05-07-glass-neon-redesign.md
git commit -m "docs(redesign): mark PR 6 complete in sprint plan + memory"
git push
```

(Memory file path changes per environment — adjust as needed; some setups commit memory inside the home directory only.)

---

## Self-Review Checklist

After executing both PRs, verify the following before declaring PR 6 complete:

### Spec coverage
- [ ] D1 (real SDK signing) — covered by useTransactionSigner integration in DepositView/WithdrawView (Tasks 6a/8 + 6b/5)
- [ ] D2 (full-page routes) — View enum extended in 6a/8 + 6b/5
- [ ] D3 (parallel fetches) — VaultView mount in 6a/9
- [ ] D4 (compose AmountForm) — DepositForm in 6a/6
- [ ] D5 (synthetic-tx projected) — privacy.ts extension in 6a/4
- [ ] D6 (hybrid stealth list) — StealthAddressList in 6a/7
- [ ] D7 (refund-to-self) — WithdrawView + RefundList in 6b/4-5
- [ ] D8 (network gating) — every endpoint returns 409, BetaBanner extended, views render disabled
- [ ] D9 (multi-asset) — AssetSelector renders SOL/USDC/USDT in 6a/5

### Backwards compatibility
- [ ] Existing `/v1/privacy/score` callers (DashboardView) work without modification — body without `projectedAmount` produces identical response

### Test counts
- [ ] App tests: ~300 (pre-PR-6a was 237; +45 in 6a, +18 in 6b)
- [ ] Agent tests: ~1,382 (pre-PR-6a was 1,357; +17 in 6a, +8 in 6b)

### Manual gates
- [ ] PR 6a smoke deposit on devnet with screenshot
- [ ] PR 6b smoke refund on devnet (after 24h cooldown) with screenshot
- [ ] Vercel preview confirms each PR's UI live

### Carry-forward gotchas (from sprint memory)
- [ ] `@sipher/sdk` built before agent tests in fresh worktrees (`pnpm --filter "@sipher/sdk" build`)
- [ ] Reactflow ResizeObserver shim NOT needed for this PR (no NodeGraph touch)
- [ ] Tailwind 4 namespaces — RoutePreviewCard, PrivacyPreviewPanel use `--color-cyan`/`--color-violet` direct, not `--z-*` (which need @utility blocks)
- [ ] Legacy color tokens migrated only in VaultView (the file we're already touching), not as a sweeping refactor

---

**End of plan.**
