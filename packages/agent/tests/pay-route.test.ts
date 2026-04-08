import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import supertest from 'supertest'
import { closeDb, createPaymentLink, getPaymentLink, markPaymentLinkPaid } from '../src/db.js'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

const { payRouter } = await import('../src/routes/pay.js')

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/pay', payRouter)
  return app
}

describe('GET /pay/:id', () => {
  it('returns 200 with HTML for a valid pending link', async () => {
    const link = createPaymentLink({
      id: 'test-link-1',
      stealth_address: 'StEaLtH1111111111111111111111111111111111111',
      ephemeral_pubkey: '0x' + 'bb'.repeat(32),
      amount: 5.0,
      token: 'SOL',
      memo: 'Coffee payment',
      expires_at: Date.now() + 3600_000,
    })
    const app = createApp()
    const res = await supertest(app).get(`/pay/${link.id}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/html/)
    expect(res.text).toContain('5')
    expect(res.text).toContain('SOL')
    expect(res.text).toContain('Coffee payment')
  })

  it('returns 404 for non-existent link', async () => {
    const app = createApp()
    const res = await supertest(app).get('/pay/does-not-exist')
    expect(res.status).toBe(404)
  })

  it('returns expired page for expired link', async () => {
    createPaymentLink({
      id: 'expired-link',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() - 1000,
    })
    const app = createApp()
    const res = await supertest(app).get('/pay/expired-link')
    expect(res.status).toBe(410)
    expect(res.text).toMatch(/expired/i)
  })

  it('returns already-paid page for paid link', async () => {
    createPaymentLink({
      id: 'paid-link',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    markPaymentLinkPaid('paid-link', 'tx-hash-123')
    const app = createApp()
    const res = await supertest(app).get('/pay/paid-link')
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/paid|completed/i)
  })

  it('renders open-amount page when amount is null', async () => {
    createPaymentLink({
      id: 'open-link',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    const app = createApp()
    const res = await supertest(app).get('/pay/open-link')
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/any amount/i)
  })
})

describe('POST /pay/:id/confirm', () => {
  it('marks a pending link as paid', async () => {
    createPaymentLink({
      id: 'confirm-test',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    const app = createApp()
    const res = await supertest(app)
      .post('/pay/confirm-test/confirm')
      .send({ txSignature: '5abc...def' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const link = getPaymentLink('confirm-test')
    expect(link!.status).toBe('paid')
    expect(link!.paid_tx).toBe('5abc...def')
  })

  it('rejects double-pay', async () => {
    createPaymentLink({
      id: 'double-pay',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    markPaymentLinkPaid('double-pay', 'first-tx')
    const app = createApp()
    const res = await supertest(app)
      .post('/pay/double-pay/confirm')
      .send({ txSignature: 'second-tx' })
    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/already.*paid/i)
  })

  it('rejects confirm without txSignature', async () => {
    createPaymentLink({
      id: 'no-sig',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    const app = createApp()
    const res = await supertest(app)
      .post('/pay/no-sig/confirm')
      .send({})
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent link', async () => {
    const app = createApp()
    const res = await supertest(app)
      .post('/pay/nope/confirm')
      .send({ txSignature: 'tx' })
    expect(res.status).toBe(404)
  })
})
