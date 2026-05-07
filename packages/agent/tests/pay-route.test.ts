import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import express from 'express'
import supertest from 'supertest'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { closeDb, createPaymentLink, getPaymentLink, markPaymentLinkPaid } from '../src/db.js'
import { guardianBus, type GuardianEvent } from '../src/coordination/event-bus.js'

// Mock @solana/web3.js Connection to prevent real RPC calls.
// Each `new Connection(...)` returns a fresh object whose `getTransaction`
// points at the same `mockGetTransaction` fn, so chained
// `mockResolvedValueOnce`/`mockRejectedValueOnce` calls drive primary then
// fallback verifyOnConnection invocations in order.
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

beforeEach(async () => {
  process.env.DB_PATH = ':memory:'
  // Default: tx found, succeeded, correct address — tests override as needed
  mockGetTransaction.mockReset()
  delete process.env.SOLANA_RPC_URL_FALLBACK
  await _resetPayRateLimitForTests()
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
  delete process.env.SOLANA_RPC_URL_FALLBACK
})

const { payRouter, verifyTransaction, _resetPayRateLimitForTests } = await import('../src/routes/pay.js')

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

  it('fails closed with 503 when RPC is unreachable and no fallback is configured', async () => {
    createPaymentLink({
      id: 'rpc-down',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    // Simulate RPC failure
    mockGetTransaction.mockRejectedValueOnce(new Error('fetch failed'))
    const app = createApp()
    const res = await supertest(app)
      .post('/pay/rpc-down/confirm')
      .send({ txSignature: 'rpc-down-sig' })
    expect(res.status).toBe(503)
    expect(res.body.error).toEqual({
      code: 'RPC_UNAVAILABLE',
      message: 'On-chain verification temporarily unavailable, please retry shortly',
    })
    // Critical: must NOT mark paid on RPC error — that was the money-at-risk bug.
    expect(getPaymentLink('rpc-down')!.status).toBe('pending')
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

  it('throws on RPC error when no fallback is configured', async () => {
    mockGetTransaction.mockRejectedValueOnce(new Error('network timeout'))
    await expect(verifyTransaction('sig', 'Addr', 1.0)).rejects.toThrow('network timeout')
  })
})

describe('POST /pay/:id/confirm — RPC fallback + rate limit', () => {
  /**
   * Capture guardianBus events of a given type for the duration of a test.
   * Returns the array of captured events plus a cleanup fn that removes the
   * listener. Always call `cleanup()` (even on assertion failure paths) so
   * the bus doesn't leak listeners between tests.
   */
  function captureBusEvents(eventType: string): { events: GuardianEvent[]; cleanup: () => void } {
    const events: GuardianEvent[] = []
    const handler = (event: GuardianEvent): void => {
      events.push(event)
    }
    guardianBus.on(eventType, handler)
    return {
      events,
      cleanup: () => guardianBus.off(eventType, handler),
    }
  }

  it('falls back to secondary RPC when primary fails', async () => {
    process.env.SOLANA_RPC_URL_FALLBACK = 'https://fallback.example.com'
    createPaymentLink({
      id: 'fallback-success',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    // Primary throws; fallback returns a valid tx to the correct address.
    mockGetTransaction
      .mockRejectedValueOnce(new Error('primary down'))
      .mockResolvedValueOnce(mockSolanaTx('StEaLtH1111', 0, 1_000_000))

    const fallbackCapture = captureBusEvents('pay:rpc-fallback-used')
    const allFailedCapture = captureBusEvents('pay:rpc-all-failed')

    try {
      const app = createApp()
      const res = await supertest(app)
        .post('/pay/fallback-success/confirm')
        .send({ txSignature: 'sig-fallback' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(getPaymentLink('fallback-success')!.status).toBe('paid')
      expect(getPaymentLink('fallback-success')!.paid_tx).toBe('sig-fallback')

      // Operator visibility: fallback used → important event emitted, no critical.
      expect(fallbackCapture.events).toHaveLength(1)
      expect(fallbackCapture.events[0]).toMatchObject({
        source: 'sipher',
        type: 'pay:rpc-fallback-used',
        level: 'important',
        wallet: null,
      })
      expect(fallbackCapture.events[0].data).toMatchObject({
        txSignature: 'sig-fallback',
        primaryErr: 'primary down',
      })
      expect(fallbackCapture.events[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(allFailedCapture.events).toHaveLength(0)
    } finally {
      fallbackCapture.cleanup()
      allFailedCapture.cleanup()
    }
  })

  it('returns 503 RPC_UNAVAILABLE when both primary and fallback fail', async () => {
    process.env.SOLANA_RPC_URL_FALLBACK = 'https://fallback.example.com'
    createPaymentLink({
      id: 'both-down',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    mockGetTransaction
      .mockRejectedValueOnce(new Error('primary down'))
      .mockRejectedValueOnce(new Error('fallback down'))

    const allFailedCapture = captureBusEvents('pay:rpc-all-failed')
    const fallbackCapture = captureBusEvents('pay:rpc-fallback-used')

    try {
      const app = createApp()
      const res = await supertest(app)
        .post('/pay/both-down/confirm')
        .send({ txSignature: 'sig-both-down' })

      expect(res.status).toBe(503)
      expect(res.body.error).toEqual({
        code: 'RPC_UNAVAILABLE',
        message: 'On-chain verification temporarily unavailable, please retry shortly',
      })
      // Link must NOT be marked paid — that's the money-at-risk invariant.
      expect(getPaymentLink('both-down')!.status).toBe('pending')

      expect(allFailedCapture.events).toHaveLength(1)
      expect(allFailedCapture.events[0]).toMatchObject({
        source: 'sipher',
        type: 'pay:rpc-all-failed',
        level: 'critical',
        wallet: null,
      })
      expect(allFailedCapture.events[0].data).toMatchObject({
        txSignature: 'sig-both-down',
        primaryErr: 'primary down',
        fallbackErr: 'fallback down',
      })
      expect(allFailedCapture.events[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(fallbackCapture.events).toHaveLength(0)
    } finally {
      allFailedCapture.cleanup()
      fallbackCapture.cleanup()
    }
  })

  it('returns 503 with fallbackUrl=unset when primary fails and no fallback configured', async () => {
    // SOLANA_RPC_URL_FALLBACK is deleted in beforeEach.
    createPaymentLink({
      id: 'no-fallback',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    mockGetTransaction.mockRejectedValueOnce(new Error('primary nuked'))

    const allFailedCapture = captureBusEvents('pay:rpc-all-failed')

    try {
      const app = createApp()
      const res = await supertest(app)
        .post('/pay/no-fallback/confirm')
        .send({ txSignature: 'sig-no-fallback' })

      expect(res.status).toBe(503)
      expect(res.body.error.code).toBe('RPC_UNAVAILABLE')
      expect(getPaymentLink('no-fallback')!.status).toBe('pending')

      expect(allFailedCapture.events).toHaveLength(1)
      expect(allFailedCapture.events[0].data).toMatchObject({
        txSignature: 'sig-no-fallback',
        primaryErr: 'primary nuked',
        fallbackUrl: 'unset',
      })
    } finally {
      allFailedCapture.cleanup()
    }
  })

  it('per-link rate limit returns 429 on the 4th attempt within a minute', async () => {
    createPaymentLink({
      id: 'rate-limited',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    // Verifier returns "tx not found" → 400, link stays pending, rate counter ticks.
    mockGetTransaction.mockResolvedValue(null)
    const app = createApp()

    for (let i = 0; i < 3; i++) {
      const res = await supertest(app)
        .post('/pay/rate-limited/confirm')
        .send({ txSignature: `attempt-${i}` })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/not found on-chain/i)
    }
    expect(getPaymentLink('rate-limited')!.status).toBe('pending')

    // Pre-load the verifier mock to fail loudly if the 4th request reaches it.
    // It MUST be short-circuited at the rate-limit gate before verifyTransaction runs.
    mockGetTransaction.mockImplementationOnce(() => {
      throw new Error('rate-limit gate failed to short-circuit')
    })
    const fourth = await supertest(app)
      .post('/pay/rate-limited/confirm')
      .send({ txSignature: 'attempt-4' })

    expect(fourth.status).toBe(429)
    expect(fourth.body.error).toEqual({
      code: 'RATE_LIMITED',
      message: 'Too many confirmation attempts on this link, slow down',
    })
    expect(getPaymentLink('rate-limited')!.status).toBe('pending')
  })

  it('per-link rate limit isolates different links (link-A exhausted, link-B succeeds)', async () => {
    createPaymentLink({
      id: 'link-A',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    createPaymentLink({
      id: 'link-B',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    const app = createApp()

    // Burn link-A's budget — 3 attempts that each fail at the verifier (400).
    mockGetTransaction.mockResolvedValue(null)
    for (let i = 0; i < 3; i++) {
      const res = await supertest(app)
        .post('/pay/link-A/confirm')
        .send({ txSignature: `link-A-attempt-${i}` })
      expect(res.status).toBe(400)
    }

    // 4th attempt on link-A is 429 (budget exhausted).
    const fourth = await supertest(app)
      .post('/pay/link-A/confirm')
      .send({ txSignature: 'link-A-attempt-3' })
    expect(fourth.status).toBe(429)

    // link-B has its own independent budget — first attempt succeeds with a valid tx.
    mockGetTransaction.mockReset()
    mockGetTransaction.mockResolvedValueOnce(mockSolanaTx('StEaLtH1111', 0, 1_000_000))
    const linkB = await supertest(app)
      .post('/pay/link-B/confirm')
      .send({ txSignature: 'link-B-sig' })
    expect(linkB.status).toBe(200)
    expect(linkB.body.success).toBe(true)
    expect(getPaymentLink('link-B')!.status).toBe('paid')
  })
})
