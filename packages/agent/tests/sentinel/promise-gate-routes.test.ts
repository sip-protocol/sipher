import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import supertest from 'supertest'
import jwt from 'jsonwebtoken'
import { createPending, clearAll } from '../../src/sentinel/pending.js'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_WALLET = 'admin-wallet-test'
const NON_ADMIN_WALLET = 'random-wallet-test'
const TEST_JWT_SECRET = 'test-secret-for-sentinel-pause-tests'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function signJwt(wallet: string): string {
  return jwt.sign({ wallet }, TEST_JWT_SECRET, { expiresIn: '1h', algorithm: 'HS256' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Module imports (top-level await — Vitest ESM)
// ─────────────────────────────────────────────────────────────────────────────

const { sentinelAdminRouter } = await import('../../src/routes/sentinel-api.js')
const { verifyJwt, requireOwner } = await import('../../src/routes/auth.js')

// ─────────────────────────────────────────────────────────────────────────────
// Test setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = TEST_JWT_SECRET
  process.env.AUTHORIZED_WALLETS = ADMIN_WALLET
  for (const s of ['test-session', 's1', 's2']) clearAll(s)
})

afterEach(() => {
  delete process.env.JWT_SECRET
  delete process.env.AUTHORIZED_WALLETS
  for (const s of ['test-session', 's1', 's2']) clearAll(s)
})

// ─────────────────────────────────────────────────────────────────────────────
// App factory — mounts sentinelAdminRouter with full auth chain
// ─────────────────────────────────────────────────────────────────────────────

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/sentinel', verifyJwt, requireOwner, sentinelAdminRouter)
  return app
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('SENTINEL promise-gate routes', () => {
  it('POST /api/sentinel/promise-gate/:flagId/resolve resolves the pending promise (204)', async () => {
    const { flagId, promise } = createPending('test-session', 'send', { amount: 1 })
    const res = await supertest(createApp())
      .post(`/api/sentinel/promise-gate/${flagId}/resolve`)
      .set('Authorization', `Bearer ${signJwt(ADMIN_WALLET)}`)
    expect(res.status).toBe(204)
    await expect(promise).resolves.toBeUndefined()
  })

  it('POST /api/sentinel/promise-gate/:flagId/reject rejects the pending promise (204)', async () => {
    const { flagId, promise } = createPending('test-session', 'send', { amount: 1 })
    // attach noop catch before the HTTP call so Node doesn't flag the rejection as unhandled
    // before our .rejects assertion consumes it
    promise.catch(() => {})
    const res = await supertest(createApp())
      .post(`/api/sentinel/promise-gate/${flagId}/reject`)
      .set('Authorization', `Bearer ${signJwt(ADMIN_WALLET)}`)
    expect(res.status).toBe(204)
    await expect(promise).rejects.toThrow(/cancelled/i)
  })

  it('returns 404 for unknown flag id', async () => {
    const res = await supertest(createApp())
      .post('/api/sentinel/promise-gate/does-not-exist/resolve')
      .set('Authorization', `Bearer ${signJwt(ADMIN_WALLET)}`)
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('returns 403 for non-admin wallet', async () => {
    // attach noop catch — afterEach clearAll rejects this promise, suppress the unhandled noise
    const { flagId, promise } = createPending('test-session', 'send', { amount: 1 })
    promise.catch(() => {})
    const res = await supertest(createApp())
      .post(`/api/sentinel/promise-gate/${flagId}/resolve`)
      .set('Authorization', `Bearer ${signJwt(NON_ADMIN_WALLET)}`)
    expect(res.status).toBe(403)
  })

  it('returns 401 with no Authorization header', async () => {
    // attach noop catch — afterEach clearAll rejects this promise, suppress the unhandled noise
    const { flagId, promise } = createPending('test-session', 'send', { amount: 1 })
    promise.catch(() => {})
    const res = await supertest(createApp()).post(`/api/sentinel/promise-gate/${flagId}/resolve`)
    expect(res.status).toBe(401)
  })
})
