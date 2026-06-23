import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
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
    getVaultBalance: vi.fn(),
    createConnection: vi.fn(() => ({})),
  }
})

import {
  getVaultBalance,
  deriveDepositRecordPDA,
  WSOL_MINT,
  SIPHER_VAULT_PROGRAM_ID,
  DEFAULT_REFUND_TIMEOUT,
} from '@sipher/sdk'
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

/** Build a "no record" VaultBalance — what getVaultBalance returns when the PDA has no on-chain account. */
function emptyBalance(mint: PublicKey) {
  return {
    depositor: new PublicKey(TEST_WALLET),
    tokenMint: mint,
    balance: 0n,
    available: 0n,
    cumulativeVolume: 0n,
    lastDepositAt: 0,
    exists: false,
  }
}

beforeEach(() => {
  vi.mocked(getVaultBalance).mockReset()
  vi.mocked(loadNetworkConfig).mockReturnValue({ clusterName: 'devnet' } as ReturnType<typeof loadNetworkConfig>)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/vault/positions', () => {
  it('returns empty positions when no records exist', async () => {
    // getVaultBalance returns exists=false (never throws) when the PDA has no account.
    vi.mocked(getVaultBalance).mockImplementation(async (_conn, _depositor, mint) =>
      emptyBalance(mint)
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
    vi.mocked(getVaultBalance).mockImplementation(async (_conn, depositor, mint) => {
      if (mint.toBase58() === WSOL_MINT.toBase58()) {
        return {
          depositor,
          tokenMint: mint,
          balance: 2_500_000_000n,
          available: 2_500_000_000n,
          cumulativeVolume: 2_500_000_000n,
          lastDepositAt: 1715000000,
          exists: true,
        }
      }
      return emptyBalance(mint)
    })

    const res = await supertest(createApp()).get('/api/vault/positions')

    expect(res.status).toBe(200)
    expect(res.body.positions).toHaveLength(1)
    expect(res.body.positions[0]).toMatchObject({
      mint: SOL_MINT,
      symbol: 'SOL',
      balance: '2500000000',
      balanceUiAmount: 2.5,
      decimals: 9,
      lastDepositAt: 1715000000,
      cooldownActive: expect.any(Boolean),
    })
    expect(typeof res.body.positions[0].refundableAt).toBe('number')
    expect(typeof res.body.positions[0].depositRecordAddress).toBe('string')
    expect(res.body.positions[0].depositRecordAddress).toBe(SOL_DEPOSIT_PDA.toBase58())
  })

  it('skips records with zero balance', async () => {
    // exists=true but balance=0 — possible after a full refund leaves the PDA closed/reopened
    // or after the data structure is initialised with no funds. Either way, route should skip.
    vi.mocked(getVaultBalance).mockImplementation(async (_conn, depositor, mint) => ({
      depositor,
      tokenMint: mint,
      balance: 0n,
      available: 0n,
      cumulativeVolume: 0n,
      lastDepositAt: 0,
      exists: true,
    }))

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
    // Real RPC error bubbles to outer catch (getVaultBalance only throws on RPC failure now).
    vi.mocked(getVaultBalance).mockRejectedValue(new Error('rpc dead'))

    const res = await supertest(createApp()).get('/api/vault/positions')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      positions: [],
      available: false,
      reason: 'rpc_unavailable',
    })
  })

  it('passes the depositor + mint (not the deposit-record PDA) to getVaultBalance', async () => {
    // Test contract pinning: getVaultBalance derives the PDA internally,
    // so we assert the route passes (depositor, mint) — NOT the PDA.
    vi.mocked(getVaultBalance).mockImplementation(async (_conn, _depositor, mint) =>
      emptyBalance(mint)
    )

    await supertest(createApp()).get('/api/vault/positions')

    expect(getVaultBalance).toHaveBeenCalled()
    const firstCallArgs = vi.mocked(getVaultBalance).mock.calls[0]
    expect(firstCallArgs[1].toBase58()).toBe(TEST_WALLET) // depositor
    expect(firstCallArgs[2].toBase58()).toBe(WSOL_MINT.toBase58()) // first mint = SOL
  })

  it('returns 401 envelope when JWT middleware did not attach req.wallet', async () => {
    const res = await supertest(createApp(null)).get('/api/vault/positions')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 400 INVALID_WALLET when wallet is not a valid base58 pubkey', async () => {
    const res = await supertest(createApp('not_a_valid_base58!!')).get('/api/vault/positions')

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_WALLET')
  })

  it('reports cooldownActive=true when lastDepositAt is recent (within DEFAULT_REFUND_TIMEOUT)', async () => {
    const fixedNowSeconds = 1_800_000_000
    vi.useFakeTimers()
    vi.setSystemTime(new Date(fixedNowSeconds * 1000))

    vi.mocked(getVaultBalance).mockImplementation(async (_conn, depositor, mint) => {
      if (mint.toBase58() === WSOL_MINT.toBase58()) {
        return {
          depositor,
          tokenMint: mint,
          balance: 1_000_000_000n,
          available: 1_000_000_000n,
          cumulativeVolume: 1_000_000_000n,
          lastDepositAt: fixedNowSeconds - 100, // 100s ago — well inside cooldown
          exists: true,
        }
      }
      return emptyBalance(mint)
    })

    const res = await supertest(createApp()).get('/api/vault/positions')

    expect(res.status).toBe(200)
    expect(res.body.positions).toHaveLength(1)
    expect(res.body.positions[0].cooldownActive).toBe(true)
    expect(res.body.positions[0].refundableAt).toBe(fixedNowSeconds - 100 + DEFAULT_REFUND_TIMEOUT)
  })

  it('reports cooldownActive=false when lastDepositAt is older than DEFAULT_REFUND_TIMEOUT', async () => {
    const fixedNowSeconds = 1_800_000_000
    vi.useFakeTimers()
    vi.setSystemTime(new Date(fixedNowSeconds * 1000))

    vi.mocked(getVaultBalance).mockImplementation(async (_conn, depositor, mint) => {
      if (mint.toBase58() === WSOL_MINT.toBase58()) {
        return {
          depositor,
          tokenMint: mint,
          balance: 1_000_000_000n,
          available: 1_000_000_000n,
          cumulativeVolume: 1_000_000_000n,
          lastDepositAt: fixedNowSeconds - DEFAULT_REFUND_TIMEOUT - 1, // just past cooldown
          exists: true,
        }
      }
      return emptyBalance(mint)
    })

    const res = await supertest(createApp()).get('/api/vault/positions')

    expect(res.status).toBe(200)
    expect(res.body.positions).toHaveLength(1)
    expect(res.body.positions[0].cooldownActive).toBe(false)
  })
})
