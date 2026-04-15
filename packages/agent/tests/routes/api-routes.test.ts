import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import express, { type Request, type Response, type NextFunction } from 'express'
import supertest from 'supertest'
import { closeDb } from '../../src/db.js'

// ─────────────────────────────────────────────────────────────────────────────
// Test setup — isolated DB + JWT secret per test
// ─────────────────────────────────────────────────────────────────────────────

const TEST_WALLET = 'TestWallet1111111111111111111111111111111111'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
  process.env.JWT_SECRET = 'test-jwt-secret-at-least-16-chars'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
  delete process.env.JWT_SECRET
})

// ─────────────────────────────────────────────────────────────────────────────
// Module imports (top-level await — Vitest ESM)
// ─────────────────────────────────────────────────────────────────────────────

const { confirmRouter, requestConfirmation } = await import('../../src/routes/confirm.js')
const { vaultRouter } = await import('../../src/routes/vault-api.js')
const { squadRouter, isKillSwitchActive } = await import('../../src/routes/squad-api.js')

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Middleware that injects a test wallet address onto req, simulating verifyJwt. */
function mockAuth(wallet: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    ;(req as unknown as Record<string, unknown>).wallet = wallet
    next()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/confirm/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/confirm/:id', () => {
  function createApp(wallet = TEST_WALLET) {
    const app = express()
    app.use(express.json())
    app.use(mockAuth(wallet))
    app.use('/api/confirm', confirmRouter)
    return app
  }

  it('returns 404 for unknown confirmation id', async () => {
    const res = await supertest(createApp())
      .post('/api/confirm/no-such-id')
      .send({ action: 'confirm' })
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found|expired/i)
  })

  it('resolves true when action is confirm', async () => {
    const app = createApp()
    const id = 'confirm-test-001'

    // Register the pending confirmation (short timeout — won't fire in test)
    const promise = requestConfirmation(id, TEST_WALLET, 10_000)

    const res = await supertest(app)
      .post(`/api/confirm/${id}`)
      .send({ action: 'confirm' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('confirmed')
    await expect(promise).resolves.toBe(true)
  })

  it('resolves false when action is cancel', async () => {
    const app = createApp()
    const id = 'confirm-test-002'

    const promise = requestConfirmation(id, TEST_WALLET, 10_000)

    const res = await supertest(app)
      .post(`/api/confirm/${id}`)
      .send({ action: 'cancel' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('cancelled')
    await expect(promise).resolves.toBe(false)
  })

  it('returns 404 on second call for the same id (one-time use)', async () => {
    const app = createApp()
    const id = 'confirm-test-003'

    requestConfirmation(id, TEST_WALLET, 10_000)

    // First call — consumes the entry
    await supertest(app).post(`/api/confirm/${id}`).send({ action: 'confirm' })

    // Second call — entry is gone
    const res = await supertest(app).post(`/api/confirm/${id}`).send({ action: 'confirm' })
    expect(res.status).toBe(404)
  })

  it('returns 403 when wallet does not match the confirmation owner', async () => {
    const id = 'confirm-test-004'
    requestConfirmation(id, TEST_WALLET, 10_000)

    // Different wallet tries to confirm
    const app = createApp('DifferentWallet22222222222222222222222222222222')
    const res = await supertest(app)
      .post(`/api/confirm/${id}`)
      .send({ action: 'confirm' })

    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/different wallet/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// requestConfirmation — timeout behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('requestConfirmation timeout', () => {
  it('resolves false after timeout elapses', async () => {
    vi.useFakeTimers()
    const id = 'timeout-test-001'
    const promise = requestConfirmation(id, TEST_WALLET, 500)

    vi.advanceTimersByTime(600)
    await expect(promise).resolves.toBe(false)
    vi.useRealTimers()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vault
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/vault', () => {
  function createApp() {
    const app = express()
    app.use(express.json())
    app.use('/api/vault', mockAuth(TEST_WALLET), vaultRouter)
    return app
  }

  it('returns wallet and activity array', async () => {
    const res = await supertest(createApp()).get('/api/vault')
    expect(res.status).toBe(200)
    expect(res.body.wallet).toBe(TEST_WALLET)
    expect(Array.isArray(res.body.activity)).toBe(true)
  })

  it('returns empty activity for a wallet with no history', async () => {
    const res = await supertest(createApp()).get('/api/vault')
    expect(res.status).toBe(200)
    expect(res.body.activity).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/squad + POST /api/squad/kill
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/squad', () => {
  function createApp() {
    const app = express()
    app.use(express.json())
    app.use('/api/squad', squadRouter)
    return app
  }

  it('returns agents, costs, events, and killSwitch', async () => {
    const res = await supertest(createApp()).get('/api/squad')
    expect(res.status).toBe(200)
    expect(res.body.agents).toBeDefined()
    expect(res.body.agents.sipher.status).toBe('active')
    expect(res.body.agents.herald.status).toBe('idle')
    expect(res.body.agents.sentinel.status).toBe('idle')
    expect(res.body.agents.courier.status).toBe('idle')
    expect(typeof res.body.costs).toBe('object')
    expect(Array.isArray(res.body.events)).toBe(true)
    expect(typeof res.body.killSwitch).toBe('boolean')
  })
})

describe('POST /api/squad/kill', () => {
  function createApp() {
    const app = express()
    app.use(express.json())
    app.use('/api/squad', squadRouter)
    return app
  }

  it('toggles the kill switch and returns the new state', async () => {
    const app = createApp()
    const before = isKillSwitchActive()

    const res = await supertest(app).post('/api/squad/kill')
    expect(res.status).toBe(200)
    expect(res.body.killSwitch).toBe(!before)
    expect(isKillSwitchActive()).toBe(!before)
  })

  it('toggles back on second call', async () => {
    const app = createApp()
    const initial = isKillSwitchActive()

    await supertest(app).post('/api/squad/kill')
    const res = await supertest(app).post('/api/squad/kill')
    expect(res.status).toBe(200)
    expect(res.body.killSwitch).toBe(initial)
    expect(isKillSwitchActive()).toBe(initial)
  })
})
