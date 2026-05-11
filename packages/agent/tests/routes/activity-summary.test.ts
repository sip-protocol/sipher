import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
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

  // Regression: anonymization test catches extra KEYS but not malicious VALUES.
  // If a future ingest path writes a wallet-probe string into `detail.chain`,
  // the unauthed teaser would leak it. Whitelist guard must replace any
  // unknown chain with the `solana` fallback.
  it('replaces unknown chain values with solana fallback (defense against value injection)', async () => {
    insertActivity({
      agent: 'sipher',
      level: 'info',
      type: 'send.success',
      title: 'malicious',
      detail: JSON.stringify({
        amount: 1,
        chain: 'C1phr1nj3ct3d-wallet-probe-value',
      }),
    })
    const res = await request(app).get('/api/public/activity-summary')
    expect(res.status).toBe(200)
    expect(res.body.recent).toHaveLength(1)
    expect(res.body.recent[0].chain).toBe('solana')
    // Defense-in-depth: the injected sentinel string must appear nowhere in
    // the response body, under any key.
    expect(JSON.stringify(res.body)).not.toContain('C1phr1nj3ct3d')
    expect(JSON.stringify(res.body)).not.toContain('wallet-probe')
  })

  it('preserves known chain values from the whitelist (case-insensitive)', async () => {
    insertActivity({
      agent: 'sipher',
      level: 'info',
      type: 'send.success',
      title: 'eth-event',
      detail: JSON.stringify({ amount: 1, chain: 'ETHEREUM' }),
    })
    insertActivity({
      agent: 'sipher',
      level: 'info',
      type: 'swap.completed',
      title: 'arb-event',
      detail: JSON.stringify({ amount: 1, chain: 'arbitrum' }),
    })
    const res = await request(app).get('/api/public/activity-summary')
    expect(res.status).toBe(200)
    const chains = res.body.recent.map((r: { chain: string }) => r.chain).sort()
    expect(chains).toEqual(['arbitrum', 'ethereum'])
  })

  it('amount band buckets work as documented', async () => {
    const { toAmountBand } = await import('../../src/lib/queries/public.js')
    expect(toAmountBand(0.5)).toBe('<1')
    expect(toAmountBand(5)).toBe('1-10')
    expect(toAmountBand(50)).toBe('10-100')
    expect(toAmountBand(500)).toBe('100-1000')
    expect(toAmountBand(5_000)).toBe('>1000')
  })

  // Regression: 500 responses on this unauthed endpoint must NOT leak the raw
  // error message — defense-in-depth against anonymous callers fingerprinting
  // SQLite version, infra state, or stack-frame paths via 500 bodies.
  it('returns generic 500 envelope when computation throws — raw error not leaked', async () => {
    const dbModule = await import('../../src/db.js')
    const spy = vi.spyOn(dbModule, 'getDb').mockImplementation(() => {
      throw new Error('PRIVATE_INTERNAL_DETAIL: sqlite3_step failure at /opt/secret/path')
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const res = await request(app).get('/api/public/activity-summary')

      expect(res.status).toBe(500)
      expect(res.body).toEqual({
        error: { code: 'INTERNAL', message: 'activity-summary unavailable' },
      })
      // Defense-in-depth: response body must NEVER contain the raw error detail.
      expect(JSON.stringify(res.body)).not.toContain('PRIVATE_INTERNAL_DETAIL')
      expect(JSON.stringify(res.body)).not.toContain('/opt/secret/path')
      expect(JSON.stringify(res.body)).not.toContain('sqlite3_step')
      // But the raw message MUST still hit server logs so operators can debug.
      expect(errSpy).toHaveBeenCalledWith(
        '[activity-summary]',
        expect.stringContaining('PRIVATE_INTERNAL_DETAIL'),
      )
    } finally {
      spy.mockRestore()
      errSpy.mockRestore()
    }
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
