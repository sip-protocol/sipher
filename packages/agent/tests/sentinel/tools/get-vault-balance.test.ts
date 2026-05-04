// packages/agent/tests/sentinel/tools/get-vault-balance.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  makeParsedTokenAccount,
  VALID_WALLET,
  TOKEN_PROGRAM_ID,
  SAMPLE_TOKEN_MINT,
} from '../../fixtures/sentinel-tool-mocks.js'

const {
  mockGetBalance,
  mockGetParsedTokenAccountsByOwner,
  mockConnectionCtor,
  mockPublicKeyCtor,
} = vi.hoisted(() => ({
  mockGetBalance: vi.fn(),
  mockGetParsedTokenAccountsByOwner: vi.fn(),
  mockConnectionCtor: vi.fn(),
  mockPublicKeyCtor: vi.fn(),
}))

vi.mock('@solana/web3.js', () => ({
  Connection: mockConnectionCtor,
  PublicKey: mockPublicKeyCtor,
}))

import {
  getVaultBalanceTool,
  executeGetVaultBalance,
} from '../../../src/sentinel/tools/get-vault-balance.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockConnectionCtor.mockImplementation(() => ({
    getBalance: mockGetBalance,
    getParsedTokenAccountsByOwner: mockGetParsedTokenAccountsByOwner,
  }))
  mockPublicKeyCtor.mockImplementation((s: string) => ({ toBase58: () => s }))
})

afterEach(() => {
  delete process.env.SOLANA_RPC_URL
})

describe('getVaultBalanceTool definition', () => {
  it('has correct name', () => {
    expect(getVaultBalanceTool.name).toBe('getVaultBalance')
  })

  it('declares required wallet field', () => {
    expect(getVaultBalanceTool.input_schema.required).toEqual(['wallet'])
  })

  it('has a non-empty description', () => {
    expect(getVaultBalanceTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeGetVaultBalance — happy path', () => {
  it('returns SOL balance + token list when both RPC calls succeed', async () => {
    mockGetBalance.mockResolvedValueOnce(2_500_000_000)
    mockGetParsedTokenAccountsByOwner.mockResolvedValueOnce({
      value: [makeParsedTokenAccount(SAMPLE_TOKEN_MINT, 100)],
    })

    const r = await executeGetVaultBalance({ wallet: VALID_WALLET })

    expect(r.sol).toBeCloseTo(2.5)
    expect(r.tokens).toEqual([{ mint: SAMPLE_TOKEN_MINT, amount: 100 }])
  })

  it('maps multiple token accounts into the tokens array', async () => {
    mockGetBalance.mockResolvedValueOnce(0)
    mockGetParsedTokenAccountsByOwner.mockResolvedValueOnce({
      value: [
        makeParsedTokenAccount('mint1', 1),
        makeParsedTokenAccount('mint2', 2),
      ],
    })

    const r = await executeGetVaultBalance({ wallet: VALID_WALLET })

    expect(r.tokens).toEqual([
      { mint: 'mint1', amount: 1 },
      { mint: 'mint2', amount: 2 },
    ])
  })
})

describe('executeGetVaultBalance — branches', () => {
  it('returns empty tokens array when wallet owns no SPL accounts', async () => {
    mockGetBalance.mockResolvedValueOnce(1_000_000_000)
    mockGetParsedTokenAccountsByOwner.mockResolvedValueOnce({ value: [] })

    const r = await executeGetVaultBalance({ wallet: VALID_WALLET })

    expect(r.sol).toBeCloseTo(1)
    expect(r.tokens).toEqual([])
  })

  it('returns sol=0 when wallet has zero lamports', async () => {
    mockGetBalance.mockResolvedValueOnce(0)
    mockGetParsedTokenAccountsByOwner.mockResolvedValueOnce({ value: [] })

    const r = await executeGetVaultBalance({ wallet: VALID_WALLET })

    expect(r.sol).toBe(0)
  })
})

describe('executeGetVaultBalance — service interaction', () => {
  it('uses default mainnet RPC when SOLANA_RPC_URL is unset', async () => {
    mockGetBalance.mockResolvedValueOnce(0)
    mockGetParsedTokenAccountsByOwner.mockResolvedValueOnce({ value: [] })

    await executeGetVaultBalance({ wallet: VALID_WALLET })

    expect(mockConnectionCtor).toHaveBeenCalledWith(
      'https://api.mainnet-beta.solana.com',
      'confirmed',
    )
  })

  it('honors SOLANA_RPC_URL when set', async () => {
    process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com'
    mockGetBalance.mockResolvedValueOnce(0)
    mockGetParsedTokenAccountsByOwner.mockResolvedValueOnce({ value: [] })

    await executeGetVaultBalance({ wallet: VALID_WALLET })

    expect(mockConnectionCtor).toHaveBeenCalledWith(
      'https://api.devnet.solana.com',
      'confirmed',
    )
  })

  it('passes the SPL Token program id to getParsedTokenAccountsByOwner', async () => {
    mockGetBalance.mockResolvedValueOnce(0)
    mockGetParsedTokenAccountsByOwner.mockResolvedValueOnce({ value: [] })

    await executeGetVaultBalance({ wallet: VALID_WALLET })

    expect(mockGetParsedTokenAccountsByOwner).toHaveBeenCalledTimes(1)
    const [ownerArg, filterArg] = mockGetParsedTokenAccountsByOwner.mock.calls[0]
    expect(ownerArg.toBase58()).toBe(VALID_WALLET)
    expect(filterArg.programId.toBase58()).toBe(TOKEN_PROGRAM_ID)
  })

  it('propagates getBalance throw', async () => {
    mockGetBalance.mockRejectedValueOnce(new Error('rpc 503'))

    await expect(
      executeGetVaultBalance({ wallet: VALID_WALLET }),
    ).rejects.toThrow(/rpc 503/)
  })

  it('propagates getParsedTokenAccountsByOwner throw', async () => {
    mockGetBalance.mockResolvedValueOnce(0)
    mockGetParsedTokenAccountsByOwner.mockRejectedValueOnce(new Error('token rpc fail'))

    await expect(
      executeGetVaultBalance({ wallet: VALID_WALLET }),
    ).rejects.toThrow(/token rpc fail/)
  })
})
