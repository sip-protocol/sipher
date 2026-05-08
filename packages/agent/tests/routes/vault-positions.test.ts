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

import { fetchDepositRecord, deriveDepositRecordPDA, WSOL_MINT, SIPHER_VAULT_PROGRAM_ID } from '@sipher/sdk'
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

// Pre-compute SOL deposit record PDA for TEST_WALLET (matches what the route derives).
const [SOL_DEPOSIT_PDA] = deriveDepositRecordPDA(
  new PublicKey(TEST_WALLET),
  WSOL_MINT,
  SIPHER_VAULT_PROGRAM_ID
)

beforeEach(() => {
  vi.mocked(fetchDepositRecord).mockReset()
  vi.mocked(loadNetworkConfig).mockReturnValue({ clusterName: 'devnet' } as ReturnType<typeof loadNetworkConfig>)
})

describe('GET /api/vault/positions', () => {
  it('returns empty positions when no records exist', async () => {
    // Real SDK throws "DepositRecord not found at <pda>" when the account does not exist.
    // Route swallows this per-mint as "no deposit for this token".
    vi.mocked(fetchDepositRecord).mockRejectedValue(
      new Error('DepositRecord not found at SomePDA')
    )

    const res = await supertest(createApp()).get('/api/vault/positions')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      positions: [],
      network: 'devnet',
      available: true,
    })
  })

  it('returns one row per non-zero deposit_record', async () => {
    vi.mocked(fetchDepositRecord).mockImplementation(async (_conn, pda) => {
      if (pda.toBase58() === SOL_DEPOSIT_PDA.toBase58()) {
        return {
          depositor: new PublicKey(TEST_WALLET),
          tokenMint: new PublicKey(SOL_MINT),
          balance: 2_500_000_000n,
          lockedAmount: 0n,
          cumulativeVolume: 2_500_000_000n,
          lastDepositAt: 1715000000,
          bump: 255,
        }
      }
      throw new Error('DepositRecord not found at OtherPDA')
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
    expect(res.body.positions[0].depositRecordAddress).toBe(SOL_DEPOSIT_PDA.toBase58())
  })

  it('skips records with zero balance', async () => {
    vi.mocked(fetchDepositRecord).mockResolvedValue({
      depositor: new PublicKey(TEST_WALLET),
      tokenMint: new PublicKey(SOL_MINT),
      balance: 0n,
      lockedAmount: 0n,
      cumulativeVolume: 0n,
      lastDepositAt: 0,
      bump: 255,
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
    // Real RPC error (NOT a "not found" message) — bubbles to outer catch.
    vi.mocked(fetchDepositRecord).mockRejectedValue(new Error('rpc dead'))

    const res = await supertest(createApp()).get('/api/vault/positions')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      positions: [],
      available: false,
      reason: 'rpc_unavailable',
    })
  })

  it('passes the deposit-record PDA (not the depositor or mint) to fetchDepositRecord', async () => {
    // Test contract pinning (Task 2 review I-1/I-2 lesson):
    // assert what the SDK was called with, not just that it was called.
    vi.mocked(fetchDepositRecord).mockRejectedValue(
      new Error('DepositRecord not found at X')
    )

    await supertest(createApp()).get('/api/vault/positions')

    expect(fetchDepositRecord).toHaveBeenCalled()
    // First call's second arg should be the SOL deposit-record PDA (not the depositor).
    const firstCallArgs = vi.mocked(fetchDepositRecord).mock.calls[0]
    expect(firstCallArgs[1].toBase58()).toBe(SOL_DEPOSIT_PDA.toBase58())
  })
})
