import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import {
  checkAndIncrement,
  ipRateLimitMiddleware,
  _resetForTests,
} from '../../src/lib/ip-rate-limit.js'

describe('checkAndIncrement', () => {
  beforeEach(async () => {
    await _resetForTests()
  })

  it('allows the first request and decrements remaining', async () => {
    const result = await checkAndIncrement('1.2.3.4', 'demo', 5, 60_000)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
    expect(result.cap).toBe(5)
    expect(result.resetAt).toBeGreaterThan(Date.now())
  })

  it('counts within the same window', async () => {
    await checkAndIncrement('1.2.3.4', 'demo', 5, 60_000)
    const r2 = await checkAndIncrement('1.2.3.4', 'demo', 5, 60_000)
    expect(r2.remaining).toBe(3)
  })

  it('returns allowed=false when cap exceeded', async () => {
    for (let i = 0; i < 5; i++) await checkAndIncrement('1.2.3.4', 'demo', 5, 60_000)
    const denied = await checkAndIncrement('1.2.3.4', 'demo', 5, 60_000)
    expect(denied.allowed).toBe(false)
    expect(denied.remaining).toBe(0)
  })

  it('isolates buckets per IP', async () => {
    await checkAndIncrement('1.1.1.1', 'demo', 5, 60_000)
    const r = await checkAndIncrement('2.2.2.2', 'demo', 5, 60_000)
    expect(r.remaining).toBe(4)
  })

  it('isolates buckets per key for same IP', async () => {
    await checkAndIncrement('1.2.3.4', 'demo', 5, 60_000)
    const r = await checkAndIncrement('1.2.3.4', 'chat', 5, 60_000)
    expect(r.remaining).toBe(4)
  })

  it('resets the bucket after window expires', async () => {
    vi.useFakeTimers()
    await checkAndIncrement('1.2.3.4', 'demo', 1, 1_000)
    const denied = await checkAndIncrement('1.2.3.4', 'demo', 1, 1_000)
    expect(denied.allowed).toBe(false)
    vi.advanceTimersByTime(1_001)
    const fresh = await checkAndIncrement('1.2.3.4', 'demo', 1, 1_000)
    expect(fresh.allowed).toBe(true)
    expect(fresh.remaining).toBe(0)
    vi.useRealTimers()
  })
})

describe('ipRateLimitMiddleware', () => {
  beforeEach(async () => {
    await _resetForTests()
  })

  function makeApp(key: string, cap: number, windowMs: number) {
    const app = express()
    app.set('trust proxy', 1)
    app.get('/test', ipRateLimitMiddleware(key, cap, windowMs), (_req, res) => {
      res.json({ ok: true })
    })
    return app
  }

  it('sets X-RateLimit-* headers on success', async () => {
    const app = makeApp('demo', 5, 60_000)
    const res = await request(app).get('/test')
    expect(res.status).toBe(200)
    expect(res.headers['x-ratelimit-limit']).toBe('5')
    expect(res.headers['x-ratelimit-remaining']).toBe('4')
    expect(Number(res.headers['x-ratelimit-reset'])).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('returns 429 + RATE_LIMITED envelope on exceeded', async () => {
    const app = makeApp('demo', 1, 60_000)
    await request(app).get('/test')
    const res = await request(app).get('/test')
    expect(res.status).toBe(429)
    expect(res.body).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: expect.stringMatching(/rate limit/i),
        resetAt: expect.any(Number),
      },
    })
  })

  it('honors X-Forwarded-For when trust proxy is set', async () => {
    const app = makeApp('demo', 1, 60_000)
    await request(app).get('/test').set('X-Forwarded-For', '5.5.5.5')
    const res = await request(app).get('/test').set('X-Forwarded-For', '6.6.6.6')
    expect(res.status).toBe(200)
    expect(res.headers['x-ratelimit-remaining']).toBe('0')
  })
})
