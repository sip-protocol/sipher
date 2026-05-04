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
