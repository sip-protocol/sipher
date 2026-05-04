# Phase 5 PR-1 — User-Facing Tool Unit Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add direct unit-level test coverage for the 8 user-facing agent tools that the 2026-04-18 audit flagged as missing per-tool tests (`assess-risk`, `balance`, `claim`, `deposit`, `refund`, `scan`, `send`, `status`). Tests apply the six-row sheet from the spec: happy path, schema validation, internal branches, service-error handling, output-shape lock, and spy assertions on service calls. Heavy service-layer mocking — real Zod parsing, real tool body, no I/O. Zero source changes.

**Architecture:** 8 new test files in `packages/agent/tests/<tool>.test.ts`, one shared fixture file at `packages/agent/tests/fixtures/user-tool-mocks.ts` containing data-shape factories (no `vi.fn()` exports — those go inline with `vi.hoisted` per file to avoid TDZ). Each test file inlines its own `vi.mock` factory for `@sipher/sdk` / `@sip-protocol/sdk` / etc., using `vi.hoisted` for per-test mock-return overrides. Pattern matches `packages/agent/tests/viewing-key.test.ts` (lines 14-46) which is the canonical existing example.

**Tech Stack:** Vitest 1.x, `@sipher/sdk`, `@sip-protocol/sdk`, `@solana/web3.js`, `@solana/spl-token`, `@noble/hashes`, `@noble/ciphers`.

**Spec:** `docs/superpowers/specs/2026-05-03-phase-5-tool-unit-tests-design.md`

**Branch:** `feat/phase-5-user-tool-tests` (already created from main at `4b71522`, holds the spec commit `e47873c`)

**Estimated scope:** ~80-130 new tests across 8 files + 1 fixture file. Single PR. ~3-4 sessions.

---

## Pre-flight Verification

- [ ] **Step 0a: Confirm branch state**

```bash
cd /Users/rector/local-dev/sipher
git status
git log --oneline -3
```

Expected output:
```
On branch feat/phase-5-user-tool-tests
nothing to commit, working tree clean
e47873c docs(spec): add Phase 5 tool unit test backfills design spec
4b71522 Merge pull request #163 from sip-protocol/fix/docker-patches-copy
9c69d05 Merge pull request #162 from sip-protocol/feat/phase-4-rest-service-tests
```

- [ ] **Step 0b: Confirm baseline test counts**

```bash
pnpm --filter @sipher/agent test -- --run 2>&1 | tail -5
```

Expected: `Tests  938 passed` (or similar — must be all green before starting).

- [ ] **Step 0c: Confirm typecheck baseline**

```bash
pnpm typecheck 2>&1 | tail -5
```

Expected: no errors.

---

## Task 1: Shared Fixture File

**Files:**
- Create: `packages/agent/tests/fixtures/user-tool-mocks.ts`

The fixture exports data-shape factories that match what real `@sipher/sdk` functions return. Test files import these factories and use them inside `mockResolvedValueOnce(...)` calls. The `vi.fn()` mocks themselves live in each test file via `vi.hoisted` (TDZ workaround documented in spec).

- [ ] **Step 1.1: Create the fixture file**

```typescript
// packages/agent/tests/fixtures/user-tool-mocks.ts
//
// Shared data-shape factories for user-facing tool tests (Phase 5 PR-1).
// Each factory returns the shape that real @sipher/sdk functions return,
// with sensible defaults and override-friendly partial inputs.
//
// NOTE: This file does NOT export vi.fn() instances. Vitest hoists vi.mock
// above imports, so vi.fn() instances must be declared per-test-file via
// vi.hoisted to avoid TDZ. This file holds DATA shapes only — call sites
// pass them into mockResolvedValueOnce / mockReturnValueOnce inside tests.

import { PublicKey } from '@solana/web3.js'

// ─────────────────────────────────────────────────────────────────────────────
// Test constants
// ─────────────────────────────────────────────────────────────────────────────

/** Real-format devnet wallet (RECTOR's shared dev wallet) */
export const VALID_WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'

/** A second valid base58 pubkey for recipient tests */
export const VALID_RECIPIENT = 'So11111111111111111111111111111111111111112'

/** Sample SPL mint for tests */
export const SOL_MINT = 'So11111111111111111111111111111111111111112'
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

/** A 32-byte hex string (64 chars, no 0x prefix) */
export const VALID_VIEWING_KEY_HEX = 'ab'.repeat(32)
export const VALID_SPENDING_KEY_HEX = 'cd'.repeat(32)

/** Full sip:solana stealth meta-address */
export const VALID_STEALTH_META_ADDRESS =
  `sip:solana:0x${VALID_SPENDING_KEY_HEX}:0x${VALID_VIEWING_KEY_HEX}`

/** Sipher vault program id (matches @sipher/sdk constant) */
export const VAULT_PROGRAM_ID_BASE58 = 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB'

// ─────────────────────────────────────────────────────────────────────────────
// VaultBalance shape factory — for getVaultBalance() return
// ─────────────────────────────────────────────────────────────────────────────

export interface VaultBalanceShape {
  balance: bigint
  available: bigint
  lockedAmount: bigint
  cumulativeVolume: bigint
  lastDepositAt: number
  exists: boolean
}

export function makeVaultBalance(
  overrides: Partial<VaultBalanceShape> = {}
): VaultBalanceShape {
  return {
    balance: 1_000_000_000n,
    available: 800_000_000n,
    lockedAmount: 200_000_000n,
    cumulativeVolume: 5_000_000_000n,
    lastDepositAt: 1_700_000_000,
    exists: true,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VaultConfig shape factory — for getVaultConfig() return
// ─────────────────────────────────────────────────────────────────────────────

export interface VaultConfigShape {
  paused: boolean
  feeBps: number
  refundTimeout: number
  totalDeposits: number
  totalDepositors: number
  authority: { toBase58: () => string }
}

export function makeVaultConfig(
  overrides: Partial<VaultConfigShape> = {}
): VaultConfigShape {
  return {
    paused: false,
    feeBps: 10,
    refundTimeout: 86400,
    totalDeposits: 5,
    totalDepositors: 3,
    authority: { toBase58: () => VALID_WALLET },
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// buildDepositTx result shape — { transaction, depositRecordAddress, vaultTokenAddress }
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildDepositTxShape {
  transaction: { serialize: (opts?: unknown) => Buffer }
  depositRecordAddress: { toBase58: () => string }
  vaultTokenAddress: { toBase58: () => string }
}

export function makeBuildDepositTxResult(
  overrides: Partial<BuildDepositTxShape> = {}
): BuildDepositTxShape {
  return {
    transaction: {
      serialize: () => Buffer.from('FAKE_DEPOSIT_TX_BYTES'),
    },
    depositRecordAddress: { toBase58: () => VALID_WALLET },
    vaultTokenAddress: { toBase58: () => VALID_WALLET },
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// buildRefundTx result shape — { transaction, refundAmount }
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildRefundTxShape {
  transaction: { serialize: (opts?: unknown) => Buffer }
  refundAmount: bigint
}

export function makeBuildRefundTxResult(
  overrides: Partial<BuildRefundTxShape> = {}
): BuildRefundTxShape {
  return {
    transaction: {
      serialize: () => Buffer.from('FAKE_REFUND_TX_BYTES'),
    },
    refundAmount: 800_000_000n,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// buildPrivateSendTx result shape — { transaction, feeAmount, netAmount }
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildPrivateSendTxShape {
  transaction: { serialize: (opts?: unknown) => Buffer }
  feeAmount: bigint
  netAmount: bigint
}

export function makeBuildPrivateSendTxResult(
  overrides: Partial<BuildPrivateSendTxShape> = {}
): BuildPrivateSendTxShape {
  return {
    transaction: {
      serialize: () => Buffer.from('FAKE_SEND_TX_BYTES'),
    },
    feeAmount: 1_000_000n,
    netAmount: 999_000_000n,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// scanForPayments result shape — { payments, eventsScanned, hasMore }
// ─────────────────────────────────────────────────────────────────────────────

export interface ScanPayment {
  txSignature: string
  stealthAddress: { toBase58: () => string }
  transferAmount: bigint
  feeAmount: bigint
  timestamp: number
}

export interface ScanForPaymentsShape {
  payments: ScanPayment[]
  eventsScanned: number
  hasMore: boolean
}

export function makeScanPayment(
  overrides: Partial<ScanPayment> = {}
): ScanPayment {
  return {
    txSignature: '5xyz' + 'a'.repeat(83),
    stealthAddress: { toBase58: () => VALID_RECIPIENT },
    transferAmount: 500_000_000n,
    feeAmount: 500_000n,
    timestamp: 1_700_000_000,
    ...overrides,
  }
}

export function makeScanResult(
  overrides: Partial<ScanForPaymentsShape> = {}
): ScanForPaymentsShape {
  return {
    payments: [],
    eventsScanned: 0,
    hasMore: false,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveTokenMint helper — returns a PublicKey-like shape
// ─────────────────────────────────────────────────────────────────────────────

export function makeMockMint(base58 = SOL_MINT): { toBase58: () => string } {
  return { toBase58: () => base58 }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stealth meta-address helpers (for send tool tests)
// ─────────────────────────────────────────────────────────────────────────────

/** Build a fake stealth-address generation result (matches @sip-protocol/sdk shape) */
export function makeStealthAddress() {
  return {
    stealthAddress: {
      address: '0x' + 'aa'.repeat(32),
      ephemeralPublicKey: '0x' + 'bb'.repeat(32),
    },
  }
}

/** Build a fake Pedersen commit result (matches @sip-protocol/sdk shape) */
export function makeCommitResult() {
  return {
    commitment: '0x' + 'cc'.repeat(33),
    blinding: '0x' + 'dd'.repeat(32),
  }
}
```

- [ ] **Step 1.2: Verify the fixture file typechecks**

```bash
pnpm --filter @sipher/agent typecheck 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 1.3: Commit the fixture**

```bash
git add packages/agent/tests/fixtures/user-tool-mocks.ts
git commit -m "test(phase-5): add user-tool-mocks fixture for tool unit tests"
```

---

## Task 2: claim.test.ts

**Files:**
- Test: `packages/agent/tests/claim.test.ts` (NEW)

**Source under test:** `packages/agent/src/tools/claim.ts` (95 lines, Phase 1 stub — no service calls, pure input validation + stub return)

`claim` is the simplest of the 8 because it's currently a Phase 1 scaffold that doesn't call the SDK at all. Tests focus on input validation and the stub-shape contract.

- [ ] **Step 2.1: Write the test file (definition + happy path)**

```typescript
// packages/agent/tests/claim.test.ts
import { describe, it, expect } from 'vitest'
import { claimTool, executeClaim } from '../src/tools/claim.js'

const VALID_TX_SIG = '5' + 'a'.repeat(87)
const VALID_VIEWING_KEY = 'ab'.repeat(32)
const VALID_SPENDING_KEY = 'cd'.repeat(32)
const VALID_DESTINATION = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'

describe('claimTool definition', () => {
  it('has correct name', () => {
    expect(claimTool.name).toBe('claim')
  })

  it('declares required input fields', () => {
    expect(claimTool.input_schema.required).toEqual([
      'txSignature',
      'viewingKey',
      'spendingKey',
    ])
  })

  it('declares optional destinationWallet field', () => {
    expect(claimTool.input_schema.properties).toHaveProperty('destinationWallet')
  })
})

describe('executeClaim — happy path', () => {
  it('returns awaiting_signature shape with stealth key derived', async () => {
    const result = await executeClaim({
      txSignature: VALID_TX_SIG,
      viewingKey: VALID_VIEWING_KEY,
      spendingKey: VALID_SPENDING_KEY,
    })

    expect(result.action).toBe('claim')
    expect(result.txSignature).toBe(VALID_TX_SIG)
    expect(result.status).toBe('awaiting_signature')
    expect(result.serializedTx).toBeNull()
    expect(result.details.stealthKeyDerived).toBe(true)
    expect(result.details.destinationWallet).toBeNull()
    expect(result.details.note).toContain('ephemeral')
  })

  it('reflects destinationWallet when provided', async () => {
    const result = await executeClaim({
      txSignature: VALID_TX_SIG,
      viewingKey: VALID_VIEWING_KEY,
      spendingKey: VALID_SPENDING_KEY,
      destinationWallet: VALID_DESTINATION,
    })

    expect(result.details.destinationWallet).toBe(VALID_DESTINATION)
  })

  it('truncates signature in message', async () => {
    const result = await executeClaim({
      txSignature: VALID_TX_SIG,
      viewingKey: VALID_VIEWING_KEY,
      spendingKey: VALID_SPENDING_KEY,
    })

    expect(result.message).toContain(VALID_TX_SIG.slice(0, 12))
    expect(result.message).not.toContain(VALID_TX_SIG.slice(13))
  })
})

describe('executeClaim — input validation', () => {
  it('rejects empty txSignature', async () => {
    await expect(
      executeClaim({
        txSignature: '',
        viewingKey: VALID_VIEWING_KEY,
        spendingKey: VALID_SPENDING_KEY,
      })
    ).rejects.toThrow(/transaction signature is required/i)
  })

  it('rejects whitespace-only txSignature', async () => {
    await expect(
      executeClaim({
        txSignature: '   ',
        viewingKey: VALID_VIEWING_KEY,
        spendingKey: VALID_SPENDING_KEY,
      })
    ).rejects.toThrow(/transaction signature is required/i)
  })

  it('rejects empty viewingKey', async () => {
    await expect(
      executeClaim({
        txSignature: VALID_TX_SIG,
        viewingKey: '',
        spendingKey: VALID_SPENDING_KEY,
      })
    ).rejects.toThrow(/viewing key is required/i)
  })

  it('rejects empty spendingKey', async () => {
    await expect(
      executeClaim({
        txSignature: VALID_TX_SIG,
        viewingKey: VALID_VIEWING_KEY,
        spendingKey: '',
      })
    ).rejects.toThrow(/spending key is required/i)
  })
})
```

- [ ] **Step 2.2: Run claim tests, verify all pass**

```bash
pnpm --filter @sipher/agent test claim.test.ts -- --run 2>&1 | tail -20
```

Expected: `Tests  10 passed` (3 definition + 3 happy + 4 validation).

- [ ] **Step 2.3: Commit**

```bash
git add packages/agent/tests/claim.test.ts
git commit -m "test(phase-5): add direct unit tests for claim tool

Covers Phase 1 stub contract — input validation, stealth-key-derived
shape, destinationWallet pass-through, signature truncation in message.
10 tests across definition / happy path / validation describe blocks."
```

---

## Task 3: status.test.ts

**Files:**
- Test: `packages/agent/tests/status.test.ts` (NEW)

**Source under test:** `packages/agent/src/tools/status.ts` (98 lines)

`status` calls `createConnection` + `getVaultConfig` from `@sipher/sdk`. Branches: config null (defaults path), config not null (paused or active, timeout >= 1h or < 1h).

- [ ] **Step 3.1: Write test file scaffolding (mocks + imports)**

```typescript
// packages/agent/tests/status.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  makeVaultConfig,
  VAULT_PROGRAM_ID_BASE58,
  VALID_WALLET,
} from './fixtures/user-tool-mocks.js'

// vi.hoisted — declare mock fns so vi.mock factories can reference them
const { mockGetVaultConfig, mockCreateConnection } = vi.hoisted(() => ({
  mockGetVaultConfig: vi.fn(),
  mockCreateConnection: vi.fn(),
}))

vi.mock('@sipher/sdk', () => ({
  createConnection: mockCreateConnection,
  getVaultConfig: mockGetVaultConfig,
  SIPHER_VAULT_PROGRAM_ID: { toBase58: () => 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB' },
  DEFAULT_FEE_BPS: 10,
  DEFAULT_REFUND_TIMEOUT: 86400,
}))

import { statusTool, executeStatus } from '../src/tools/status.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateConnection.mockReturnValue({})
})

describe('statusTool definition', () => {
  it('has correct name', () => {
    expect(statusTool.name).toBe('status')
  })

  it('takes no required input', () => {
    expect(statusTool.input_schema.required).toEqual([])
  })
})
```

- [ ] **Step 3.2: Run tests so far (typecheck + 2 definition tests)**

```bash
pnpm --filter @sipher/agent test status.test.ts -- --run 2>&1 | tail -10
```

Expected: `Tests  2 passed`.

- [ ] **Step 3.3: Add config-found happy path tests**

Append to `packages/agent/tests/status.test.ts`:

```typescript
describe('executeStatus — config found', () => {
  it('returns active vault status with all fields', async () => {
    mockGetVaultConfig.mockResolvedValueOnce(makeVaultConfig())

    const result = await executeStatus()

    expect(result.action).toBe('status')
    expect(result.status).toBe('success')
    expect(result.vault.configFound).toBe(true)
    expect(result.vault.paused).toBe(false)
    expect(result.vault.feeBps).toBe(10)
    expect(result.vault.feePercent).toBe('0.1%')
    expect(result.vault.refundTimeout).toBe(86400)
    expect(result.vault.refundTimeoutHuman).toBe('24 hours')
    expect(result.vault.totalDeposits).toBe(5)
    expect(result.vault.totalDepositors).toBe(3)
    expect(result.vault.authority).toBe(VALID_WALLET)
    expect(result.vault.programId).toBe(VAULT_PROGRAM_ID_BASE58)
  })

  it('returns paused message when config.paused is true', async () => {
    mockGetVaultConfig.mockResolvedValueOnce(makeVaultConfig({ paused: true }))

    const result = await executeStatus()

    expect(result.vault.paused).toBe(true)
    expect(result.message).toContain('PAUSED')
    expect(result.message).toContain('Funds are safe')
  })

  it('returns active message when config.paused is false', async () => {
    mockGetVaultConfig.mockResolvedValueOnce(makeVaultConfig({ paused: false }))

    const result = await executeStatus()

    expect(result.message).toContain('Vault is active')
    expect(result.message).toContain('0.1%')
  })

  it('formats refund timeout as minutes when < 1 hour', async () => {
    mockGetVaultConfig.mockResolvedValueOnce(
      makeVaultConfig({ refundTimeout: 1800 })
    )

    const result = await executeStatus()

    expect(result.vault.refundTimeoutHuman).toBe('30 minutes')
  })

  it('formats refund timeout as hours when >= 1 hour', async () => {
    mockGetVaultConfig.mockResolvedValueOnce(
      makeVaultConfig({ refundTimeout: 7200 })
    )

    const result = await executeStatus()

    expect(result.vault.refundTimeoutHuman).toBe('2 hours')
  })
})

describe('executeStatus — config not found', () => {
  it('returns default vault shape when getVaultConfig returns null', async () => {
    mockGetVaultConfig.mockResolvedValueOnce(null)

    const result = await executeStatus()

    expect(result.vault.configFound).toBe(false)
    expect(result.vault.paused).toBe(false)
    expect(result.vault.feeBps).toBe(10) // DEFAULT_FEE_BPS
    expect(result.vault.refundTimeout).toBe(86400) // DEFAULT_REFUND_TIMEOUT
    expect(result.vault.totalDeposits).toBe(0)
    expect(result.vault.totalDepositors).toBe(0)
    expect(result.vault.authority).toBeNull()
    expect(result.message).toContain('not found on-chain')
  })
})

describe('executeStatus — service interaction', () => {
  it('respects SOLANA_NETWORK env var', async () => {
    const original = process.env.SOLANA_NETWORK
    process.env.SOLANA_NETWORK = 'devnet'
    try {
      mockGetVaultConfig.mockResolvedValueOnce(makeVaultConfig())
      await executeStatus()
      expect(mockCreateConnection).toHaveBeenCalledWith('devnet')
    } finally {
      if (original !== undefined) process.env.SOLANA_NETWORK = original
      else delete process.env.SOLANA_NETWORK
    }
  })

  it('defaults to mainnet-beta when SOLANA_NETWORK unset', async () => {
    const original = process.env.SOLANA_NETWORK
    delete process.env.SOLANA_NETWORK
    try {
      mockGetVaultConfig.mockResolvedValueOnce(makeVaultConfig())
      await executeStatus()
      expect(mockCreateConnection).toHaveBeenCalledWith('mainnet-beta')
    } finally {
      if (original !== undefined) process.env.SOLANA_NETWORK = original
    }
  })
})
```

- [ ] **Step 3.4: Run all status tests**

```bash
pnpm --filter @sipher/agent test status.test.ts -- --run 2>&1 | tail -15
```

Expected: `Tests  10 passed` (2 definition + 5 config-found + 1 config-not-found + 2 env).

- [ ] **Step 3.5: Commit**

```bash
git add packages/agent/tests/status.test.ts
git commit -m "test(phase-5): add direct unit tests for status tool

Covers config-found vs not-found branches, paused/active message
variants, refund timeout formatting (minutes vs hours), env var
handling for SOLANA_NETWORK. 10 tests."
```

---

## Task 4: assess-risk.test.ts

**Files:**
- Test: `packages/agent/tests/assess-risk.test.ts` (NEW)

**Source under test:** `packages/agent/src/tools/assess-risk.ts` (30 lines)

`assess-risk` calls `getSentinelAssessor()` from `../sentinel/preflight-gate.js` and either invokes the returned function or throws. Mock target is `../sentinel/preflight-gate.js`.

- [ ] **Step 4.1: Write the test file**

```typescript
// packages/agent/tests/assess-risk.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetSentinelAssessor } = vi.hoisted(() => ({
  mockGetSentinelAssessor: vi.fn(),
}))

vi.mock('../src/sentinel/preflight-gate.js', () => ({
  getSentinelAssessor: mockGetSentinelAssessor,
}))

import { assessRiskTool, executeAssessRisk } from '../src/tools/assess-risk.js'

const SAMPLE_CONTEXT = {
  action: 'send',
  wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
  recipient: 'So11111111111111111111111111111111111111112',
  amount: 1.5,
  token: 'SOL',
}

const SAMPLE_REPORT = {
  level: 'low' as const,
  summary: 'Routine send, no anomalies detected.',
  factors: [],
  recommendation: 'allow' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('assessRiskTool definition', () => {
  it('has correct name', () => {
    expect(assessRiskTool.name).toBe('assessRisk')
  })

  it('declares required action and wallet fields', () => {
    expect(assessRiskTool.input_schema.required).toEqual(['action', 'wallet'])
  })

  it('declares optional recipient/amount/token/metadata fields', () => {
    const props = assessRiskTool.input_schema.properties
    expect(props).toHaveProperty('recipient')
    expect(props).toHaveProperty('amount')
    expect(props).toHaveProperty('token')
    expect(props).toHaveProperty('metadata')
  })
})

describe('executeAssessRisk — assessor configured', () => {
  it('invokes the assessor with the provided context and returns its report', async () => {
    const fakeAssessor = vi.fn().mockResolvedValue(SAMPLE_REPORT)
    mockGetSentinelAssessor.mockReturnValue(fakeAssessor)

    const result = await executeAssessRisk(SAMPLE_CONTEXT as any)

    expect(fakeAssessor).toHaveBeenCalledTimes(1)
    expect(fakeAssessor).toHaveBeenCalledWith(SAMPLE_CONTEXT)
    expect(result).toEqual(SAMPLE_REPORT)
  })

  it('propagates errors from the underlying assessor', async () => {
    const fakeAssessor = vi.fn().mockRejectedValue(new Error('SENTINEL service down'))
    mockGetSentinelAssessor.mockReturnValue(fakeAssessor)

    await expect(executeAssessRisk(SAMPLE_CONTEXT as any)).rejects.toThrow(
      'SENTINEL service down'
    )
  })
})

describe('executeAssessRisk — assessor not configured', () => {
  it('throws when getSentinelAssessor returns null', async () => {
    mockGetSentinelAssessor.mockReturnValue(null)

    await expect(executeAssessRisk(SAMPLE_CONTEXT as any)).rejects.toThrow(
      /SENTINEL assessor not configured/i
    )
  })

  it('throws when getSentinelAssessor returns undefined', async () => {
    mockGetSentinelAssessor.mockReturnValue(undefined)

    await expect(executeAssessRisk(SAMPLE_CONTEXT as any)).rejects.toThrow(
      /SENTINEL assessor not configured/i
    )
  })
})
```

- [ ] **Step 4.2: Run assess-risk tests**

```bash
pnpm --filter @sipher/agent test assess-risk.test.ts -- --run 2>&1 | tail -10
```

Expected: `Tests  7 passed`.

- [ ] **Step 4.3: Commit**

```bash
git add packages/agent/tests/assess-risk.test.ts
git commit -m "test(phase-5): add direct unit tests for assess-risk tool

Covers assessor-configured (invoke + propagate-error) and assessor-not-
configured (null and undefined) branches. 7 tests."
```

---

## Task 5: balance.test.ts

**Files:**
- Test: `packages/agent/tests/balance.test.ts` (NEW)

**Source under test:** `packages/agent/src/tools/balance.ts` (111 lines)

`balance` calls SDK functions: `createConnection`, `getVaultBalance`, `resolveTokenMint`, `getTokenDecimals`, `fromBaseUnits`. Plus `PublicKey` from `@solana/web3.js` for wallet validation.

Branches: empty token, empty wallet, invalid pubkey, balance.exists / not, lastDepositAt > 0 / 0.

- [ ] **Step 5.1: Write test file scaffolding + definition tests**

```typescript
// packages/agent/tests/balance.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  makeVaultBalance,
  makeMockMint,
  VALID_WALLET,
  SOL_MINT,
  USDC_MINT,
} from './fixtures/user-tool-mocks.js'

const {
  mockGetVaultBalance,
  mockCreateConnection,
  mockResolveTokenMint,
  mockGetTokenDecimals,
} = vi.hoisted(() => ({
  mockGetVaultBalance: vi.fn(),
  mockCreateConnection: vi.fn(),
  mockResolveTokenMint: vi.fn(),
  mockGetTokenDecimals: vi.fn(),
}))

vi.mock('@sipher/sdk', () => ({
  createConnection: mockCreateConnection,
  getVaultBalance: mockGetVaultBalance,
  resolveTokenMint: mockResolveTokenMint,
  getTokenDecimals: mockGetTokenDecimals,
  fromBaseUnits: (amount: bigint, decimals: number) => {
    // Simple impl that matches the real one for test purposes
    const divisor = 10n ** BigInt(decimals)
    const whole = amount / divisor
    const frac = amount % divisor
    return frac === 0n ? whole.toString() : `${whole}.${frac.toString().padStart(decimals, '0').replace(/0+$/, '')}`
  },
}))

import { balanceTool, executeBalance } from '../src/tools/balance.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateConnection.mockReturnValue({})
  mockResolveTokenMint.mockReturnValue(makeMockMint(SOL_MINT))
  mockGetTokenDecimals.mockReturnValue(9)
})

describe('balanceTool definition', () => {
  it('has correct name', () => {
    expect(balanceTool.name).toBe('balance')
  })

  it('declares required token and wallet fields', () => {
    expect(balanceTool.input_schema.required).toEqual(['token', 'wallet'])
  })
})
```

- [ ] **Step 5.2: Run definition tests**

```bash
pnpm --filter @sipher/agent test balance.test.ts -- --run 2>&1 | tail -10
```

Expected: `Tests  2 passed`.

- [ ] **Step 5.3: Add input validation tests**

Append to `packages/agent/tests/balance.test.ts`:

```typescript
describe('executeBalance — input validation', () => {
  it('rejects empty token', async () => {
    await expect(
      executeBalance({ token: '', wallet: VALID_WALLET })
    ).rejects.toThrow(/token symbol is required/i)
  })

  it('rejects whitespace-only token', async () => {
    await expect(
      executeBalance({ token: '   ', wallet: VALID_WALLET })
    ).rejects.toThrow(/token symbol is required/i)
  })

  it('rejects empty wallet', async () => {
    await expect(
      executeBalance({ token: 'SOL', wallet: '' })
    ).rejects.toThrow(/wallet address is required/i)
  })

  it('rejects whitespace-only wallet', async () => {
    await expect(
      executeBalance({ token: 'SOL', wallet: '   ' })
    ).rejects.toThrow(/wallet address is required/i)
  })

  it('rejects invalid wallet base58', async () => {
    await expect(
      executeBalance({ token: 'SOL', wallet: 'not-a-real-pubkey-!!' })
    ).rejects.toThrow(/invalid wallet address/i)
  })
})
```

- [ ] **Step 5.4: Run validation tests**

```bash
pnpm --filter @sipher/agent test balance.test.ts -- --run 2>&1 | tail -10
```

Expected: `Tests  7 passed` (2 + 5 validation).

- [ ] **Step 5.5: Add happy-path and branch tests**

Append:

```typescript
describe('executeBalance — happy path', () => {
  it('returns balance shape for existing depositor', async () => {
    mockGetVaultBalance.mockResolvedValueOnce(makeVaultBalance())

    const result = await executeBalance({ token: 'SOL', wallet: VALID_WALLET })

    expect(result.action).toBe('balance')
    expect(result.token).toBe('SOL')
    expect(result.wallet).toBe(VALID_WALLET)
    expect(result.status).toBe('success')
    expect(result.balance.exists).toBe(true)
    expect(result.balance.total).toBe('1') // 1_000_000_000 base / 1e9
    expect(result.balance.available).toBe('0.8')
    expect(result.balance.locked).toBe('0.2')
    expect(result.balance.cumulativeVolume).toBe('5')
    expect(result.balance.lastDepositAt).toBe(
      new Date(1_700_000_000 * 1000).toISOString()
    )
    expect(result.message).toContain('Vault balance for')
    expect(result.message).toContain('1 SOL')
  })

  it('uppercases token symbol in result', async () => {
    mockGetVaultBalance.mockResolvedValueOnce(makeVaultBalance())

    const result = await executeBalance({ token: 'sol', wallet: VALID_WALLET })

    expect(result.token).toBe('SOL')
  })

  it('preserves wallet base58 in result', async () => {
    mockGetVaultBalance.mockResolvedValueOnce(makeVaultBalance())

    const result = await executeBalance({ token: 'SOL', wallet: VALID_WALLET })

    expect(result.wallet).toBe(VALID_WALLET)
  })
})

describe('executeBalance — branches', () => {
  it('returns exists=false shape when no deposit record', async () => {
    mockGetVaultBalance.mockResolvedValueOnce(
      makeVaultBalance({
        exists: false,
        balance: 0n,
        available: 0n,
        lockedAmount: 0n,
        cumulativeVolume: 0n,
        lastDepositAt: 0,
      })
    )

    const result = await executeBalance({ token: 'SOL', wallet: VALID_WALLET })

    expect(result.balance.exists).toBe(false)
    expect(result.balance.lastDepositAt).toBeNull()
    expect(result.message).toContain('no deposit record')
    expect(result.message).toContain('Deposit first')
  })

  it('returns null lastDepositAt when timestamp is 0', async () => {
    mockGetVaultBalance.mockResolvedValueOnce(
      makeVaultBalance({ lastDepositAt: 0 })
    )

    const result = await executeBalance({ token: 'SOL', wallet: VALID_WALLET })

    expect(result.balance.lastDepositAt).toBeNull()
  })

  it('handles USDC mint via resolveTokenMint', async () => {
    mockResolveTokenMint.mockReturnValueOnce(makeMockMint(USDC_MINT))
    mockGetTokenDecimals.mockReturnValueOnce(6)
    mockGetVaultBalance.mockResolvedValueOnce(
      makeVaultBalance({ balance: 100_000_000n })
    )

    const result = await executeBalance({ token: 'USDC', wallet: VALID_WALLET })

    expect(result.token).toBe('USDC')
    expect(result.balance.total).toBe('100')
    expect(mockResolveTokenMint).toHaveBeenCalledWith('USDC')
  })
})

describe('executeBalance — service interaction', () => {
  it('passes the resolved depositor PublicKey and token mint to getVaultBalance', async () => {
    mockGetVaultBalance.mockResolvedValueOnce(makeVaultBalance())

    await executeBalance({ token: 'SOL', wallet: VALID_WALLET })

    expect(mockGetVaultBalance).toHaveBeenCalledTimes(1)
    const [conn, depositor, mint] = mockGetVaultBalance.mock.calls[0]
    expect(conn).toBeDefined()
    expect(depositor.toBase58()).toBe(VALID_WALLET)
    expect(mint.toBase58()).toBe(SOL_MINT)
  })
})
```

- [ ] **Step 5.6: Run all balance tests**

```bash
pnpm --filter @sipher/agent test balance.test.ts -- --run 2>&1 | tail -15
```

Expected: `Tests  14 passed` (2 + 5 + 3 + 3 + 1).

- [ ] **Step 5.7: Commit**

```bash
git add packages/agent/tests/balance.test.ts
git commit -m "test(phase-5): add direct unit tests for balance tool

Covers input validation (empty token/wallet, invalid pubkey), happy
path with exists=true, branches for exists=false and zero lastDepositAt,
USDC token resolution, and spy assertion on getVaultBalance args.
14 tests."
```

---

## Task 6: refund.test.ts

**Files:**
- Test: `packages/agent/tests/refund.test.ts` (NEW)

**Source under test:** `packages/agent/src/tools/refund.ts` (127 lines)

`refund` has two modes: preview (no wallet — returns shape, no tx) and full (wallet → builds tx). Mock targets: `@sipher/sdk` for SDK funcs, `@solana/spl-token` for `getAssociatedTokenAddress`.

- [ ] **Step 6.1: Write test file scaffolding**

```typescript
// packages/agent/tests/refund.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  makeBuildRefundTxResult,
  makeMockMint,
  VALID_WALLET,
  SOL_MINT,
  USDC_MINT,
} from './fixtures/user-tool-mocks.js'

const {
  mockBuildRefundTx,
  mockCreateConnection,
  mockResolveTokenMint,
  mockGetTokenDecimals,
  mockGetAssociatedTokenAddress,
} = vi.hoisted(() => ({
  mockBuildRefundTx: vi.fn(),
  mockCreateConnection: vi.fn(),
  mockResolveTokenMint: vi.fn(),
  mockGetTokenDecimals: vi.fn(),
  mockGetAssociatedTokenAddress: vi.fn(),
}))

vi.mock('@sipher/sdk', () => ({
  createConnection: mockCreateConnection,
  buildRefundTx: mockBuildRefundTx,
  resolveTokenMint: mockResolveTokenMint,
  getTokenDecimals: mockGetTokenDecimals,
  fromBaseUnits: (amount: bigint, decimals: number) => {
    const divisor = 10n ** BigInt(decimals)
    const whole = amount / divisor
    const frac = amount % divisor
    return frac === 0n ? whole.toString() : `${whole}.${frac.toString().padStart(decimals, '0').replace(/0+$/, '')}`
  },
  SIPHER_VAULT_PROGRAM_ID: { toBase58: () => 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB' },
}))

vi.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddress: mockGetAssociatedTokenAddress,
}))

import { refundTool, executeRefund } from '../src/tools/refund.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateConnection.mockReturnValue({})
  mockResolveTokenMint.mockReturnValue(makeMockMint(SOL_MINT))
  mockGetTokenDecimals.mockReturnValue(9)
  mockGetAssociatedTokenAddress.mockResolvedValue({ toBase58: () => VALID_WALLET })
})

describe('refundTool definition', () => {
  it('has correct name', () => {
    expect(refundTool.name).toBe('refund')
  })

  it('declares required token field, wallet optional', () => {
    expect(refundTool.input_schema.required).toEqual(['token'])
    expect(refundTool.input_schema.properties).toHaveProperty('wallet')
  })
})
```

- [ ] **Step 6.2: Add validation, preview, and full-path tests**

Append:

```typescript
describe('executeRefund — input validation', () => {
  it('rejects empty token', async () => {
    await expect(executeRefund({ token: '', wallet: VALID_WALLET })).rejects.toThrow(
      /token symbol is required/i
    )
  })

  it('rejects whitespace-only token', async () => {
    await expect(executeRefund({ token: '   ', wallet: VALID_WALLET })).rejects.toThrow(
      /token symbol is required/i
    )
  })

  it('rejects invalid wallet base58 when wallet provided', async () => {
    await expect(
      executeRefund({ token: 'SOL', wallet: 'not-a-real-pubkey-!!' })
    ).rejects.toThrow(/invalid wallet address/i)
  })
})

describe('executeRefund — preview path (no wallet)', () => {
  it('returns prepared shape without building tx', async () => {
    const result = await executeRefund({ token: 'SOL' })

    expect(result.action).toBe('refund')
    expect(result.token).toBe('SOL')
    expect(result.wallet).toBeNull()
    expect(result.status).toBe('awaiting_signature')
    expect(result.serializedTx).toBeNull()
    expect(result.details.refundAmount).toBeNull()
    expect(result.details.refundTimeout).toBe('24 hours after last deposit')
    expect(result.message).toContain('Connect wallet')
  })

  it('uppercases token in preview', async () => {
    const result = await executeRefund({ token: 'usdc' })

    expect(result.token).toBe('USDC')
  })

  it('does not call buildRefundTx in preview mode', async () => {
    await executeRefund({ token: 'SOL' })

    expect(mockBuildRefundTx).not.toHaveBeenCalled()
    expect(mockCreateConnection).not.toHaveBeenCalled()
  })
})

describe('executeRefund — full path (wallet provided)', () => {
  it('builds tx and returns serialized base64', async () => {
    mockBuildRefundTx.mockResolvedValueOnce(makeBuildRefundTxResult())

    const result = await executeRefund({ token: 'SOL', wallet: VALID_WALLET })

    expect(result.action).toBe('refund')
    expect(result.token).toBe('SOL')
    expect(result.wallet).toBe(VALID_WALLET)
    expect(result.status).toBe('awaiting_signature')
    expect(result.serializedTx).toBe(
      Buffer.from('FAKE_REFUND_TX_BYTES').toString('base64')
    )
    expect(result.details.refundAmount).toBe('0.8') // 800_000_000 / 1e9
    expect(result.message).toContain('0.8 SOL returning')
  })

  it('handles USDC token decimals correctly', async () => {
    mockResolveTokenMint.mockReturnValueOnce(makeMockMint(USDC_MINT))
    mockGetTokenDecimals.mockReturnValueOnce(6)
    mockBuildRefundTx.mockResolvedValueOnce(
      makeBuildRefundTxResult({ refundAmount: 100_000_000n })
    )

    const result = await executeRefund({ token: 'USDC', wallet: VALID_WALLET })

    expect(result.token).toBe('USDC')
    expect(result.details.refundAmount).toBe('100') // 100_000_000 / 1e6
  })
})

describe('executeRefund — service interaction', () => {
  it('calls buildRefundTx with depositor, mint, and ATA', async () => {
    mockBuildRefundTx.mockResolvedValueOnce(makeBuildRefundTxResult())

    await executeRefund({ token: 'SOL', wallet: VALID_WALLET })

    expect(mockBuildRefundTx).toHaveBeenCalledTimes(1)
    const [conn, depositor, mint, ata] = mockBuildRefundTx.mock.calls[0]
    expect(conn).toBeDefined()
    expect(depositor.toBase58()).toBe(VALID_WALLET)
    expect(mint.toBase58()).toBe(SOL_MINT)
    expect(ata).toBeDefined()
  })

  it('propagates buildRefundTx errors', async () => {
    mockBuildRefundTx.mockRejectedValueOnce(new Error('insufficient available balance'))

    await expect(
      executeRefund({ token: 'SOL', wallet: VALID_WALLET })
    ).rejects.toThrow(/insufficient available balance/i)
  })
})
```

- [ ] **Step 6.3: Run all refund tests**

```bash
pnpm --filter @sipher/agent test refund.test.ts -- --run 2>&1 | tail -15
```

Expected: `Tests  12 passed` (2 + 3 + 3 + 2 + 2).

- [ ] **Step 6.4: Commit**

```bash
git add packages/agent/tests/refund.test.ts
git commit -m "test(phase-5): add direct unit tests for refund tool

Covers input validation (empty/whitespace token, invalid pubkey), preview
path (no wallet), full path (wallet → buildRefundTx → serialized base64),
USDC decimals handling, spy assertion on buildRefundTx args, and error
propagation. 12 tests."
```

---

## Task 7: deposit.test.ts

**Files:**
- Test: `packages/agent/tests/deposit.test.ts` (NEW)

**Source under test:** `packages/agent/src/tools/deposit.ts` (147 lines)

Same shape as refund (preview + full paths) plus amount-validation. Adds `toBaseUnits` and `buildDepositTx` to the mock surface.

- [ ] **Step 7.1: Write test file**

```typescript
// packages/agent/tests/deposit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  makeBuildDepositTxResult,
  makeMockMint,
  VALID_WALLET,
  SOL_MINT,
  USDC_MINT,
  VAULT_PROGRAM_ID_BASE58,
} from './fixtures/user-tool-mocks.js'

const {
  mockBuildDepositTx,
  mockCreateConnection,
  mockResolveTokenMint,
  mockGetTokenDecimals,
  mockToBaseUnits,
  mockGetAssociatedTokenAddress,
} = vi.hoisted(() => ({
  mockBuildDepositTx: vi.fn(),
  mockCreateConnection: vi.fn(),
  mockResolveTokenMint: vi.fn(),
  mockGetTokenDecimals: vi.fn(),
  mockToBaseUnits: vi.fn(),
  mockGetAssociatedTokenAddress: vi.fn(),
}))

vi.mock('@sipher/sdk', () => ({
  createConnection: mockCreateConnection,
  buildDepositTx: mockBuildDepositTx,
  resolveTokenMint: mockResolveTokenMint,
  getTokenDecimals: mockGetTokenDecimals,
  toBaseUnits: mockToBaseUnits,
  SIPHER_VAULT_PROGRAM_ID: { toBase58: () => VAULT_PROGRAM_ID_BASE58 },
}))

vi.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddress: mockGetAssociatedTokenAddress,
}))

import { depositTool, executeDeposit } from '../src/tools/deposit.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateConnection.mockReturnValue({})
  mockResolveTokenMint.mockReturnValue(makeMockMint(SOL_MINT))
  mockGetTokenDecimals.mockReturnValue(9)
  mockToBaseUnits.mockReturnValue(1_500_000_000n)
  mockGetAssociatedTokenAddress.mockResolvedValue({ toBase58: () => VALID_WALLET })
})

describe('depositTool definition', () => {
  it('has correct name', () => {
    expect(depositTool.name).toBe('deposit')
  })

  it('declares required amount and token, wallet optional', () => {
    expect(depositTool.input_schema.required).toEqual(['amount', 'token'])
    expect(depositTool.input_schema.properties).toHaveProperty('wallet')
  })
})

describe('executeDeposit — input validation', () => {
  it('rejects amount <= 0', async () => {
    await expect(executeDeposit({ amount: 0, token: 'SOL' })).rejects.toThrow(
      /amount must be greater than zero/i
    )
  })

  it('rejects negative amount', async () => {
    await expect(executeDeposit({ amount: -1.5, token: 'SOL' })).rejects.toThrow(
      /amount must be greater than zero/i
    )
  })

  it('rejects empty token', async () => {
    await expect(executeDeposit({ amount: 1, token: '' })).rejects.toThrow(
      /token symbol is required/i
    )
  })

  it('rejects whitespace-only token', async () => {
    await expect(executeDeposit({ amount: 1, token: '   ' })).rejects.toThrow(
      /token symbol is required/i
    )
  })

  it('rejects invalid wallet base58 when wallet provided', async () => {
    await expect(
      executeDeposit({ amount: 1, token: 'SOL', wallet: 'not-real-!!' })
    ).rejects.toThrow(/invalid wallet address/i)
  })
})

describe('executeDeposit — preview path (no wallet)', () => {
  it('returns prepared shape without calling buildDepositTx', async () => {
    const result = await executeDeposit({ amount: 1.5, token: 'SOL' })

    expect(result.action).toBe('deposit')
    expect(result.amount).toBe(1.5)
    expect(result.token).toBe('SOL')
    expect(result.wallet).toBeNull()
    expect(result.status).toBe('awaiting_signature')
    expect(result.serializedTx).toBeNull()
    expect(result.details.depositRecordAddress).toBeNull()
    expect(result.details.vaultTokenAddress).toBeNull()
    expect(result.details.amountBaseUnits).toBeNull()
    expect(result.details.vaultProgram).toBe(VAULT_PROGRAM_ID_BASE58)
    expect(result.message).toContain('Connect wallet')
  })

  it('uppercases token in preview', async () => {
    const result = await executeDeposit({ amount: 1.5, token: 'usdc' })

    expect(result.token).toBe('USDC')
  })

  it('does not call buildDepositTx', async () => {
    await executeDeposit({ amount: 1, token: 'SOL' })

    expect(mockBuildDepositTx).not.toHaveBeenCalled()
  })
})

describe('executeDeposit — full path (wallet provided)', () => {
  it('builds tx and returns serialized base64', async () => {
    mockBuildDepositTx.mockResolvedValueOnce(makeBuildDepositTxResult())

    const result = await executeDeposit({
      amount: 1.5,
      token: 'SOL',
      wallet: VALID_WALLET,
    })

    expect(result.action).toBe('deposit')
    expect(result.amount).toBe(1.5)
    expect(result.token).toBe('SOL')
    expect(result.wallet).toBe(VALID_WALLET)
    expect(result.status).toBe('awaiting_signature')
    expect(result.serializedTx).toBe(
      Buffer.from('FAKE_DEPOSIT_TX_BYTES').toString('base64')
    )
    expect(result.details.depositRecordAddress).toBe(VALID_WALLET)
    expect(result.details.vaultTokenAddress).toBe(VALID_WALLET)
    expect(result.details.amountBaseUnits).toBe('1500000000')
    expect(result.message).toContain('Awaiting wallet signature')
  })

  it('handles USDC decimals correctly', async () => {
    mockResolveTokenMint.mockReturnValueOnce(makeMockMint(USDC_MINT))
    mockGetTokenDecimals.mockReturnValueOnce(6)
    mockToBaseUnits.mockReturnValueOnce(1_000_000n)
    mockBuildDepositTx.mockResolvedValueOnce(makeBuildDepositTxResult())

    const result = await executeDeposit({
      amount: 1,
      token: 'USDC',
      wallet: VALID_WALLET,
    })

    expect(result.token).toBe('USDC')
    expect(result.details.amountBaseUnits).toBe('1000000')
    expect(mockToBaseUnits).toHaveBeenCalledWith(1, 6)
  })
})

describe('executeDeposit — service interaction', () => {
  it('calls buildDepositTx with depositor, mint, ATA, and base-unit amount', async () => {
    mockBuildDepositTx.mockResolvedValueOnce(makeBuildDepositTxResult())

    await executeDeposit({ amount: 1.5, token: 'SOL', wallet: VALID_WALLET })

    expect(mockBuildDepositTx).toHaveBeenCalledTimes(1)
    const [conn, depositor, mint, ata, amount] = mockBuildDepositTx.mock.calls[0]
    expect(conn).toBeDefined()
    expect(depositor.toBase58()).toBe(VALID_WALLET)
    expect(mint.toBase58()).toBe(SOL_MINT)
    expect(ata).toBeDefined()
    expect(amount).toBe(1_500_000_000n)
  })

  it('propagates buildDepositTx errors', async () => {
    mockBuildDepositTx.mockRejectedValueOnce(new Error('vault paused'))

    await expect(
      executeDeposit({ amount: 1, token: 'SOL', wallet: VALID_WALLET })
    ).rejects.toThrow(/vault paused/i)
  })
})
```

- [ ] **Step 7.2: Run all deposit tests**

```bash
pnpm --filter @sipher/agent test deposit.test.ts -- --run 2>&1 | tail -15
```

Expected: `Tests  14 passed` (2 + 5 + 3 + 2 + 2).

- [ ] **Step 7.3: Commit**

```bash
git add packages/agent/tests/deposit.test.ts
git commit -m "test(phase-5): add direct unit tests for deposit tool

Covers amount/token/wallet validation, preview path (no wallet → no SDK
calls), full path (wallet → buildDepositTx → serialized base64), USDC
decimals handling via toBaseUnits, spy on buildDepositTx args, and error
propagation. 14 tests."
```

---

## Task 8: scan.test.ts

**Files:**
- Test: `packages/agent/tests/scan.test.ts` (NEW)

**Source under test:** `packages/agent/src/tools/scan.ts` (136 lines)

`scan` validates two hex keys (length, format), clamps `limit`, calls `scanForPayments`, formats payments. Many error branches.

- [ ] **Step 8.1: Write test file**

```typescript
// packages/agent/tests/scan.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  makeScanResult,
  makeScanPayment,
  VALID_VIEWING_KEY_HEX,
  VALID_SPENDING_KEY_HEX,
  VALID_RECIPIENT,
} from './fixtures/user-tool-mocks.js'

const { mockScanForPayments, mockCreateConnection } = vi.hoisted(() => ({
  mockScanForPayments: vi.fn(),
  mockCreateConnection: vi.fn(),
}))

vi.mock('@sipher/sdk', () => ({
  createConnection: mockCreateConnection,
  scanForPayments: mockScanForPayments,
  fromBaseUnits: (amount: bigint, decimals: number) => {
    const divisor = 10n ** BigInt(decimals)
    const whole = amount / divisor
    const frac = amount % divisor
    return frac === 0n ? whole.toString() : `${whole}.${frac.toString().padStart(decimals, '0').replace(/0+$/, '')}`
  },
}))

import { scanTool, executeScan } from '../src/tools/scan.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateConnection.mockReturnValue({})
})

describe('scanTool definition', () => {
  it('has correct name', () => {
    expect(scanTool.name).toBe('scan')
  })

  it('declares required viewingKey and spendingKey, optional limit', () => {
    expect(scanTool.input_schema.required).toEqual(['viewingKey', 'spendingKey'])
    expect(scanTool.input_schema.properties).toHaveProperty('limit')
  })
})

describe('executeScan — input validation', () => {
  it('rejects empty viewingKey', async () => {
    await expect(
      executeScan({ viewingKey: '', spendingKey: VALID_SPENDING_KEY_HEX })
    ).rejects.toThrow(/viewing key is required/i)
  })

  it('rejects whitespace-only viewingKey', async () => {
    await expect(
      executeScan({ viewingKey: '   ', spendingKey: VALID_SPENDING_KEY_HEX })
    ).rejects.toThrow(/viewing key is required/i)
  })

  it('rejects empty spendingKey', async () => {
    await expect(
      executeScan({ viewingKey: VALID_VIEWING_KEY_HEX, spendingKey: '' })
    ).rejects.toThrow(/spending private key is required/i)
  })

  it('rejects whitespace-only spendingKey', async () => {
    await expect(
      executeScan({ viewingKey: VALID_VIEWING_KEY_HEX, spendingKey: '   ' })
    ).rejects.toThrow(/spending private key is required/i)
  })

  it('rejects viewingKey of wrong length (too short)', async () => {
    await expect(
      executeScan({ viewingKey: 'ab'.repeat(16), spendingKey: VALID_SPENDING_KEY_HEX })
    ).rejects.toThrow(/viewing key must be 32 bytes/i)
  })

  it('rejects viewingKey of wrong length (too long)', async () => {
    await expect(
      executeScan({ viewingKey: 'ab'.repeat(40), spendingKey: VALID_SPENDING_KEY_HEX })
    ).rejects.toThrow(/viewing key must be 32 bytes/i)
  })

  it('rejects spendingKey of wrong length', async () => {
    await expect(
      executeScan({ viewingKey: VALID_VIEWING_KEY_HEX, spendingKey: 'cd'.repeat(16) })
    ).rejects.toThrow(/spending key must be 32 bytes/i)
  })
})

describe('executeScan — happy path', () => {
  it('returns empty list when no payments found', async () => {
    mockScanForPayments.mockResolvedValueOnce(
      makeScanResult({ eventsScanned: 50 })
    )

    const result = await executeScan({
      viewingKey: VALID_VIEWING_KEY_HEX,
      spendingKey: VALID_SPENDING_KEY_HEX,
    })

    expect(result.action).toBe('scan')
    expect(result.status).toBe('success')
    expect(result.payments).toEqual([])
    expect(result.eventsScanned).toBe(50)
    expect(result.hasMore).toBe(false)
    expect(result.message).toContain('Scanned')
    expect(result.message).toContain('no payments found')
  })

  it('returns formatted payments when found', async () => {
    mockScanForPayments.mockResolvedValueOnce(
      makeScanResult({
        payments: [makeScanPayment(), makeScanPayment({ txSignature: 'second-sig' })],
        eventsScanned: 100,
        hasMore: false,
      })
    )

    const result = await executeScan({
      viewingKey: VALID_VIEWING_KEY_HEX,
      spendingKey: VALID_SPENDING_KEY_HEX,
    })

    expect(result.payments).toHaveLength(2)
    expect(result.payments[0].txSignature).toContain('5xyz')
    expect(result.payments[0].stealthAddress).toBe(VALID_RECIPIENT)
    expect(result.payments[0].amount).toBe('0.5') // 500_000_000 / 1e9
    expect(result.payments[0].fee).toBe('0.0005') // 500_000 / 1e9
    expect(result.payments[1].txSignature).toBe('second-sig')
    expect(result.message).toContain('Found 2 payment(s)')
  })

  it('reports hasMore=true', async () => {
    mockScanForPayments.mockResolvedValueOnce(
      makeScanResult({ payments: [makeScanPayment()], hasMore: true })
    )

    const result = await executeScan({
      viewingKey: VALID_VIEWING_KEY_HEX,
      spendingKey: VALID_SPENDING_KEY_HEX,
    })

    expect(result.hasMore).toBe(true)
  })
})

describe('executeScan — limit clamping', () => {
  it('defaults limit to 100', async () => {
    mockScanForPayments.mockResolvedValueOnce(makeScanResult())

    await executeScan({
      viewingKey: VALID_VIEWING_KEY_HEX,
      spendingKey: VALID_SPENDING_KEY_HEX,
    })

    expect(mockScanForPayments).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 })
    )
  })

  it('clamps limit to max 1000', async () => {
    mockScanForPayments.mockResolvedValueOnce(makeScanResult())

    await executeScan({
      viewingKey: VALID_VIEWING_KEY_HEX,
      spendingKey: VALID_SPENDING_KEY_HEX,
      limit: 5000,
    })

    expect(mockScanForPayments).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1000 })
    )
  })

  it('clamps limit to min 1', async () => {
    mockScanForPayments.mockResolvedValueOnce(makeScanResult())

    await executeScan({
      viewingKey: VALID_VIEWING_KEY_HEX,
      spendingKey: VALID_SPENDING_KEY_HEX,
      limit: 0,
    })

    expect(mockScanForPayments).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1 })
    )
  })
})

describe('executeScan — service interaction', () => {
  it('passes viewing key as 32-byte Uint8Array', async () => {
    mockScanForPayments.mockResolvedValueOnce(makeScanResult())

    await executeScan({
      viewingKey: VALID_VIEWING_KEY_HEX,
      spendingKey: VALID_SPENDING_KEY_HEX,
    })

    const call = mockScanForPayments.mock.calls[0][0]
    expect(call.viewingPrivateKey).toBeInstanceOf(Uint8Array)
    expect(call.viewingPrivateKey).toHaveLength(32)
  })

  it('passes spending key as 32-byte Uint8Array', async () => {
    mockScanForPayments.mockResolvedValueOnce(makeScanResult())

    await executeScan({
      viewingKey: VALID_VIEWING_KEY_HEX,
      spendingKey: VALID_SPENDING_KEY_HEX,
    })

    const call = mockScanForPayments.mock.calls[0][0]
    expect(call.spendingPrivateKey).toBeInstanceOf(Uint8Array)
    expect(call.spendingPrivateKey).toHaveLength(32)
  })

  it('strips 0x prefix from keys', async () => {
    mockScanForPayments.mockResolvedValueOnce(makeScanResult())

    await executeScan({
      viewingKey: '0x' + VALID_VIEWING_KEY_HEX,
      spendingKey: '0x' + VALID_SPENDING_KEY_HEX,
    })

    const call = mockScanForPayments.mock.calls[0][0]
    expect(call.viewingPrivateKey).toHaveLength(32)
    expect(call.spendingPrivateKey).toHaveLength(32)
  })

  it('propagates scanForPayments errors', async () => {
    mockScanForPayments.mockRejectedValueOnce(new Error('rpc unavailable'))

    await expect(
      executeScan({
        viewingKey: VALID_VIEWING_KEY_HEX,
        spendingKey: VALID_SPENDING_KEY_HEX,
      })
    ).rejects.toThrow(/rpc unavailable/i)
  })
})
```

- [ ] **Step 8.2: Run all scan tests**

```bash
pnpm --filter @sipher/agent test scan.test.ts -- --run 2>&1 | tail -15
```

Expected: `Tests  19 passed` (2 + 7 + 3 + 3 + 4).

- [ ] **Step 8.3: Commit**

```bash
git add packages/agent/tests/scan.test.ts
git commit -m "test(phase-5): add direct unit tests for scan tool

Covers input validation (empty/whitespace/wrong-length keys), happy
path with empty/multiple payments, hasMore branch, limit clamping
(default/max/min), service interaction (key Uint8Array conversion,
0x prefix handling), and error propagation. 19 tests."
```

---

## Task 9: send.test.ts (largest)

**Files:**
- Test: `packages/agent/tests/send.test.ts` (NEW)

**Source under test:** `packages/agent/src/tools/send.ts` (295 lines)

`send` is the largest tool with two input shapes (stealth meta-address `sip:solana:...` vs. raw base58 pubkey), real cryptography hooks (mocked), and many validation branches. Mock surface includes `@sip-protocol/sdk` (stealth gen, commit), `@sipher/sdk` (vault config, build tx), `@solana/spl-token`, `@solana/web3.js` PublicKey (kept real for validation).

- [ ] **Step 9.1: Write scaffolding + definition tests**

```typescript
// packages/agent/tests/send.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  makeBuildPrivateSendTxResult,
  makeMockMint,
  makeStealthAddress,
  makeCommitResult,
  makeVaultConfig,
  VALID_WALLET,
  VALID_RECIPIENT,
  VALID_STEALTH_META_ADDRESS,
  VALID_VIEWING_KEY_HEX,
  VALID_SPENDING_KEY_HEX,
  SOL_MINT,
} from './fixtures/user-tool-mocks.js'

const {
  mockBuildPrivateSendTx,
  mockCreateConnection,
  mockResolveTokenMint,
  mockGetTokenDecimals,
  mockToBaseUnits,
  mockGetVaultConfig,
  mockGetAssociatedTokenAddress,
  mockGenerateEd25519StealthAddress,
  mockEd25519PublicKeyToSolanaAddress,
  mockCommit,
} = vi.hoisted(() => ({
  mockBuildPrivateSendTx: vi.fn(),
  mockCreateConnection: vi.fn(),
  mockResolveTokenMint: vi.fn(),
  mockGetTokenDecimals: vi.fn(),
  mockToBaseUnits: vi.fn(),
  mockGetVaultConfig: vi.fn(),
  mockGetAssociatedTokenAddress: vi.fn(),
  mockGenerateEd25519StealthAddress: vi.fn(),
  mockEd25519PublicKeyToSolanaAddress: vi.fn(),
  mockCommit: vi.fn(),
}))

vi.mock('@sipher/sdk', () => ({
  createConnection: mockCreateConnection,
  buildPrivateSendTx: mockBuildPrivateSendTx,
  resolveTokenMint: mockResolveTokenMint,
  getTokenDecimals: mockGetTokenDecimals,
  toBaseUnits: mockToBaseUnits,
  fromBaseUnits: (amount: bigint, decimals: number) => {
    const divisor = 10n ** BigInt(decimals)
    const whole = amount / divisor
    const frac = amount % divisor
    return frac === 0n ? whole.toString() : `${whole}.${frac.toString().padStart(decimals, '0').replace(/0+$/, '')}`
  },
  getVaultConfig: mockGetVaultConfig,
  DEFAULT_FEE_BPS: 10,
}))

vi.mock('@sip-protocol/sdk', () => ({
  generateEd25519StealthAddress: mockGenerateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress: mockEd25519PublicKeyToSolanaAddress,
  commit: mockCommit,
}))

vi.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddress: mockGetAssociatedTokenAddress,
}))

import { sendTool, executeSend } from '../src/tools/send.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateConnection.mockReturnValue({})
  mockResolveTokenMint.mockReturnValue(makeMockMint(SOL_MINT))
  mockGetTokenDecimals.mockReturnValue(9)
  mockToBaseUnits.mockReturnValue(1_500_000_000n)
  mockGetVaultConfig.mockResolvedValue(makeVaultConfig())
  mockGetAssociatedTokenAddress.mockResolvedValue({ toBase58: () => VALID_RECIPIENT })
  mockGenerateEd25519StealthAddress.mockReturnValue(makeStealthAddress())
  mockEd25519PublicKeyToSolanaAddress.mockReturnValue(VALID_RECIPIENT)
  mockCommit.mockReturnValue(makeCommitResult())
})

describe('sendTool definition', () => {
  it('has correct name', () => {
    expect(sendTool.name).toBe('send')
  })

  it('declares required amount, token, recipient — wallet/memo optional', () => {
    expect(sendTool.input_schema.required).toEqual(['amount', 'token', 'recipient'])
    expect(sendTool.input_schema.properties).toHaveProperty('wallet')
    expect(sendTool.input_schema.properties).toHaveProperty('memo')
  })
})
```

- [ ] **Step 9.2: Add input validation tests**

Append:

```typescript
describe('executeSend — input validation', () => {
  it('rejects amount <= 0', async () => {
    await expect(
      executeSend({ amount: 0, token: 'SOL', recipient: VALID_RECIPIENT })
    ).rejects.toThrow(/amount must be greater than zero/i)
  })

  it('rejects negative amount', async () => {
    await expect(
      executeSend({ amount: -1, token: 'SOL', recipient: VALID_RECIPIENT })
    ).rejects.toThrow(/amount must be greater than zero/i)
  })

  it('rejects empty token', async () => {
    await expect(
      executeSend({ amount: 1, token: '', recipient: VALID_RECIPIENT })
    ).rejects.toThrow(/token symbol is required/i)
  })

  it('rejects empty recipient', async () => {
    await expect(
      executeSend({ amount: 1, token: 'SOL', recipient: '' })
    ).rejects.toThrow(/recipient address is required/i)
  })

  it('rejects whitespace-only recipient', async () => {
    await expect(
      executeSend({ amount: 1, token: 'SOL', recipient: '   ' })
    ).rejects.toThrow(/recipient address is required/i)
  })

  it('rejects invalid wallet base58', async () => {
    await expect(
      executeSend({
        amount: 1,
        token: 'SOL',
        recipient: VALID_RECIPIENT,
        wallet: 'not-real-!!',
      })
    ).rejects.toThrow(/invalid wallet address/i)
  })

  it('rejects invalid raw base58 recipient (when wallet provided)', async () => {
    await expect(
      executeSend({
        amount: 1,
        token: 'SOL',
        recipient: 'not-a-real-pubkey-!!',
        wallet: VALID_WALLET,
      })
    ).rejects.toThrow(/invalid recipient address/i)
  })
})

describe('executeSend — stealth meta-address validation', () => {
  it('rejects malformed sip:solana: prefix (wrong parts count)', async () => {
    await expect(
      executeSend({
        amount: 1,
        token: 'SOL',
        recipient: 'sip:solana:0xfoo', // missing :viewingKey
        wallet: VALID_WALLET,
      })
    ).rejects.toThrow(/invalid stealth meta-address/i)
  })

  it('rejects sip:solana: with empty spending key', async () => {
    await expect(
      executeSend({
        amount: 1,
        token: 'SOL',
        recipient: `sip:solana::0x${VALID_VIEWING_KEY_HEX}`,
        wallet: VALID_WALLET,
      })
    ).rejects.toThrow(/invalid stealth meta-address/i)
  })

  it('rejects keys without 0x prefix', async () => {
    await expect(
      executeSend({
        amount: 1,
        token: 'SOL',
        recipient: `sip:solana:${VALID_SPENDING_KEY_HEX}:${VALID_VIEWING_KEY_HEX}`,
        wallet: VALID_WALLET,
      })
    ).rejects.toThrow(/0x-prefixed/i)
  })
})
```

- [ ] **Step 9.3: Run validation tests**

```bash
pnpm --filter @sipher/agent test send.test.ts -- --run 2>&1 | tail -15
```

Expected: `Tests  12 passed` (2 + 7 + 3).

- [ ] **Step 9.4: Add preview path tests**

Append:

```typescript
describe('executeSend — preview path (no wallet)', () => {
  it('returns prepared shape without building tx, using on-chain feeBps', async () => {
    mockGetVaultConfig.mockResolvedValueOnce(makeVaultConfig({ feeBps: 25 }))

    const result = await executeSend({
      amount: 1.5,
      token: 'SOL',
      recipient: VALID_RECIPIENT,
    })

    expect(result.action).toBe('send')
    expect(result.amount).toBe(1.5)
    expect(result.token).toBe('SOL')
    expect(result.recipient).toBe(VALID_RECIPIENT)
    expect(result.status).toBe('awaiting_signature')
    expect(result.serializedTx).toBeNull()
    expect(result.privacy.feeBps).toBe(25)
    expect(result.privacy.stealthAddress).toBe('<derived-at-execution>')
    expect(result.privacy.netAmount).toBeNull()
    expect(result.message).toContain('0.25%') // 25 / 100
    expect(result.message).toContain('Connect wallet')
  })

  it('falls back to DEFAULT_FEE_BPS when getVaultConfig returns null', async () => {
    mockGetVaultConfig.mockResolvedValueOnce(null)

    const result = await executeSend({
      amount: 1,
      token: 'SOL',
      recipient: VALID_RECIPIENT,
    })

    expect(result.privacy.feeBps).toBe(10) // DEFAULT_FEE_BPS
  })

  it('does not call buildPrivateSendTx in preview', async () => {
    await executeSend({
      amount: 1,
      token: 'SOL',
      recipient: VALID_RECIPIENT,
    })

    expect(mockBuildPrivateSendTx).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 9.5: Run preview tests**

```bash
pnpm --filter @sipher/agent test send.test.ts -- --run 2>&1 | tail -10
```

Expected: `Tests  15 passed`.

- [ ] **Step 9.6: Add stealth-meta-address full-path tests**

Append:

```typescript
describe('executeSend — full path with stealth meta-address', () => {
  it('builds tx, derives stealth address, and computes commitment', async () => {
    mockBuildPrivateSendTx.mockResolvedValueOnce(makeBuildPrivateSendTxResult())

    const result = await executeSend({
      amount: 1.5,
      token: 'SOL',
      recipient: VALID_STEALTH_META_ADDRESS,
      wallet: VALID_WALLET,
    })

    expect(result.action).toBe('send')
    expect(result.privacy.stealthAddress).toBe(VALID_RECIPIENT)
    expect(result.privacy.commitmentGenerated).toBe(true)
    expect(result.privacy.viewingKeyHashIncluded).toBe(true)
    expect(result.privacy.estimatedFee).toContain('SOL')
    expect(result.privacy.netAmount).toBe('0.999')
    expect(result.serializedTx).toBe(
      Buffer.from('FAKE_SEND_TX_BYTES').toString('base64')
    )
    expect(result.message).toContain('Awaiting wallet signature')
  })

  it('calls generateEd25519StealthAddress with the parsed meta-address', async () => {
    mockBuildPrivateSendTx.mockResolvedValueOnce(makeBuildPrivateSendTxResult())

    await executeSend({
      amount: 1,
      token: 'SOL',
      recipient: VALID_STEALTH_META_ADDRESS,
      wallet: VALID_WALLET,
    })

    expect(mockGenerateEd25519StealthAddress).toHaveBeenCalledTimes(1)
    const arg = mockGenerateEd25519StealthAddress.mock.calls[0][0]
    expect(arg.spendingKey).toBe(`0x${VALID_SPENDING_KEY_HEX}`)
    expect(arg.viewingKey).toBe(`0x${VALID_VIEWING_KEY_HEX}`)
    expect(arg.chain).toBe('solana')
  })

  it('calls commit() to generate Pedersen commitment', async () => {
    mockBuildPrivateSendTx.mockResolvedValueOnce(makeBuildPrivateSendTxResult())

    await executeSend({
      amount: 1.5,
      token: 'SOL',
      recipient: VALID_STEALTH_META_ADDRESS,
      wallet: VALID_WALLET,
    })

    expect(mockCommit).toHaveBeenCalledTimes(1)
    expect(mockCommit).toHaveBeenCalledWith(1_500_000_000n)
  })

  it('passes encrypted amount as non-empty Uint8Array to buildPrivateSendTx', async () => {
    mockBuildPrivateSendTx.mockResolvedValueOnce(makeBuildPrivateSendTxResult())

    await executeSend({
      amount: 1,
      token: 'SOL',
      recipient: VALID_STEALTH_META_ADDRESS,
      wallet: VALID_WALLET,
    })

    const call = mockBuildPrivateSendTx.mock.calls[0][0]
    expect(call.encryptedAmount).toBeInstanceOf(Uint8Array)
    // 24 bytes nonce + 8 bytes amount + 32 bytes blinding + 16 bytes tag = 80 bytes
    expect(call.encryptedAmount.length).toBe(80)
  })
})
```

- [ ] **Step 9.7: Run stealth-path tests**

```bash
pnpm --filter @sipher/agent test send.test.ts -- --run 2>&1 | tail -10
```

Expected: `Tests  19 passed`.

- [ ] **Step 9.8: Add raw-base58 path tests**

Append:

```typescript
describe('executeSend — full path with raw base58 recipient', () => {
  it('builds tx using zero-filled crypto params', async () => {
    mockBuildPrivateSendTx.mockResolvedValueOnce(makeBuildPrivateSendTxResult())

    const result = await executeSend({
      amount: 1.5,
      token: 'SOL',
      recipient: VALID_RECIPIENT,
      wallet: VALID_WALLET,
    })

    expect(result.privacy.stealthAddress).toBe(VALID_RECIPIENT)
    expect(result.privacy.commitmentGenerated).toBe(false)
    expect(result.privacy.viewingKeyHashIncluded).toBe(false)
    expect(result.serializedTx).toBe(
      Buffer.from('FAKE_SEND_TX_BYTES').toString('base64')
    )
  })

  it('does not call generateEd25519StealthAddress for raw base58 recipient', async () => {
    mockBuildPrivateSendTx.mockResolvedValueOnce(makeBuildPrivateSendTxResult())

    await executeSend({
      amount: 1,
      token: 'SOL',
      recipient: VALID_RECIPIENT,
      wallet: VALID_WALLET,
    })

    expect(mockGenerateEd25519StealthAddress).not.toHaveBeenCalled()
    expect(mockCommit).not.toHaveBeenCalled()
  })

  it('passes empty Uint8Array for encryptedAmount in raw-base58 path', async () => {
    mockBuildPrivateSendTx.mockResolvedValueOnce(makeBuildPrivateSendTxResult())

    await executeSend({
      amount: 1,
      token: 'SOL',
      recipient: VALID_RECIPIENT,
      wallet: VALID_WALLET,
    })

    const call = mockBuildPrivateSendTx.mock.calls[0][0]
    expect(call.encryptedAmount).toBeInstanceOf(Uint8Array)
    expect(call.encryptedAmount.length).toBe(0)
  })
})

describe('executeSend — service interaction', () => {
  it('propagates buildPrivateSendTx errors', async () => {
    mockBuildPrivateSendTx.mockRejectedValueOnce(new Error('insufficient available balance'))

    await expect(
      executeSend({
        amount: 1,
        token: 'SOL',
        recipient: VALID_RECIPIENT,
        wallet: VALID_WALLET,
      })
    ).rejects.toThrow(/insufficient available balance/i)
  })

  it('uppercases token in result', async () => {
    mockBuildPrivateSendTx.mockResolvedValueOnce(makeBuildPrivateSendTxResult())

    const result = await executeSend({
      amount: 1,
      token: 'usdc',
      recipient: VALID_RECIPIENT,
      wallet: VALID_WALLET,
    })

    expect(result.token).toBe('USDC')
  })
})
```

- [ ] **Step 9.9: Run all send tests**

```bash
pnpm --filter @sipher/agent test send.test.ts -- --run 2>&1 | tail -15
```

Expected: `Tests  24 passed` (2 + 7 + 3 + 3 + 4 + 3 + 2).

- [ ] **Step 9.10: Commit**

```bash
git add packages/agent/tests/send.test.ts
git commit -m "test(phase-5): add direct unit tests for send tool

Largest tool — 24 tests covering input validation, stealth meta-address
parsing/validation (sip:solana:..., 0x prefix, parts count), preview
path with on-chain feeBps + DEFAULT_FEE_BPS fallback, full path with
stealth meta-address (generateEd25519StealthAddress + commit + encrypted
amount), full path with raw base58 (zero-filled crypto), and service
error propagation."
```

---

## Task 10: Update CLAUDE.md test counts

**Files:**
- Modify: `packages/agent/CLAUDE.md` and root `CLAUDE.md`

The new tests change agent test counts. Update CLAUDE.md to reflect the new totals (currently `938 agent tests` per memory). New count after this PR: previous 938 + 7 + 10 + 4 + 14 + 12 + 15 + 18 + 24 = ~1042 agent tests across ~83 files.

- [ ] **Step 10.1: Run full agent suite to get exact new count**

```bash
pnpm --filter @sipher/agent test -- --run 2>&1 | grep -E "Tests|Test Files"
```

Note the exact number reported.

- [ ] **Step 10.2: Find and update test count references**

Sipher repo has two CLAUDE.md files: the top-level `CLAUDE.md` at the sipher repo root, and `packages/agent/CLAUDE.md` for the agent package. Both may contain agent test counts. Grep for the previous count:

```bash
grep -rn "938 agent\|938 root\|agent tests\|test files" CLAUDE.md packages/agent/CLAUDE.md 2>/dev/null
```

For every match that refers to `938` (or whatever the previous agent test count is), update to the new exact count from Step 10.1. Use the Edit tool, not sed. If a count refers to test FILES (e.g., "75 files"), update that too — Phase 5 PR-1 adds 8 new test files plus 1 fixture file (which counts as a test-side file but vitest may or may not count it depending on whether it has a `*.test.*` suffix; it doesn't, so it won't count).

- [ ] **Step 10.3: Run typecheck and verify**

```bash
pnpm typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 10.4: Commit**

```bash
git add CLAUDE.md packages/agent/CLAUDE.md 2>/dev/null
git commit -m "docs(claude-md): update agent test counts after Phase 5 PR-1"
```

(If only one file matched, only add that one.)

---

## Task 11: Final Verification + Open PR

- [ ] **Step 11.1: Run the full root suite**

```bash
pnpm test -- --run 2>&1 | tail -10
```

Expected: `Tests  555 passed` (root suite is unchanged in this PR — Phase 5 PR-1 only adds agent tests).

- [ ] **Step 11.2: Run the full agent suite**

```bash
pnpm --filter @sipher/agent test -- --run 2>&1 | tail -10
```

Expected: `Tests  ~1042 passed` (or whatever the exact new count is).

- [ ] **Step 11.3: Run app suite**

```bash
pnpm --filter @sipher/app test -- --run 2>&1 | tail -10
```

Expected: `Tests  45 passed` (unchanged).

- [ ] **Step 11.4: Run typecheck**

```bash
pnpm typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 11.5: Push branch**

```bash
git push -u origin feat/phase-5-user-tool-tests
```

- [ ] **Step 11.6: Open PR**

```bash
gh pr create --base main --head feat/phase-5-user-tool-tests \
  --title "test(phase-5): add direct unit tests for 8 user-facing tools (PR-1 of 3)" \
  --body "$(cat <<'EOF'
## Summary

Phase 5 PR-1 of 3. Adds direct per-tool unit-level test coverage for the 8 user-facing agent tools the 2026-04-18 audit flagged as missing direct tests:

- `assess-risk`, `balance`, `claim`, `deposit`, `refund`, `scan`, `send`, `status`

Heavy service-layer mocking, real Zod parsing, real tool body, no I/O. Pattern matches `viewing-key.test.ts` (`vi.hoisted` + `vi.mock`). Zero source-code changes.

## Spec & Plan

- **Spec:** `docs/superpowers/specs/2026-05-03-phase-5-tool-unit-tests-design.md`
- **Plan:** `docs/superpowers/plans/2026-05-03-phase-5-user-tool-tests.md`

## Test counts

| Tool | New tests |
|------|-----------|
| claim | 10 |
| status | 10 |
| assess-risk | 7 |
| balance | 14 |
| refund | 12 |
| deposit | 14 |
| scan | 19 |
| send | 24 |
| **Total** | **110** |

Plus one shared fixture file (`tests/fixtures/user-tool-mocks.ts`) with data-shape factories.

## Test sheet contract (per spec)

Every new test file covers the six rows from the spec:
1. Happy path
2. Schema validation rejects bad inputs
3. Each internal branch covered
4. Service errors surface clean
5. Output shape locked
6. Spy assertion on service call

## Out of scope (PR-2 and PR-3)

- PR-2: 14 SENTINEL tools + umbrella migration
- PR-3: 7 HERALD tools

## Test plan

- [ ] CI green: test, typecheck, e2e all pass
- [ ] No regression in root suite (555 tests)
- [ ] No regression in app suite (45 tests)
- [ ] Agent suite grows by ~110 tests
- [ ] After merge: `build-and-push` and `deploy` jobs succeed (Docker fix from #163 has restored auto-deploy)
EOF
)"
```

- [ ] **Step 11.7: Watch PR CI**

```bash
sleep 5 && gh pr checks $(gh pr view --json number --jq '.number')
```

Expected: `test` job pending → success. `build-and-push` and `deploy` are SKIPPED on PRs (gated to push-on-main).

---

## Self-Review Checklist (before claiming plan complete)

When all tasks above are checked, verify:

- [ ] All 8 tool source files have a matching `<tool>.test.ts` file
- [ ] All 8 tools have at least 5 tests; complex tools have 10+
- [ ] No source files in `packages/agent/src/tools/` were modified — `git diff --stat main` shows only files under `packages/agent/tests/` (plus CLAUDE.md and the spec/plan docs)
- [ ] Root suite still passes (555 tests)
- [ ] App suite still passes (45 tests)
- [ ] Agent suite grew by approximately the planned amount
- [ ] All commits follow lowercase type-prefix convention (`test:`, `docs:`)
- [ ] No AI attribution in any commit message
- [ ] PR description references both spec and plan docs
- [ ] CI test job passed on the PR

If any item fails, fix before claiming PR-1 complete.
