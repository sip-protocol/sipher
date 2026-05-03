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

  it('propagates getVaultBalance errors', async () => {
    mockGetVaultBalance.mockRejectedValueOnce(new Error('rpc unavailable'))

    await expect(
      executeBalance({ token: 'SOL', wallet: VALID_WALLET })
    ).rejects.toThrow(/rpc unavailable/i)
  })
})
