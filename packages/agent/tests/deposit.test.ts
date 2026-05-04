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
