import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { keysRouter } from '../../src/routes/keys.js'
import { verifyJwt } from '../../src/routes/auth.js'

const TEST_JWT_SECRET = 'test-jwt-secret-at-least-16-chars'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/keys', verifyJwt, keysRouter)
  return app
}

function authToken(wallet = 'TestWallet1111111111111111111111111111111111') {
  return jwt.sign({ wallet }, TEST_JWT_SECRET, { expiresIn: '1h' })
}

beforeEach(() => {
  process.env.JWT_SECRET = TEST_JWT_SECRET
})

afterEach(() => {
  delete process.env.JWT_SECRET
})

describe('POST /api/keys/generate', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(makeApp()).post('/api/keys/generate')
    expect(res.status).toBe(401)
  })

  it('generates a viewing keypair and returns hash + downloadData', async () => {
    const res = await request(makeApp())
      .post('/api/keys/generate')
      .set('Authorization', `Bearer ${authToken()}`)
    expect(res.status).toBe(200)
    expect(typeof res.body.hash).toBe('string')
    expect(res.body.hash.length).toBeGreaterThan(0)
    expect(res.body.downloadData).toBeDefined()
    expect(typeof res.body.downloadData.blob).toBe('string')
    expect(typeof res.body.downloadData.filename).toBe('string')
  })

  it('returns a different hash on each call (no caching)', async () => {
    const a = await request(makeApp())
      .post('/api/keys/generate')
      .set('Authorization', `Bearer ${authToken()}`)
    const b = await request(makeApp())
      .post('/api/keys/generate')
      .set('Authorization', `Bearer ${authToken()}`)
    expect(a.body.hash).not.toBe(b.body.hash)
  })

  it('persists nothing to the sessions or audit_log tables', async () => {
    const { getDb } = await import('../../src/db.js')
    const db = getDb()
    const sessionsBefore = (db.prepare('SELECT COUNT(*) as n FROM sessions').get() as { n: number }).n
    const auditBefore = (db.prepare('SELECT COUNT(*) as n FROM audit_log').get() as { n: number }).n

    await request(makeApp())
      .post('/api/keys/generate')
      .set('Authorization', `Bearer ${authToken()}`)

    const sessionsAfter = (db.prepare('SELECT COUNT(*) as n FROM sessions').get() as { n: number }).n
    const auditAfter = (db.prepare('SELECT COUNT(*) as n FROM audit_log').get() as { n: number }).n
    expect(sessionsAfter).toBe(sessionsBefore)
    expect(auditAfter).toBe(auditBefore)
  })
})
