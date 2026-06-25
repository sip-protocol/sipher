import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { PublicKey, Keypair } from '@solana/web3.js'

// Generate a valid test address
const testKeypair = Keypair.generate()
const testAddress = testKeypair.publicKey.toBase58()

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation(function () { return ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
      getSignaturesForAddress: vi.fn().mockResolvedValue([]),
      getTransaction: vi.fn().mockResolvedValue(null),
    }) }),
  }
})

const { default: app } = await import('../src/server.js')

describe('POST /v1/privacy/score', () => {
  it('returns privacy score for a valid address with no history', async () => {
    const res = await request(app)
      .post('/v1/privacy/score')
      .send({ address: testAddress })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.address).toBe(testAddress)
    expect(res.body.data.score).toBeTypeOf('number')
    expect(res.body.data.score).toBeGreaterThanOrEqual(0)
    expect(res.body.data.score).toBeLessThanOrEqual(100)
    expect(res.body.data.grade).toMatch(/^[A-F]$/)
    expect(res.body.data.transactionsAnalyzed).toBe(0)
    expect(res.body.data.factors).toBeDefined()
    expect(res.body.data.recommendations).toBeInstanceOf(Array)
  })

  it('returns all four privacy factors', async () => {
    const res = await request(app)
      .post('/v1/privacy/score')
      .send({ address: testAddress })
    const { factors } = res.body.data
    expect(factors.addressReuse).toBeDefined()
    expect(factors.addressReuse.score).toBeTypeOf('number')
    expect(factors.addressReuse.detail).toBeTypeOf('string')
    expect(factors.amountPatterns).toBeDefined()
    expect(factors.timingCorrelation).toBeDefined()
    expect(factors.counterpartyExposure).toBeDefined()
  })

  it('rejects invalid Solana address', async () => {
    const res = await request(app)
      .post('/v1/privacy/score')
      .send({ address: 'not-a-valid-address' })
    expect(res.status).toBe(400)
  })

  it('rejects missing address', async () => {
    const res = await request(app)
      .post('/v1/privacy/score')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('accepts custom limit parameter', async () => {
    const res = await request(app)
      .post('/v1/privacy/score')
      .send({ address: testAddress, limit: 50 })
    expect(res.status).toBe(200)
  })

  it('rejects limit below minimum', async () => {
    const res = await request(app)
      .post('/v1/privacy/score')
      .send({ address: testAddress, limit: 5 })
    expect(res.status).toBe(400)
  })

  it('rejects limit above maximum', async () => {
    const res = await request(app)
      .post('/v1/privacy/score')
      .send({ address: testAddress, limit: 1000 })
    expect(res.status).toBe(400)
  })

  it('returns grade A for empty wallet (perfect privacy)', async () => {
    const res = await request(app)
      .post('/v1/privacy/score')
      .send({ address: testAddress })
    // No transactions = no exposure = high score
    expect(res.body.data.grade).toBe('A')
    expect(res.body.data.score).toBeGreaterThanOrEqual(90)
  })

  it('includes actionable recommendations', async () => {
    const res = await request(app)
      .post('/v1/privacy/score')
      .send({ address: testAddress })
    expect(res.body.data.recommendations.length).toBeGreaterThan(0)
    // Recommendations should be strings
    for (const rec of res.body.data.recommendations) {
      expect(rec).toBeTypeOf('string')
    }
  })

  it('each factor score is between 0 and 100', async () => {
    const res = await request(app)
      .post('/v1/privacy/score')
      .send({ address: testAddress })
    const { factors } = res.body.data
    for (const key of ['addressReuse', 'amountPatterns', 'timingCorrelation', 'counterpartyExposure']) {
      expect(factors[key].score).toBeGreaterThanOrEqual(0)
      expect(factors[key].score).toBeLessThanOrEqual(100)
    }
  })
})
