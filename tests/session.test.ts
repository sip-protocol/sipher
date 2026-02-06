import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express, { Router, Request, Response, NextFunction } from 'express'
import { resetSessionProvider } from '../src/services/session-provider.js'

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation(() => ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    })),
  }
})

const { default: app } = await import('../src/server.js')

// ─── Helpers ────────────────────────────────────────────────────────────────

const validDefaults = {
  chain: 'solana',
  privacyLevel: 'shielded',
  backend: 'sip-native',
}

async function createTestSession(defaults: any = validDefaults, ttlSeconds?: number) {
  const body: any = { defaults }
  if (ttlSeconds !== undefined) body.ttlSeconds = ttlSeconds

  const res = await request(app)
    .post('/v1/sessions')
    .send(body)
  return res
}

// ─── POST /v1/sessions ─────────────────────────────────────────────────────

describe('POST /v1/sessions', () => {
  beforeEach(() => resetSessionProvider())

  it('creates session with valid defaults → 201', async () => {
    const res = await createTestSession()
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.sessionId).toMatch(/^sess_[0-9a-f]{64}$/)
    expect(res.body.data.defaults.chain).toBe('solana')
    expect(res.body.data.defaults.privacyLevel).toBe('shielded')
    expect(res.body.data.defaults.backend).toBe('sip-native')
    expect(res.body.data.createdAt).toBeGreaterThan(0)
    expect(res.body.data.expiresAt).toBeGreaterThan(res.body.data.createdAt)
  })

  it('creates session with custom TTL', async () => {
    const res = await createTestSession(validDefaults, 300)
    expect(res.status).toBe(201)
    // 300s TTL
    const diff = res.body.data.expiresAt - res.body.data.createdAt
    expect(diff).toBeGreaterThanOrEqual(299000)
    expect(diff).toBeLessThanOrEqual(301000)
  })

  it('clamps TTL to minimum 60s', async () => {
    const res = await createTestSession(validDefaults, 10)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('clamps TTL to maximum 86400s', async () => {
    const res = await createTestSession(validDefaults, 100000)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('creates session with empty defaults', async () => {
    const res = await createTestSession({})
    expect(res.status).toBe(201)
    expect(res.body.data.defaults).toEqual({})
  })

  it('creates session with all default fields', async () => {
    const allDefaults = {
      chain: 'ethereum',
      privacyLevel: 'maximum',
      rpcProvider: 'helius',
      backend: 'arcium',
      defaultViewingKey: '0xabcd1234',
    }
    const res = await createTestSession(allDefaults)
    expect(res.status).toBe(201)
    expect(res.body.data.defaults.chain).toBe('ethereum')
    expect(res.body.data.defaults.rpcProvider).toBe('helius')
  })

  it('rejects invalid chain → 400', async () => {
    const res = await createTestSession({ chain: 'invalid-chain' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects invalid backend → 400', async () => {
    const res = await createTestSession({ backend: 'unknown' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects missing defaults field → 400', async () => {
    const res = await request(app)
      .post('/v1/sessions')
      .send({ ttlSeconds: 3600 })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('generates unique session IDs', async () => {
    const res1 = await createTestSession()
    const res2 = await createTestSession()
    expect(res1.body.data.sessionId).not.toBe(res2.body.data.sessionId)
  })
})

// ─── GET /v1/sessions/:id ──────────────────────────────────────────────────

describe('GET /v1/sessions/:id', () => {
  beforeEach(() => resetSessionProvider())

  it('retrieves created session → 200', async () => {
    const create = await createTestSession()
    const sessionId = create.body.data.sessionId

    const res = await request(app)
      .get(`/v1/sessions/${sessionId}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.sessionId).toBe(sessionId)
    expect(res.body.data.defaults.chain).toBe('solana')
    expect(res.body.data.lastAccessedAt).toBeGreaterThan(0)
  })

  it('returns 404 for unknown session', async () => {
    const fakeId = 'sess_' + 'ff'.repeat(32)
    const res = await request(app)
      .get(`/v1/sessions/${fakeId}`)
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('SESSION_NOT_FOUND')
  })

  it('returns 400 for invalid session ID format', async () => {
    const res = await request(app)
      .get('/v1/sessions/invalid-id')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── PATCH /v1/sessions/:id ────────────────────────────────────────────────

describe('PATCH /v1/sessions/:id', () => {
  beforeEach(() => resetSessionProvider())

  it('updates session defaults → 200', async () => {
    const create = await createTestSession()
    const sessionId = create.body.data.sessionId

    const res = await request(app)
      .patch(`/v1/sessions/${sessionId}`)
      .send({ defaults: { chain: 'ethereum', privacyLevel: 'maximum' } })
    expect(res.status).toBe(200)
    expect(res.body.data.defaults.chain).toBe('ethereum')
    expect(res.body.data.defaults.privacyLevel).toBe('maximum')
    // Original backend preserved
    expect(res.body.data.defaults.backend).toBe('sip-native')
  })

  it('returns 404 for unknown session', async () => {
    const fakeId = 'sess_' + 'ff'.repeat(32)
    const res = await request(app)
      .patch(`/v1/sessions/${fakeId}`)
      .send({ defaults: { chain: 'near' } })
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('SESSION_NOT_FOUND')
  })

  it('rejects invalid defaults → 400', async () => {
    const create = await createTestSession()
    const sessionId = create.body.data.sessionId

    const res = await request(app)
      .patch(`/v1/sessions/${sessionId}`)
      .send({ defaults: { chain: 'invalid-chain' } })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── DELETE /v1/sessions/:id ───────────────────────────────────────────────

describe('DELETE /v1/sessions/:id', () => {
  beforeEach(() => resetSessionProvider())

  it('deletes session → 200', async () => {
    const create = await createTestSession()
    const sessionId = create.body.data.sessionId

    const res = await request(app)
      .delete(`/v1/sessions/${sessionId}`)
    expect(res.status).toBe(200)
    expect(res.body.data.sessionId).toBe(sessionId)
    expect(res.body.data.deleted).toBe(true)

    // Confirm deleted
    const get = await request(app)
      .get(`/v1/sessions/${sessionId}`)
    expect(get.status).toBe(404)
  })

  it('returns 404 for unknown session', async () => {
    const fakeId = 'sess_' + 'ff'.repeat(32)
    const res = await request(app)
      .delete(`/v1/sessions/${fakeId}`)
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('SESSION_NOT_FOUND')
  })
})

// ─── Session Middleware: merge defaults ─────────────────────────────────────

describe('Session middleware: X-Session-Id header merge', () => {
  beforeEach(() => resetSessionProvider())

  it('merges session defaults into request body', async () => {
    // Create session with chain=near
    const create = await createTestSession({ chain: 'near' })
    const sessionId = create.body.data.sessionId

    // Use stealth/generate with X-Session-Id — chain should come from session
    const res = await request(app)
      .post('/v1/stealth/generate')
      .set('X-Session-Id', sessionId)
      .send({})
    expect(res.status).toBe(200)
    // The stealth endpoint should receive chain=near from session
    expect(res.body.data.chain).toBe('near')
  })

  it('request-level params override session defaults', async () => {
    // Create session with chain=near
    const create = await createTestSession({ chain: 'near' })
    const sessionId = create.body.data.sessionId

    // Explicitly pass chain=ethereum — should override session
    const res = await request(app)
      .post('/v1/stealth/generate')
      .set('X-Session-Id', sessionId)
      .send({ chain: 'ethereum' })
    expect(res.status).toBe(200)
    expect(res.body.data.chain).toBe('ethereum')
  })

  it('silently skips invalid session ID format', async () => {
    const res = await request(app)
      .post('/v1/stealth/generate')
      .set('X-Session-Id', 'not-a-valid-session')
      .send({})
    expect(res.status).toBe(200) // Should proceed normally
  })

  it('silently skips non-existent session', async () => {
    const fakeId = 'sess_' + 'aa'.repeat(32)
    const res = await request(app)
      .post('/v1/stealth/generate')
      .set('X-Session-Id', fakeId)
      .send({})
    expect(res.status).toBe(200) // Should proceed normally
  })
})

// ─── Pro+ Tier Gating ──────────────────────────────────────────────────────

describe('Session pro+ tier gating', () => {
  let tierApp: express.Application

  beforeEach(async () => {
    resetSessionProvider()

    const { requireTier } = await import('../src/middleware/require-tier.js')

    tierApp = express()
    tierApp.use(express.json())

    // Middleware to set tier from X-Test-Tier header
    tierApp.use((req: Request, _res: Response, next: NextFunction) => {
      req.apiKeyTier = (req.headers['x-test-tier'] as any) || 'enterprise'
      next()
    })

    const sessRouter = Router()
    sessRouter.post('/sessions/test', requireTier('pro', 'enterprise'), (_req: Request, res: Response) => {
      res.json({ success: true, data: { message: 'ok' } })
    })
    tierApp.use('/v1', sessRouter)
  })

  it('allows enterprise tier → 200', async () => {
    const res = await request(tierApp)
      .post('/v1/sessions/test')
      .set('X-Test-Tier', 'enterprise')
      .send({})
    expect(res.status).toBe(200)
  })

  it('allows pro tier → 200', async () => {
    const res = await request(tierApp)
      .post('/v1/sessions/test')
      .set('X-Test-Tier', 'pro')
      .send({})
    expect(res.status).toBe(200)
  })

  it('rejects free tier → 403', async () => {
    const res = await request(tierApp)
      .post('/v1/sessions/test')
      .set('X-Test-Tier', 'free')
      .send({})
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('TIER_ACCESS_DENIED')
  })
})

// ─── Ownership enforcement ─────────────────────────────────────────────────

describe('Session ownership enforcement', () => {
  let ownerApp: express.Application

  beforeEach(async () => {
    resetSessionProvider()

    const { sessionMiddleware } = await import('../src/middleware/session.js')
    const sessionRouter = (await import('../src/routes/session.js')).default

    ownerApp = express()
    ownerApp.use(express.json())
    ownerApp.use(sessionMiddleware)

    // Set apiKeyTier for require-tier checks
    ownerApp.use((req: Request, _res: Response, next: NextFunction) => {
      req.apiKeyTier = 'enterprise'
      next()
    })

    ownerApp.use('/v1', sessionRouter)
  })

  it('returns 404 when different API key tries to GET session', async () => {
    // Create with key A
    const create = await request(ownerApp)
      .post('/v1/sessions')
      .set('X-API-Key', 'key-aaa')
      .send({ defaults: { chain: 'solana' } })
    expect(create.status).toBe(201)
    const sessionId = create.body.data.sessionId

    // Try GET with key B
    const res = await request(ownerApp)
      .get(`/v1/sessions/${sessionId}`)
      .set('X-API-Key', 'key-bbb')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('SESSION_NOT_FOUND')
  })

  it('returns 404 when different API key tries to PATCH session', async () => {
    const create = await request(ownerApp)
      .post('/v1/sessions')
      .set('X-API-Key', 'key-aaa')
      .send({ defaults: { chain: 'solana' } })
    const sessionId = create.body.data.sessionId

    const res = await request(ownerApp)
      .patch(`/v1/sessions/${sessionId}`)
      .set('X-API-Key', 'key-bbb')
      .send({ defaults: { chain: 'near' } })
    expect(res.status).toBe(404)
  })

  it('returns 404 when different API key tries to DELETE session', async () => {
    const create = await request(ownerApp)
      .post('/v1/sessions')
      .set('X-API-Key', 'key-aaa')
      .send({ defaults: { chain: 'solana' } })
    const sessionId = create.body.data.sessionId

    const res = await request(ownerApp)
      .delete(`/v1/sessions/${sessionId}`)
      .set('X-API-Key', 'key-bbb')
    expect(res.status).toBe(404)
  })
})
