import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

describe('sentinel REST endpoints', () => {
  beforeEach(() => { process.env.DB_PATH = ':memory:' })
  afterEach(() => { delete process.env.DB_PATH; vi.restoreAllMocks() })

  async function freshDb() {
    const { closeDb, getDb } = await import('../../src/db.js')
    closeDb()
    getDb()
  }

  async function buildApp(assess: (ctx: unknown) => unknown) {
    await freshDb()
    const { setSentinelAssessor } = await import('../../src/sentinel/preflight-gate.js')
    setSentinelAssessor(assess as never)
    const { sentinelPublicRouter, sentinelAdminRouter } = await import('../../src/routes/sentinel-api.js')
    const app = express()
    app.use(express.json())
    // Simulate verifyJwt + requireOwner by attaching wallet to req (all tests run as admin)
    app.use((req, _res, next) => {
      ;(req as unknown as Record<string, unknown>).wallet = 'w1'
      next()
    })
    app.use('/api/sentinel', sentinelPublicRouter)
    app.use('/api/sentinel', sentinelAdminRouter)
    return app
  }

  it('POST /assess returns a RiskReport from the assessor', async () => {
    const assess = vi.fn().mockResolvedValue({
      risk: 'low', score: 5, reasons: [], recommendation: 'allow',
      decisionId: 'dec1', durationMs: 100,
    })
    const app = await buildApp(assess)
    const res = await request(app).post('/api/sentinel/assess').send({
      action: 'send', wallet: 'w1', recipient: 'r1', amount: 1,
    })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ risk: 'low', recommendation: 'allow' })
  })

  it('POST /assess returns 400 + VALIDATION_FAILED envelope on missing required fields', async () => {
    const app = await buildApp(vi.fn())
    const res = await request(app).post('/api/sentinel/assess').send({})
    expect(res.status).toBe(400)
    expect(res.body).toStrictEqual({
      error: { code: 'VALIDATION_FAILED', message: 'action and wallet are required strings' },
    })
  })

  it('POST /assess returns 503 + UNAVAILABLE when assessor is not configured', async () => {
    await freshDb()
    const { setSentinelAssessor } = await import('../../src/sentinel/preflight-gate.js')
    setSentinelAssessor(null)
    const { sentinelPublicRouter } = await import('../../src/routes/sentinel-api.js')
    const app = express()
    app.use(express.json())
    app.use('/api/sentinel', sentinelPublicRouter)
    const res = await request(app).post('/api/sentinel/assess').send({
      action: 'send', wallet: 'w1',
    })
    expect(res.status).toBe(503)
    expect(res.body).toStrictEqual({
      error: { code: 'UNAVAILABLE', message: 'SENTINEL assessor not configured' },
    })
  })

  it('POST /assess returns 500 + INTERNAL envelope when assessor throws', async () => {
    const assess = vi.fn().mockRejectedValue(new Error('boom'))
    const app = await buildApp(assess as never)
    const res = await request(app).post('/api/sentinel/assess').send({
      action: 'send', wallet: 'w1',
    })
    expect(res.status).toBe(500)
    expect(res.body).toStrictEqual({
      error: { code: 'INTERNAL', message: 'boom' },
    })
  })

  it('GET /blacklist returns active entries', async () => {
    const app = await buildApp(vi.fn())
    const { insertBlacklist } = await import('../../src/db.js')
    insertBlacklist({ address: 'a1', reason: 'r', severity: 'warn', addedBy: 'sentinel' })
    const res = await request(app).get('/api/sentinel/blacklist')
    expect(res.status).toBe(200)
    expect((res.body.entries as unknown[]).length).toBe(1)
  })

  it('POST /blacklist adds an entry', async () => {
    const app = await buildApp(vi.fn())
    const res = await request(app).post('/api/sentinel/blacklist').send({
      address: 'bad', reason: 'scam', severity: 'block',
    })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const { getActiveBlacklistEntry } = await import('../../src/db.js')
    expect(getActiveBlacklistEntry('bad')).not.toBeNull()
  })

  it('POST /blacklist returns 400 + VALIDATION_FAILED envelope on missing fields', async () => {
    const app = await buildApp(vi.fn())
    const res = await request(app).post('/api/sentinel/blacklist').send({ address: 'only-address' })
    expect(res.status).toBe(400)
    expect(res.body).toStrictEqual({
      error: { code: 'VALIDATION_FAILED', message: 'address, reason, severity required' },
    })
  })

  it('DELETE /blacklist/:id soft-removes entry', async () => {
    const app = await buildApp(vi.fn())
    const { insertBlacklist, getActiveBlacklistEntry } = await import('../../src/db.js')
    const id = insertBlacklist({ address: 'abc', reason: 'r', severity: 'warn', addedBy: 'sentinel' })
    const res = await request(app).delete(`/api/sentinel/blacklist/${id}`).send({ reason: 'false positive' })
    expect(res.status).toBe(200)
    expect(getActiveBlacklistEntry('abc')).toBeNull()
  })

  it('GET /pending lists pending actions', async () => {
    const app = await buildApp(vi.fn())
    const { insertPendingAction } = await import('../../src/db.js')
    insertPendingAction({ actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 60000 })
    const res = await request(app).get('/api/sentinel/pending')
    expect(res.status).toBe(200)
    expect((res.body.actions as unknown[]).length).toBe(1)
  })

  it('POST /pending/:id/cancel cancels an action', async () => {
    const app = await buildApp(vi.fn())
    const cb = await import('../../src/sentinel/circuit-breaker.js')
    const id = cb.scheduleCancellableAction({
      actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 60000,
    })
    const res = await request(app).post(`/api/sentinel/pending/${id}/cancel`).send({ reason: 'user cancelled' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const { getPendingAction } = await import('../../src/db.js')
    expect(getPendingAction(id)!.status).toBe('cancelled')
    cb.clearAllTimers()
  })

  it('POST /pending/:id/cancel returns 404 + NOT_FOUND when ID does not exist', async () => {
    const app = await buildApp(vi.fn())
    const res = await request(app).post('/api/sentinel/pending/does-not-exist/cancel').send({
      reason: 'attempted cancel',
    })
    expect(res.status).toBe(404)
    expect(res.body).toStrictEqual({
      error: { code: 'NOT_FOUND', message: 'pending action not found or already resolved' },
    })
  })

  it('GET /decisions lists audit log', async () => {
    const app = await buildApp(vi.fn())
    const { insertDecisionDraft, finalizeDecision } = await import('../../src/db.js')
    const id = insertDecisionDraft({ invocationSource: 'query', triggerContext: {}, model: 'm' })
    finalizeDecision(id, {
      verdict: 'allow', verdictDetail: {}, reasoning: 'ok',
      durationMs: 100, inputTokens: 10, outputTokens: 5, costUsd: 0.001,
    })
    const res = await request(app).get('/api/sentinel/decisions')
    expect(res.status).toBe(200)
    expect((res.body.decisions as unknown[]).length).toBe(1)
  })

  it('GET /status returns mode + daily cost', async () => {
    const app = await buildApp(vi.fn())
    const res = await request(app).get('/api/sentinel/status')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ mode: expect.any(String), dailyBudgetUsd: expect.any(Number) })
  })

  it('admin and public routers are separately exported', async () => {
    const mod = await import('../../src/routes/sentinel-api.js')
    expect(mod.sentinelPublicRouter).toBeDefined()
    expect(mod.sentinelAdminRouter).toBeDefined()
    expect(mod.sentinelRouter).toBeDefined() // backwards-compat
  })
})
