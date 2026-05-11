import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

// Mock the wallet-data service BEFORE importing modules that consume it so
// the demo routes call our stubs instead of hitting Solana RPC.
vi.mock('../../../src/services/demo-wallet.js', () => ({
  getDemoVault: vi.fn(),
  getDemoActivity: vi.fn(),
  getDemoPrivacyScore: vi.fn(),
}))

import express from 'express'
import request from 'supertest'
import { _resetForTests as resetIpRateLimit } from '../../../src/lib/ip-rate-limit.js'
import { _resetForTests as resetCache } from '../../../src/lib/cache.js'
import {
  getDemoVault,
  getDemoActivity,
  getDemoPrivacyScore,
} from '../../../src/services/demo-wallet.js'

const DEMO_WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'

const vaultFixture = {
  wallet: DEMO_WALLET,
  network: 'devnet',
  balances: { sol: 1.5, tokens: [], status: 'ok' as const },
  activity: [],
}

const activityFixture = [
  {
    id: '1',
    agent: 'sipher',
    type: 'send.success',
    level: 'info',
    title: 'Sent',
    detail: null,
    created_at: '2026-05-11T00:00:00Z',
  },
]

const privacyScoreFixture = {
  address: DEMO_WALLET,
  score: 82,
  grade: 'B',
  transactionsAnalyzed: 50,
  factors: {
    addressReuse: { score: 80, detail: 'detail-reuse' },
    amountPatterns: { score: 85, detail: 'detail-amount' },
    timingCorrelation: { score: 80, detail: 'detail-timing' },
    counterpartyExposure: { score: 82, detail: 'detail-counterparty' },
  },
  recommendations: ['rec1'],
}

async function buildApp(): Promise<express.Express> {
  const { publicRouter } = await import('../../../src/routes/public/index.js')
  const app = express()
  app.set('trust proxy', 1)
  app.use('/api/public', publicRouter)
  return app
}

describe('/api/public/demo/*', () => {
  beforeEach(async () => {
    await resetIpRateLimit()
    await resetCache()
    process.env.DEMO_WALLET = DEMO_WALLET
    vi.mocked(getDemoVault).mockResolvedValue(vaultFixture)
    vi.mocked(getDemoActivity).mockReturnValue(activityFixture)
    vi.mocked(getDemoPrivacyScore).mockResolvedValue(privacyScoreFixture)
  })

  afterEach(() => {
    delete process.env.DEMO_WALLET
    vi.clearAllMocks()
  })

  describe('GET /vault', () => {
    it('returns the demo wallet vault shape', async () => {
      const app = await buildApp()
      const res = await request(app).get('/api/public/demo/vault')
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        wallet: DEMO_WALLET,
        balances: expect.objectContaining({
          sol: expect.any(Number),
          tokens: expect.any(Array),
          status: expect.any(String),
        }),
      })
    })

    it('returns the cached payload on the 2nd call within 60s (service invoked once)', async () => {
      const app = await buildApp()
      const res1 = await request(app).get('/api/public/demo/vault')
      const res2 = await request(app).get('/api/public/demo/vault')
      expect(res1.body).toEqual(res2.body)
      expect(getDemoVault).toHaveBeenCalledTimes(1)
    })

    it('returns 503 + UNAVAILABLE envelope when DEMO_WALLET env is unset', async () => {
      delete process.env.DEMO_WALLET
      const app = await buildApp()
      const res = await request(app).get('/api/public/demo/vault')
      expect(res.status).toBe(503)
      expect(res.body).toEqual({
        error: { code: 'UNAVAILABLE', message: expect.stringMatching(/demo/i) },
      })
      // Service must NOT be invoked when the env gate fails closed.
      expect(getDemoVault).not.toHaveBeenCalled()
    })
  })

  describe('GET /activity', () => {
    it('returns { activity } shape', async () => {
      const app = await buildApp()
      const res = await request(app).get('/api/public/demo/activity')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ activity: activityFixture })
    })

    it('returns 503 when DEMO_WALLET is unset', async () => {
      delete process.env.DEMO_WALLET
      const app = await buildApp()
      const res = await request(app).get('/api/public/demo/activity')
      expect(res.status).toBe(503)
      expect(res.body.error.code).toBe('UNAVAILABLE')
    })

    it('caches across calls (service invoked once)', async () => {
      const app = await buildApp()
      await request(app).get('/api/public/demo/activity')
      await request(app).get('/api/public/demo/activity')
      expect(getDemoActivity).toHaveBeenCalledTimes(1)
    })
  })

  describe('GET /privacy-score', () => {
    it('returns the 4-factor privacy score shape', async () => {
      const app = await buildApp()
      const res = await request(app).get('/api/public/demo/privacy-score')
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        score: expect.any(Number),
        grade: expect.any(String),
        factors: expect.objectContaining({
          addressReuse: expect.objectContaining({ score: expect.any(Number), detail: expect.any(String) }),
          amountPatterns: expect.objectContaining({ score: expect.any(Number), detail: expect.any(String) }),
          timingCorrelation: expect.objectContaining({ score: expect.any(Number), detail: expect.any(String) }),
          counterpartyExposure: expect.objectContaining({ score: expect.any(Number), detail: expect.any(String) }),
        }),
      })
    })

    it('returns 503 when DEMO_WALLET is unset', async () => {
      delete process.env.DEMO_WALLET
      const app = await buildApp()
      const res = await request(app).get('/api/public/demo/privacy-score')
      expect(res.status).toBe(503)
      expect(res.body.error.code).toBe('UNAVAILABLE')
    })

    it('caches across calls (service invoked once)', async () => {
      const app = await buildApp()
      await request(app).get('/api/public/demo/privacy-score')
      await request(app).get('/api/public/demo/privacy-score')
      expect(getDemoPrivacyScore).toHaveBeenCalledTimes(1)
    })
  })

  describe('rate limiting', () => {
    it('returns 429 + RATE_LIMITED envelope after 60 requests in <1min', async () => {
      const app = await buildApp()
      for (let i = 0; i < 60; i++) {
        await request(app).get('/api/public/demo/vault')
      }
      const res = await request(app).get('/api/public/demo/vault')
      expect(res.status).toBe(429)
      expect(res.body.error.code).toBe('RATE_LIMITED')
    })
  })
})
