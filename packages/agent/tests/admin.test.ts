import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import supertest from 'supertest'
import {
  closeDb,
  getOrCreateSession,
  logAudit,
  createPaymentLink,
} from '../src/db.js'

process.env.SIPHER_ADMIN_PASSWORD = 'test-admin-pass'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

const { adminRouter } = await import('../src/routes/admin.js')

function createApp() {
  const app = express()
  app.use(express.json())
  app.use(express.urlencoded({ extended: false }))
  app.use('/admin', adminRouter)
  return app
}

describe('admin auth', () => {
  it('GET /admin/ returns login page when not authenticated', async () => {
    const app = createApp()
    const res = await supertest(app).get('/admin/')
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/password/i)
  })

  it('POST /admin/login with correct password sets cookie', async () => {
    const app = createApp()
    const res = await supertest(app)
      .post('/admin/login')
      .send({ password: 'test-admin-pass' })
    expect(res.status).toBe(302)
    expect(res.headers['set-cookie']).toBeDefined()
    expect(res.headers['set-cookie'][0]).toMatch(/sipher_admin/)
  })

  it('POST /admin/login with wrong password returns 401', async () => {
    const app = createApp()
    const res = await supertest(app)
      .post('/admin/login')
      .send({ password: 'wrong-password' })
    expect(res.status).toBe(401)
  })

  it('GET /admin/api/stats requires auth', async () => {
    const app = createApp()
    const res = await supertest(app).get('/admin/api/stats')
    expect(res.status).toBe(401)
  })
})

describe('admin API (authenticated)', () => {
  async function loginAndGetCookie(app: express.Express): Promise<string> {
    const res = await supertest(app)
      .post('/admin/login')
      .send({ password: 'test-admin-pass' })
    return res.headers['set-cookie'][0].split(';')[0]
  }

  it('GET /admin/api/stats returns dashboard data', async () => {
    const session = getOrCreateSession('FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr')
    logAudit(session.id, 'send', { to: 'addr' })
    logAudit(session.id, 'deposit', { amount: 5 })
    createPaymentLink({
      stealth_address: '0xa',
      ephemeral_pubkey: '0xe',
      expires_at: Date.now() + 3600_000,
    })
    const app = createApp()
    const cookie = await loginAndGetCookie(app)
    const res = await supertest(app)
      .get('/admin/api/stats')
      .set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.sessions.total).toBe(1)
    expect(res.body.audit.total).toBe(2)
    expect(res.body.paymentLinks.total).toBe(1)
  })

  it('GET /admin/dashboard returns HTML with stats', async () => {
    const app = createApp()
    const cookie = await loginAndGetCookie(app)
    const res = await supertest(app)
      .get('/admin/dashboard')
      .set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/html/)
    expect(res.text).toMatch(/dashboard/i)
  })

  it('POST /admin/logout clears cookie', async () => {
    const app = createApp()
    const cookie = await loginAndGetCookie(app)
    const res = await supertest(app)
      .post('/admin/logout')
      .set('Cookie', cookie)
    expect(res.status).toBe(302)
    expect(res.headers['set-cookie'][0]).toMatch(/sipher_admin=;/)
  })
})
