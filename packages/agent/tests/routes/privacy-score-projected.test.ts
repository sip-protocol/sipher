import { describe, expect, it, vi, beforeEach } from 'vitest'
import express from 'express'
import supertest from 'supertest'

// Mock the v1 solana service to avoid hitting devnet RPC in unit tests
vi.mock('../../../../src/services/solana.js', () => ({
  getConnection: vi.fn(() => ({
    getSignaturesForAddress: vi.fn().mockResolvedValue([]),
    getTransaction: vi.fn().mockResolvedValue(null),
  })),
}))

import privacyRouter from '../../../../src/routes/privacy.js'

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/v1', privacyRouter)
  return app
}

const TEST_ADDRESS = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'

describe('POST /v1/privacy/score (projected extension)', () => {
  it('returns identical shape when projectedAmount is absent (backwards-compatible)', async () => {
    const res = await supertest(createApp())
      .post('/v1/privacy/score')
      .send({ address: TEST_ADDRESS, limit: 50 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toMatchObject({
      address: TEST_ADDRESS,
      score: expect.any(Number),
      grade: expect.any(String),
      transactionsAnalyzed: expect.any(Number),
      factors: expect.objectContaining({
        addressReuse: expect.any(Object),
        amountPatterns: expect.any(Object),
        timingCorrelation: expect.any(Object),
        counterpartyExposure: expect.any(Object),
      }),
      recommendations: expect.any(Array),
    })
    expect(res.body.data.projected).toBeUndefined()
  })

  it('returns projected block when projectedAmount + projectedToken provided', async () => {
    const res = await supertest(createApp())
      .post('/v1/privacy/score')
      .send({
        address: TEST_ADDRESS,
        limit: 50,
        projectedAmount: 1.5,
        projectedToken: 'SOL',
      })

    expect(res.status).toBe(200)
    expect(res.body.data.projected).toBeDefined()
    expect(res.body.data.projected).toMatchObject({
      score: expect.any(Number),
      grade: expect.any(String),
      factors: expect.objectContaining({
        addressReuse: expect.objectContaining({ score: expect.any(Number), detail: expect.any(String) }),
        amountPatterns: expect.objectContaining({ score: expect.any(Number) }),
        timingCorrelation: expect.objectContaining({ score: expect.any(Number) }),
        counterpartyExposure: expect.objectContaining({ score: expect.any(Number) }),
      }),
      delta: expect.objectContaining({
        score: expect.any(Number),
        addressReuse: expect.any(Number),
        amountPatterns: expect.any(Number),
        timingCorrelation: expect.any(Number),
        counterpartyExposure: expect.any(Number),
      }),
    })
  })

  it('defaults projectedToken to SOL when only projectedAmount is provided', async () => {
    const res = await supertest(createApp())
      .post('/v1/privacy/score')
      .send({ address: TEST_ADDRESS, projectedAmount: 0.25 })

    expect(res.status).toBe(200)
    expect(res.body.data.projected).toBeDefined()
  })

  it('returns 400 INVALID_PROJECTED_AMOUNT when projectedAmount is 0', async () => {
    const res = await supertest(createApp())
      .post('/v1/privacy/score')
      .send({ address: TEST_ADDRESS, projectedAmount: 0 })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('INVALID_PROJECTED_AMOUNT')
  })

  it('returns 400 INVALID_PROJECTED_AMOUNT when projectedAmount is negative', async () => {
    const res = await supertest(createApp())
      .post('/v1/privacy/score')
      .send({ address: TEST_ADDRESS, projectedAmount: -1 })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_PROJECTED_AMOUNT')
  })

  it('returns 400 INVALID_TOKEN when projectedToken is unknown', async () => {
    const res = await supertest(createApp())
      .post('/v1/privacy/score')
      .send({ address: TEST_ADDRESS, projectedAmount: 1, projectedToken: 'BOGUS' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })
})
