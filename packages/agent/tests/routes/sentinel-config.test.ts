import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TEST_JWT_SECRET = 'test-jwt-secret-at-least-16-chars'
const OWNER_WALLET = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'
const NON_ADMIN_WALLET = 'NonAdminWallet1111111111111111111111111111'

// ─────────────────────────────────────────────────────────────────────────────
// Module imports (top-level await — Vitest ESM)
// ─────────────────────────────────────────────────────────────────────────────

const { sentinelPublicRouter, sentinelAdminRouter } = await import('../../src/routes/sentinel-api.js')
const { verifyJwt, requireOwner } = await import('../../src/routes/auth.js')

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function authToken(wallet: string): string {
  return jwt.sign({ wallet }, TEST_JWT_SECRET, { expiresIn: '1h', algorithm: 'HS256' })
}

// Mirrors production wiring (packages/agent/src/index.ts:214-215):
// public sub-router gets verifyJwt only; admin sub-router gets verifyJwt + requireOwner.
function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/sentinel', verifyJwt, sentinelPublicRouter)
  app.use('/api/sentinel', verifyJwt, requireOwner, sentinelAdminRouter)
  return app
}

// ─────────────────────────────────────────────────────────────────────────────
// Test setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = TEST_JWT_SECRET
  process.env.AUTHORIZED_WALLETS = OWNER_WALLET
})

afterEach(() => {
  delete process.env.JWT_SECRET
  delete process.env.AUTHORIZED_WALLETS
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/sentinel/config', () => {
  it('returns 403 for non-admin wallets', async () => {
    const res = await request(makeApp())
      .get('/api/sentinel/config')
      .set('Authorization', `Bearer ${authToken(NON_ADMIN_WALLET)}`)
    expect(res.status).toBe(403)
  })

  it('returns full SentinelConfig payload for admin', async () => {
    const res = await request(makeApp())
      .get('/api/sentinel/config')
      .set('Authorization', `Bearer ${authToken(OWNER_WALLET)}`)
    expect(res.status).toBe(200)
    expect(['yolo', 'advisory', 'off']).toContain(res.body.mode)
    expect(['fund-actions', 'critical-only', 'never']).toContain(res.body.preflightScope)
    expect(typeof res.body.preflightSkipAmount).toBe('number')
    expect(typeof res.body.largeTransferThreshold).toBe('number')
    expect(typeof res.body.cancelWindowMs).toBe('number')
    expect(typeof res.body.threatCheckEnabled).toBe('boolean')
    expect(typeof res.body.blacklistAutonomy).toBe('boolean')
    expect(typeof res.body.blockOnError).toBe('boolean')
    expect(typeof res.body.model).toBe('string')
    expect(typeof res.body.dailyBudgetUsd).toBe('number')
    expect(typeof res.body.dailyCostUsd).toBe('number')
  })

  it('includes fundMovingTools array with the canonical tool list', async () => {
    const res = await request(makeApp())
      .get('/api/sentinel/config')
      .set('Authorization', `Bearer ${authToken(OWNER_WALLET)}`)
    expect(Array.isArray(res.body.fundMovingTools)).toBe(true)
    expect(res.body.fundMovingTools).toEqual(
      expect.arrayContaining([
        'send', 'deposit', 'swap', 'sweep', 'consolidate',
        'splitSend', 'scheduleSend', 'drip', 'recurring', 'refund',
      ]),
    )
  })

  it('reflects dailyDecisionCostUsd for dailyCostUsd', async () => {
    const { dailyDecisionCostUsd } = await import('../../src/db.js')
    const expected = dailyDecisionCostUsd()
    const res = await request(makeApp())
      .get('/api/sentinel/config')
      .set('Authorization', `Bearer ${authToken(OWNER_WALLET)}`)
    expect(res.body.dailyCostUsd).toBe(expected)
  })
})
