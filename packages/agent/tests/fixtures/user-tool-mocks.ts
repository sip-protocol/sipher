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
