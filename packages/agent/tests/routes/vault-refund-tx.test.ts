import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import express, { type Request, type Response, type NextFunction } from 'express'
import supertest from 'supertest'
import { PublicKey, Transaction } from '@solana/web3.js'

const TEST_WALLET = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'

vi.mock('../../src/config/network.js', () => ({
  loadNetworkConfig: vi.fn(() => ({ clusterName: 'devnet' })),
}))

vi.mock('@sipher/sdk', async () => {
  const actual = await vi.importActual<typeof import('@sipher/sdk')>('@sipher/sdk')
  return {
    ...actual,
    getVaultBalance: vi.fn(),
    buildRefundTx: vi.fn(),
    createConnection: vi.fn(() => ({})),
  }
})

import {
  getVaultBalance,
  buildRefundTx,
  WSOL_MINT,
  DEFAULT_REFUND_TIMEOUT,
} from '@sipher/sdk'
import { loadNetworkConfig } from '../../src/config/network.js'
import { vaultRefundTxRouter } from '../../src/routes/vault-refund-tx.js'

function mockAuth(wallet: string | null) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (wallet) (req as unknown as { wallet: string }).wallet = wallet
    next()
  }
}

function createApp(wallet: string | null = TEST_WALLET) {
  const app = express()
  app.use(express.json())
  app.use('/api/vault', mockAuth(wallet), vaultRefundTxRouter)
  return app
}

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const NOW_SECONDS = 1_800_000_000

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

/** Build a "cooldown elapsed" VaultBalance — last deposit just past the timeout window. */
function cooledBalance(mint: PublicKey, balance: bigint = 1_500_000_000n) {
  return {
    depositor: new PublicKey(TEST_WALLET),
    tokenMint: mint,
    balance,
    available: balance,
    cumulativeVolume: balance,
    lastDepositAt: NOW_SECONDS - DEFAULT_REFUND_TIMEOUT - 10, // 10s past cooldown
    exists: true,
  }
}

beforeEach(() => {
  vi.mocked(getVaultBalance).mockReset()
  vi.mocked(buildRefundTx).mockReset()
  vi.mocked(loadNetworkConfig).mockReturnValue({ clusterName: 'devnet' } as ReturnType<typeof loadNetworkConfig>)
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW_SECONDS * 1000))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('POST /api/vault/refund-tx', () => {
  it('returns serializedTx + refundAmount when balance > 0 and cooldown elapsed', async () => {
    vi.mocked(getVaultBalance).mockImplementation(async (_conn, _depositor, mint) =>
      cooledBalance(mint, 1_500_000_000n)
    )

    const fakeTx = new Transaction()
    // Stub serialize so we don't need a real blockhash / instruction
    const serialized = Buffer.from('FAKE_REFUND_TX_BYTES')
    vi.spyOn(fakeTx, 'serialize').mockReturnValue(serialized)

    vi.mocked(buildRefundTx).mockResolvedValueOnce({
      transaction: fakeTx,
      refundAmount: 1_500_000_000n,
      depositorTokenAddress: new PublicKey(TEST_WALLET),
    })

    const res = await supertest(createApp())
      .post('/api/vault/refund-tx')
      .send({ token: 'SOL' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      serializedTx: serialized.toString('base64'),
      refundAmount: '1500000000',
      network: 'devnet',
    })

    // Verify buildRefundTx was called with depositor + mint (NOT the PDA)
    expect(buildRefundTx).toHaveBeenCalled()
    const args = vi.mocked(buildRefundTx).mock.calls[0]
    expect(args[1].toBase58()).toBe(TEST_WALLET) // depositor
    expect(args[2].toBase58()).toBe(SOL_MINT)    // tokenMint = wSOL
  })

  it('returns 404 NOT_FOUND when no deposit record exists', async () => {
    vi.mocked(getVaultBalance).mockImplementation(async (_conn, _depositor, mint) =>
      emptyBalance(mint)
    )

    const res = await supertest(createApp())
      .post('/api/vault/refund-tx')
      .send({ token: 'SOL' })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
    expect(buildRefundTx).not.toHaveBeenCalled()
  })

  it('returns 404 NOT_FOUND when balance is zero', async () => {
    // exists=true but balance=0 — possible after full refund leaves the PDA closed/reopened.
    vi.mocked(getVaultBalance).mockImplementation(async (_conn, depositor, mint) => ({
      depositor,
      tokenMint: mint,
      balance: 0n,
      available: 0n,
      cumulativeVolume: 0n,
      lastDepositAt: NOW_SECONDS - DEFAULT_REFUND_TIMEOUT - 10,
      exists: true,
    }))

    const res = await supertest(createApp())
      .post('/api/vault/refund-tx')
      .send({ token: 'SOL' })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
    expect(buildRefundTx).not.toHaveBeenCalled()
  })

  it('returns 409 COOLDOWN_ACTIVE with secondsRemaining when within 24h window', async () => {
    const lastDepositAt = NOW_SECONDS - 100 // 100s ago — well inside cooldown
    vi.mocked(getVaultBalance).mockImplementation(async (_conn, depositor, mint) => ({
      depositor,
      tokenMint: mint,
      balance: 1_000_000_000n,
      available: 1_000_000_000n,
      cumulativeVolume: 1_000_000_000n,
      lastDepositAt,
      exists: true,
    }))

    const res = await supertest(createApp())
      .post('/api/vault/refund-tx')
      .send({ token: 'SOL' })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('COOLDOWN_ACTIVE')
    expect(res.body.error.secondsRemaining).toBe(DEFAULT_REFUND_TIMEOUT - 100)
    expect(res.body.error.refundableAt).toBe(lastDepositAt + DEFAULT_REFUND_TIMEOUT)
    expect(buildRefundTx).not.toHaveBeenCalled()
  })

  it('returns 401 envelope when JWT did not attach req.wallet', async () => {
    const res = await supertest(createApp(null))
      .post('/api/vault/refund-tx')
      .send({ token: 'SOL' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 409 VAULT_UNAVAILABLE on mainnet-beta', async () => {
    vi.mocked(loadNetworkConfig).mockReturnValueOnce({ clusterName: 'mainnet-beta' } as ReturnType<typeof loadNetworkConfig>)

    const res = await supertest(createApp())
      .post('/api/vault/refund-tx')
      .send({ token: 'SOL' })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('VAULT_UNAVAILABLE')
    expect(res.body.error.message).toMatch(/devnet/i)
    expect(getVaultBalance).not.toHaveBeenCalled()
    expect(buildRefundTx).not.toHaveBeenCalled()
  })
})
