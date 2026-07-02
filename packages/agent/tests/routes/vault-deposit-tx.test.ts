import { describe, expect, it, vi, beforeEach } from 'vitest'
import express, { type Request, type Response, type NextFunction } from 'express'
import supertest from 'supertest'

const TEST_WALLET = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'

// Mock loadNetworkConfig to control devnet vs mainnet
vi.mock('../../src/config/network.js', () => ({
  loadNetworkConfig: vi.fn(() => ({ clusterName: 'devnet' })),
}))

// Mock the deposit tool (executeDeposit) — backend route is a thin REST wrapper
vi.mock('../../src/tools/deposit.js', () => ({
  executeDeposit: vi.fn(),
}))

import { executeDeposit } from '../../src/tools/deposit.js'
import { loadNetworkConfig } from '../../src/config/network.js'
import { vaultDepositTxRouter } from '../../src/routes/vault-deposit-tx.js'

function mockAuth(wallet: string | null) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (wallet) (req as unknown as { wallet: string }).wallet = wallet
    next()
  }
}

function createApp(wallet: string | null = TEST_WALLET) {
  const app = express()
  app.use(express.json())
  app.use('/api/vault', mockAuth(wallet), vaultDepositTxRouter)
  return app
}

beforeEach(() => {
  vi.mocked(executeDeposit).mockReset()
  vi.mocked(loadNetworkConfig).mockReturnValue({ clusterName: 'devnet' } as ReturnType<typeof loadNetworkConfig>)
})

describe('POST /api/vault/deposit-tx', () => {
  it('returns serializedTx + metadata for a valid SOL deposit', async () => {
    vi.mocked(executeDeposit).mockResolvedValueOnce({
      action: 'deposit',
      amount: 1.5,
      token: 'SOL',
      wallet: TEST_WALLET,
      status: 'awaiting_signature',
      message: 'ok',
      serializedTx: 'BASE64SERIALIZED',
      details: {
        vaultProgram: 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB',
        depositRecordAddress: 'DEPOSITRECORDPDA',
        vaultTokenAddress: 'VAULTTOKENPDA',
        amountBaseUnits: '1500000000',
        estimatedFee: '~5000 lamports (tx fee)',
        note: 'Funds enter the shared anonymity pool.',
      },
    })

    const res = await supertest(createApp())
      .post('/api/vault/deposit-tx')
      .send({ amount: 1.5, token: 'SOL' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      serializedTx: 'BASE64SERIALIZED',
      depositRecordAddress: 'DEPOSITRECORDPDA',
      vaultTokenAddress: 'VAULTTOKENPDA',
      amountBaseUnits: '1500000000',
      network: 'devnet',
    })
    expect(typeof res.body.feeTenthsBps).toBe('number')
    expect(executeDeposit).toHaveBeenCalledWith({ amount: 1.5, token: 'SOL', wallet: TEST_WALLET })
  })

  it('returns 400 INVALID_AMOUNT when amount <= 0', async () => {
    const res = await supertest(createApp())
      .post('/api/vault/deposit-tx')
      .send({ amount: 0, token: 'SOL' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_AMOUNT')
  })

  it('returns 400 INVALID_TOKEN when token is missing', async () => {
    const res = await supertest(createApp())
      .post('/api/vault/deposit-tx')
      .send({ amount: 1, token: '' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })

  it('returns 401 envelope when JWT middleware did not attach req.wallet', async () => {
    const res = await supertest(createApp(null))
      .post('/api/vault/deposit-tx')
      .send({ amount: 1, token: 'SOL' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 409 VAULT_UNAVAILABLE on mainnet-beta', async () => {
    vi.mocked(loadNetworkConfig).mockReturnValueOnce({ clusterName: 'mainnet-beta' } as ReturnType<typeof loadNetworkConfig>)

    const res = await supertest(createApp())
      .post('/api/vault/deposit-tx')
      .send({ amount: 1.5, token: 'SOL' })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('VAULT_UNAVAILABLE')
    expect(res.body.error.message).toMatch(/devnet/i)
  })

  it('propagates SDK errors as 500 with a normalized envelope', async () => {
    vi.mocked(executeDeposit).mockRejectedValueOnce(new Error('SDK boom'))

    const res = await supertest(createApp())
      .post('/api/vault/deposit-tx')
      .send({ amount: 1.5, token: 'SOL' })

    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('INTERNAL')
    expect(res.body.error.message).toMatch(/SDK boom/)
  })

  it('normalizes lowercase token to uppercase before calling executeDeposit', async () => {
    vi.mocked(executeDeposit).mockResolvedValueOnce({
      action: 'deposit',
      amount: 0.5,
      token: 'SOL',
      wallet: TEST_WALLET,
      status: 'awaiting_signature',
      message: 'ok',
      serializedTx: 'BASE64SERIALIZED',
      details: {
        vaultProgram: 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB',
        depositRecordAddress: 'DEPOSITRECORDPDA',
        vaultTokenAddress: 'VAULTTOKENPDA',
        amountBaseUnits: '500000000',
        estimatedFee: '~5000 lamports (tx fee)',
        note: 'Funds enter the shared anonymity pool.',
      },
    })

    const res = await supertest(createApp())
      .post('/api/vault/deposit-tx')
      .send({ amount: 0.5, token: 'sol' })

    expect(res.status).toBe(200)
    expect(executeDeposit).toHaveBeenCalledWith({
      amount: 0.5,
      token: 'SOL',
      wallet: TEST_WALLET,
    })
  })
})
