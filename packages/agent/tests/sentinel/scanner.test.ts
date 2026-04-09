import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock declarations (no external refs — vi.mock is hoisted) ──────────────

const getVaultBalanceMock = vi.fn()
const scanForPaymentsMock = vi.fn()
const createConnectionMock = vi.fn(() => ({}))

vi.mock('@sipher/sdk', () => {
  // PublicKey-like stub — just needs .toBase58() and .toBuffer() to not throw
  // The scanner only reads VaultBalance.balance (bigint) from the result
  const { PublicKey } = require('@solana/web3.js')
  return {
    createConnection: createConnectionMock,
    getVaultBalance: getVaultBalanceMock,
    scanForPayments: scanForPaymentsMock,
    WSOL_MINT: new PublicKey('So11111111111111111111111111111111111111112'),
  }
})

vi.mock('../../src/sentinel/config.js', () => ({
  getSentinelConfig: vi.fn(() => ({
    scanInterval: 60000,
    activeScanInterval: 15000,
    autoRefundThreshold: 1,
    threatCheckEnabled: true,
    largeTransferThreshold: 10,
    maxRpcPerWallet: 5,
    maxWalletsPerCycle: 20,
    backoffMax: 600_000,
  })),
}))

const { scanWallet } = await import('../../src/sentinel/scanner.js')

// ─── Shared fixtures ────────────────────────────────────────────────────────

import { PublicKey } from '@solana/web3.js'

const WSOL = new PublicKey('So11111111111111111111111111111111111111112')
const TEST_WALLET = '11111111111111111111111111111111'
const DEPOSITOR = new PublicKey(TEST_WALLET)

function makeVaultBalance(lamports = 5_000_000_000n) {
  return {
    depositor: DEPOSITOR,
    tokenMint: WSOL,
    balance: lamports,
    lockedAmount: 0n,
    available: lamports,
    cumulativeVolume: 10_000_000_000n,
    lastDepositAt: 1712600000,
    exists: true,
  }
}

const cleanScanResult = {
  payments: [],
  eventsScanned: 0,
  hasMore: false,
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('scanWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getVaultBalanceMock.mockResolvedValue(makeVaultBalance())
    scanForPaymentsMock.mockResolvedValue(cleanScanResult)
  })

  it('returns ScanResult with vaultBalance converted from lamports to SOL', async () => {
    const result = await scanWallet(TEST_WALLET)

    expect(result.wallet).toBe(TEST_WALLET)
    expect(result.vaultBalance).toBeCloseTo(5.0, 6)
    expect(result.detections).toBeInstanceOf(Array)
    expect(result.rpcCalls).toBeGreaterThan(0)
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('detects balance change when previousBalance differs from current', async () => {
    const result = await scanWallet(TEST_WALLET, { previousBalance: 3.0 })

    const balanceDetection = result.detections.find(
      (d) => d.event === 'sentinel:balance'
    )
    expect(balanceDetection).toBeDefined()
    expect(balanceDetection?.data.previousBalance).toBe(3.0)
    expect(balanceDetection?.data.currentBalance).toBeCloseTo(5.0, 6)
    expect(balanceDetection?.data.delta).toBeCloseTo(2.0, 6)
  })

  it('does not emit balance detection when previousBalance matches current', async () => {
    const result = await scanWallet(TEST_WALLET, { previousBalance: 5.0 })

    const balanceDetection = result.detections.find(
      (d) => d.event === 'sentinel:balance'
    )
    expect(balanceDetection).toBeUndefined()
  })

  it('returns empty detections on clean scan with no previousBalance', async () => {
    const result = await scanWallet(TEST_WALLET)

    expect(result.detections).toHaveLength(0)
  })

  it('emits unclaimed detection for each stealth payment found', async () => {
    const ephKey = new Uint8Array(33).fill(2)

    scanForPaymentsMock.mockResolvedValue({
      payments: [
        {
          stealthAddress: DEPOSITOR,
          amountCommitment: new Uint8Array(33),
          ephemeralPubkey: ephKey,
          viewingKeyHash: new Uint8Array(32),
          transferAmount: 1_000_000_000n,
          feeAmount: 1_000n,
          timestamp: 1712600000,
          txSignature: 'abc123',
        },
      ],
      eventsScanned: 1,
      hasMore: false,
    })

    // Viewing + spending keys are required to trigger stealth payment scanning
    const result = await scanWallet(TEST_WALLET, {
      viewingPrivateKey: new Uint8Array(32).fill(1),
      spendingPrivateKey: new Uint8Array(32).fill(2),
    })

    const unclaimedDetection = result.detections.find(
      (d) => d.event === 'sentinel:unclaimed'
    )
    expect(unclaimedDetection).toBeDefined()
    expect(unclaimedDetection?.level).toBe('important')
    expect(unclaimedDetection?.data.amount).toBeCloseTo(1.0, 6)
  })

  it('respects maxRpcCalls limit — stops early when budget exhausted', async () => {
    const result = await scanWallet(TEST_WALLET, { maxRpcCalls: 1 })

    expect(result.rpcCalls).toBeLessThanOrEqual(1)
  })

  it('does not crash when getVaultBalance throws — returns zero balance', async () => {
    getVaultBalanceMock.mockRejectedValue(new Error('RPC timeout'))

    const result = await scanWallet(TEST_WALLET)

    expect(result.vaultBalance).toBe(0)
    expect(result.wallet).toBe(TEST_WALLET)
    expect(result.detections).toBeInstanceOf(Array)
  })

  it('does not crash when scanForPayments throws — returns partial result', async () => {
    scanForPaymentsMock.mockRejectedValue(new Error('RPC error'))

    const result = await scanWallet(TEST_WALLET)

    expect(result.vaultBalance).toBeCloseTo(5.0, 6)
    expect(result.detections).toBeInstanceOf(Array)
  })
})
