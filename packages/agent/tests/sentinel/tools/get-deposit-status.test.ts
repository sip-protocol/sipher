// packages/agent/tests/sentinel/tools/get-deposit-status.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  makeAccountInfo,
  VALID_PDA,
} from '../../fixtures/sentinel-tool-mocks.js'

const {
  mockGetAccountInfo,
  mockConnectionCtor,
  mockPublicKeyCtor,
} = vi.hoisted(() => ({
  mockGetAccountInfo: vi.fn(),
  mockConnectionCtor: vi.fn(),
  mockPublicKeyCtor: vi.fn(),
}))

vi.mock('@solana/web3.js', () => ({
  Connection: mockConnectionCtor,
  PublicKey: mockPublicKeyCtor,
}))

import {
  getDepositStatusTool,
  executeGetDepositStatus,
} from '../../../src/sentinel/tools/get-deposit-status.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockConnectionCtor.mockImplementation(() => ({ getAccountInfo: mockGetAccountInfo }))
  mockPublicKeyCtor.mockImplementation((s: string) => ({ toBase58: () => s }))
})

afterEach(() => {
  delete process.env.SOLANA_RPC_URL
})

describe('getDepositStatusTool definition', () => {
  it('has correct name', () => {
    expect(getDepositStatusTool.name).toBe('getDepositStatus')
  })

  it('declares required pda field', () => {
    expect(getDepositStatusTool.input_schema.required).toEqual(['pda'])
  })

  it('has a non-empty description', () => {
    expect(getDepositStatusTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeGetDepositStatus — branches', () => {
  it('returns status=active with lamports/1e9 amount when account exists', async () => {
    mockGetAccountInfo.mockResolvedValueOnce(makeAccountInfo({ lamports: 2_500_000_000 }))

    const r = await executeGetDepositStatus({ pda: VALID_PDA })

    expect(r.status).toBe('active')
    expect(r.amount).toBeCloseTo(2.5)
    expect(r.createdAt).toBeNull()
    expect(r.expiresAt).toBeNull()
  })

  it('returns status=refunded with amount=null when account is null', async () => {
    mockGetAccountInfo.mockResolvedValueOnce(null)

    const r = await executeGetDepositStatus({ pda: VALID_PDA })

    expect(r.status).toBe('refunded')
    expect(r.amount).toBeNull()
    expect(r.createdAt).toBeNull()
    expect(r.expiresAt).toBeNull()
  })
})

describe('executeGetDepositStatus — service interaction', () => {
  it('uses default mainnet RPC when SOLANA_RPC_URL is unset', async () => {
    mockGetAccountInfo.mockResolvedValueOnce(null)

    await executeGetDepositStatus({ pda: VALID_PDA })

    expect(mockConnectionCtor).toHaveBeenCalledTimes(1)
    expect(mockConnectionCtor).toHaveBeenCalledWith(
      'https://api.mainnet-beta.solana.com',
      'confirmed',
    )
  })

  it('honors SOLANA_RPC_URL when set', async () => {
    process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com'
    mockGetAccountInfo.mockResolvedValueOnce(null)

    await executeGetDepositStatus({ pda: VALID_PDA })

    expect(mockConnectionCtor).toHaveBeenCalledWith(
      'https://api.devnet.solana.com',
      'confirmed',
    )
  })

  it('constructs PublicKey from the supplied pda string', async () => {
    mockGetAccountInfo.mockResolvedValueOnce(null)

    await executeGetDepositStatus({ pda: VALID_PDA })

    expect(mockPublicKeyCtor).toHaveBeenCalledTimes(1)
    expect(mockPublicKeyCtor).toHaveBeenCalledWith(VALID_PDA)
  })

  it('propagates getAccountInfo throw', async () => {
    mockGetAccountInfo.mockRejectedValueOnce(new Error('rpc unavailable'))

    await expect(
      executeGetDepositStatus({ pda: VALID_PDA }),
    ).rejects.toThrow(/rpc unavailable/)
  })
})
