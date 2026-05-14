import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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
