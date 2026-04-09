import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import express from 'express'
import supertest from 'supertest'
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { closeDb, createPaymentLink, getPaymentLink, markPaymentLinkPaid } from '../src/db.js'

// Mock @solana/web3.js Connection to prevent real RPC calls
const mockGetTransaction = vi.fn()
vi.mock('@solana/web3.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@solana/web3.js')>()
  return {
    ...mod,
    Connection: vi.fn().mockImplementation(() => ({
      getTransaction: mockGetTransaction,
    })),
  }
})

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
  // Default: tx found, succeeded, correct address — tests override as needed
  mockGetTransaction.mockReset()
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

const { payRouter, verifyTransaction } = await import('../src/routes/pay.js')

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/pay', payRouter)
  return app
}

/** Build a mock Solana transaction response for verifyTransaction */
function mockSolanaTx(
  recipientAddress: string,
  preBalance: number,
  postBalance: number,
  opts?: { failed?: boolean },
) {
  return {
    meta: {
      err: opts?.failed ? { InstructionError: [0, 'GenericError'] } : null,
      preBalances: [1_000_000_000, preBalance],
      postBalances: [900_000_000, postBalance],
    },
    transaction: {
      message: {
        getAccountKeys: () => ({
          staticAccountKeys: [
            { toBase58: () => 'SenderAddress111111111111111111111111111111' },
            { toBase58: () => recipientAddress },
          ],
        }),
      },
    },
  }
}

describe('GET /pay/:id', () => {
  it('returns 200 with HTML for a valid pending link', async () => {
    const link = createPaymentLink({
      id: 'test-link-1',
      stealth_address: 'StEaLtH1111111111111111111111111111111111111',
      ephemeral_pubkey: '0x' + 'bb'.repeat(32),
      amount: 5.0,
      token: 'SOL',
      memo: 'Coffee payment',
      expires_at: Date.now() + 3600_000,
    })
    const app = createApp()
    const res = await supertest(app).get(`/pay/${link.id}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/html/)
    expect(res.text).toContain('5')
    expect(res.text).toContain('SOL')
    expect(res.text).toContain('Coffee payment')
  })

  it('returns 404 for non-existent link', async () => {
    const app = createApp()
    const res = await supertest(app).get('/pay/does-not-exist')
    expect(res.status).toBe(404)
  })

  it('returns expired page for expired link', async () => {
    createPaymentLink({
      id: 'expired-link',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() - 1000,
    })
    const app = createApp()
    const res = await supertest(app).get('/pay/expired-link')
    expect(res.status).toBe(410)
    expect(res.text).toMatch(/expired/i)
  })

  it('returns already-paid page for paid link', async () => {
    createPaymentLink({
      id: 'paid-link',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    markPaymentLinkPaid('paid-link', 'tx-hash-123')
    const app = createApp()
    const res = await supertest(app).get('/pay/paid-link')
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/paid|completed/i)
  })

  it('renders open-amount page when amount is null', async () => {
    createPaymentLink({
      id: 'open-link',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    const app = createApp()
    const res = await supertest(app).get('/pay/open-link')
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/any amount/i)
  })
})

describe('POST /pay/:id/confirm', () => {
  it('marks a pending link as paid after on-chain verification', async () => {
    createPaymentLink({
      id: 'confirm-test',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    // Mock: valid tx to the correct address
    mockGetTransaction.mockResolvedValueOnce(mockSolanaTx('StEaLtH1111', 0, 1_000_000))
    const app = createApp()
    const res = await supertest(app)
      .post('/pay/confirm-test/confirm')
      .send({ txSignature: '5abc...def' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const link = getPaymentLink('confirm-test')
    expect(link!.status).toBe('paid')
    expect(link!.paid_tx).toBe('5abc...def')
  })

  it('rejects double-pay', async () => {
    createPaymentLink({
      id: 'double-pay',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    markPaymentLinkPaid('double-pay', 'first-tx')
    const app = createApp()
    const res = await supertest(app)
      .post('/pay/double-pay/confirm')
      .send({ txSignature: 'second-tx' })
    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/already.*paid/i)
  })

  it('rejects confirm without txSignature', async () => {
    createPaymentLink({
      id: 'no-sig',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    const app = createApp()
    const res = await supertest(app)
      .post('/pay/no-sig/confirm')
      .send({})
    expect(res.status).toBe(400)
  })

  it('rejects confirm on expired link', async () => {
    createPaymentLink({
      id: 'expired-confirm',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() - 1000,
    })
    const app = createApp()
    const res = await supertest(app)
      .post('/pay/expired-confirm/confirm')
      .send({ txSignature: 'tx-hash' })
    expect(res.status).toBe(410)
    expect(res.body.error).toMatch(/expired/i)
  })

  it('returns 404 for non-existent link', async () => {
    const app = createApp()
    const res = await supertest(app)
      .post('/pay/nope/confirm')
      .send({ txSignature: 'tx' })
    expect(res.status).toBe(404)
  })

  it('rejects tx not found on-chain', async () => {
    createPaymentLink({
      id: 'no-tx',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    mockGetTransaction.mockResolvedValueOnce(null)
    const app = createApp()
    const res = await supertest(app)
      .post('/pay/no-tx/confirm')
      .send({ txSignature: 'fake-sig-123' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/not found on-chain/i)
    // Must NOT be marked paid
    expect(getPaymentLink('no-tx')!.status).toBe('pending')
  })

  it('rejects tx that failed on-chain', async () => {
    createPaymentLink({
      id: 'failed-tx',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    mockGetTransaction.mockResolvedValueOnce(mockSolanaTx('StEaLtH1111', 0, 0, { failed: true }))
    const app = createApp()
    const res = await supertest(app)
      .post('/pay/failed-tx/confirm')
      .send({ txSignature: 'failed-sig' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/failed on-chain/i)
    expect(getPaymentLink('failed-tx')!.status).toBe('pending')
  })

  it('rejects tx sent to wrong address', async () => {
    createPaymentLink({
      id: 'wrong-addr',
      stealth_address: 'CorrectStealthAddr1111111111111111111111111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    // Tx goes to a different address
    mockGetTransaction.mockResolvedValueOnce(mockSolanaTx('WrongAddr1111111111111111111111111111111111', 0, 5_000_000_000))
    const app = createApp()
    const res = await supertest(app)
      .post('/pay/wrong-addr/confirm')
      .send({ txSignature: 'wrong-dest-sig' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/expected address/i)
    expect(getPaymentLink('wrong-addr')!.status).toBe('pending')
  })

  it('rejects tx with insufficient amount', async () => {
    createPaymentLink({
      id: 'low-amount',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      amount: 5.0,
      expires_at: Date.now() + 3600_000,
    })
    // Only 1 SOL received when 5 expected
    mockGetTransaction.mockResolvedValueOnce(mockSolanaTx('StEaLtH1111', 0, 1 * LAMPORTS_PER_SOL))
    const app = createApp()
    const res = await supertest(app)
      .post('/pay/low-amount/confirm')
      .send({ txSignature: 'low-amount-sig' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/insufficient amount/i)
    expect(getPaymentLink('low-amount')!.status).toBe('pending')
  })

  it('accepts tx when amount is null (any-amount link)', async () => {
    createPaymentLink({
      id: 'any-amount',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    // Any amount — just needs correct address
    mockGetTransaction.mockResolvedValueOnce(mockSolanaTx('StEaLtH1111', 0, 100_000))
    const app = createApp()
    const res = await supertest(app)
      .post('/pay/any-amount/confirm')
      .send({ txSignature: 'any-amount-sig' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(getPaymentLink('any-amount')!.status).toBe('paid')
  })

  it('fails open when RPC is unreachable', async () => {
    createPaymentLink({
      id: 'rpc-down',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    // Simulate RPC failure
    mockGetTransaction.mockRejectedValueOnce(new Error('fetch failed'))
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const app = createApp()
    const res = await supertest(app)
      .post('/pay/rpc-down/confirm')
      .send({ txSignature: 'rpc-down-sig' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(getPaymentLink('rpc-down')!.status).toBe('paid')
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[pay] on-chain verification failed'),
      expect.stringContaining('fetch failed'),
    )
    consoleSpy.mockRestore()
  })
})

describe('verifyTransaction (unit)', () => {
  it('returns valid for correct tx', async () => {
    mockGetTransaction.mockResolvedValueOnce(mockSolanaTx('TestAddr', 0, 5 * LAMPORTS_PER_SOL))
    const result = await verifyTransaction('sig', 'TestAddr', 5.0)
    expect(result).toEqual({ valid: true })
  })

  it('returns invalid when tx is null', async () => {
    mockGetTransaction.mockResolvedValueOnce(null)
    const result = await verifyTransaction('sig', 'TestAddr', null)
    expect(result).toEqual({ valid: false, error: 'transaction not found on-chain' })
  })

  it('returns invalid when tx has error', async () => {
    mockGetTransaction.mockResolvedValueOnce(mockSolanaTx('TestAddr', 0, 0, { failed: true }))
    const result = await verifyTransaction('sig', 'TestAddr', null)
    expect(result).toEqual({ valid: false, error: 'transaction failed on-chain' })
  })

  it('returns invalid when address not in tx', async () => {
    mockGetTransaction.mockResolvedValueOnce(mockSolanaTx('OtherAddr', 0, 5 * LAMPORTS_PER_SOL))
    const result = await verifyTransaction('sig', 'ExpectedAddr', null)
    expect(result).toEqual({ valid: false, error: 'transaction does not involve the expected address' })
  })

  it('allows 1% tolerance on amount', async () => {
    // 4.96 SOL received, 5.0 expected — within 1% tolerance (4.95 is threshold)
    mockGetTransaction.mockResolvedValueOnce(mockSolanaTx('Addr', 0, 4.96 * LAMPORTS_PER_SOL))
    const result = await verifyTransaction('sig', 'Addr', 5.0)
    expect(result).toEqual({ valid: true })
  })

  it('rejects below 1% tolerance', async () => {
    // 4.9 SOL received, 5.0 expected — below 99% threshold
    mockGetTransaction.mockResolvedValueOnce(mockSolanaTx('Addr', 0, 4.9 * LAMPORTS_PER_SOL))
    const result = await verifyTransaction('sig', 'Addr', 5.0)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/insufficient amount/)
  })

  it('fails open on RPC error', async () => {
    mockGetTransaction.mockRejectedValueOnce(new Error('network timeout'))
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await verifyTransaction('sig', 'Addr', 1.0)
    expect(result).toEqual({ valid: true })
    consoleSpy.mockRestore()
  })
})
