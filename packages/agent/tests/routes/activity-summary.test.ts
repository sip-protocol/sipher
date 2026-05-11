import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { _resetForTests as resetIpRateLimit } from '../../src/lib/ip-rate-limit.js'
import { _resetForTests as resetCache } from '../../src/lib/cache.js'
import { closeDb, insertActivity } from '../../src/db.js'

describe('/api/public/activity-summary', () => {
  let app: express.Express

  beforeEach(async () => {
    process.env.DB_PATH = ':memory:'
    await resetIpRateLimit()
    await resetCache()
    const { publicRouter } = await import('../../src/routes/public/index.js')
    app = express()
    app.set('trust proxy', 1)
    app.use('/api/public', publicRouter)
  })

  afterEach(() => {
    closeDb()
    delete process.env.DB_PATH
  })

  it('returns counter + recent rows shape', async () => {
    insertActivity({
      agent: 'sipher',
      level: 'info',
      type: 'send.success',
      title: 'Sent 1 SOL',
      detail: JSON.stringify({ amount: 1, chain: 'solana' }),
    })
    const res = await request(app).get('/api/public/activity-summary')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      counter: expect.any(Number),
      recent: expect.any(Array),
    })
    expect(res.body.counter).toBeGreaterThan(0)
  })

  it('recent rows have only the anonymized fields', async () => {
    insertActivity({
      agent: 'sipher',
      level: 'info',
      type: 'send.success',
      title: 'Sent',
      wallet: 'SecretWallet1111111111111111111111111111111',
      detail: JSON.stringify({ amount: 0.5, chain: 'solana', recipient: 'SecretRecipient', signature: 'tx-hash' }),
    })
    const res = await request(app).get('/api/public/activity-summary')
    expect(res.status).toBe(200)
    expect(res.body.recent.length).toBeGreaterThan(0)
    for (const row of res.body.recent) {
      expect(Object.keys(row).sort()).toEqual(['amountBand', 'chain', 'relativeTime', 'type'])
      expect(['<1', '1-10', '10-100', '100-1000', '>1000']).toContain(row.amountBand)
    }
  })

  it('returns counter = 0 and recent = [] when no matching events exist', async () => {
    const res = await request(app).get('/api/public/activity-summary')
    expect(res.status).toBe(200)
    expect(res.body.counter).toBe(0)
    expect(res.body.recent).toEqual([])
  })

  it('caches response within 60s window', async () => {
    insertActivity({
      agent: 'sipher',
      level: 'info',
      type: 'send.success',
      title: 'first',
      detail: JSON.stringify({ amount: 1, chain: 'solana' }),
    })
    const res1 = await request(app).get('/api/public/activity-summary')
    // Insert another row that should NOT appear if cache is honored
    insertActivity({
      agent: 'sipher',
      level: 'info',
      type: 'send.success',
      title: 'second',
      detail: JSON.stringify({ amount: 50, chain: 'solana' }),
    })
    const res2 = await request(app).get('/api/public/activity-summary')
    expect(res2.body).toEqual(res1.body)
  })

  it('rate-limited at 120 req/min/IP', async () => {
    for (let i = 0; i < 120; i++) await request(app).get('/api/public/activity-summary')
    const res = await request(app).get('/api/public/activity-summary')
    expect(res.status).toBe(429)
  })

  it('amount band buckets work as documented', async () => {
    const { toAmountBand } = await import('../../src/lib/queries/public.js')
    expect(toAmountBand(0.5)).toBe('<1')
    expect(toAmountBand(5)).toBe('1-10')
    expect(toAmountBand(50)).toBe('10-100')
    expect(toAmountBand(500)).toBe('100-1000')
    expect(toAmountBand(5_000)).toBe('>1000')
  })

  // Regression: previously the route fetched the last 50 rows then JS-filtered
  // for fund-mover types. If non-fund-mover events dominate the recent window,
  // the teaser silently degrades — the SQL filter is the only way to keep the
  // teaser useful as the activity stream grows.
  it('recent rows are SQL-filtered to fund-mover types even when non-fund-mover rows dominate the recent window', async () => {
    // Seed 5 OLDER fund-mover events first.
    for (let i = 0; i < 5; i++) {
      insertActivity({
        agent: 'sipher',
        level: 'info',
        type: 'send.success',
        title: `fund-${i}`,
        detail: JSON.stringify({ amount: i + 1, chain: 'solana' }),
      })
    }
    // Then seed 60 NEWER non-fund-mover events. With the old JS-filter
    // (over-fetch limit=50, then filter), the 5 fund-mover rows are pushed
    // out of the limit window entirely → recent becomes [].
    for (let i = 0; i < 60; i++) {
      insertActivity({
        agent: 'sipher',
        level: 'info',
        type: 'agent.info',
        title: `noise-${i}`,
        detail: JSON.stringify({ chain: 'solana' }),
      })
    }
    const res = await request(app).get('/api/public/activity-summary')
    expect(res.status).toBe(200)
    expect(res.body.recent).toHaveLength(5)
    for (const row of res.body.recent) {
      expect(['send.success', 'swap.success', 'send.completed', 'swap.completed']).toContain(row.type)
    }
  })
})
