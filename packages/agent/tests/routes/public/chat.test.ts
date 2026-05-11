import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { SSEEvent } from '../../../src/agent.js'

// ─────────────────────────────────────────────────────────────────────────────
// Mock chatStream — prevent real LLM calls. The mock yields a deterministic
// SSE stream so the route handler exercises every code path (write deltas,
// forward sentinel-free events, terminate with [DONE]).
//
// We retain a handle to inspect ChatOptions the route passes through so we
// can assert no-tools + UNAUTHED_SYSTEM_PROMPT enforcement without depending
// on a live model.
// ─────────────────────────────────────────────────────────────────────────────

const chatStreamCalls: Array<{ userMessage: string; opts: Record<string, unknown> }> = []

vi.mock('../../../src/agent.js', async () => {
  const actual = await vi.importActual<typeof import('../../../src/agent.js')>(
    '../../../src/agent.js',
  )
  return {
    ...actual,
    chatStream: vi.fn().mockImplementation(async function* (
      userMessage: string,
      opts: Record<string, unknown>,
    ): AsyncGenerator<SSEEvent> {
      chatStreamCalls.push({ userMessage, opts })
      yield { type: 'content_block_delta', text: 'stealth address ' } as SSEEvent
      yield { type: 'content_block_delta', text: 'is a one-time recipient address.' } as SSEEvent
      yield { type: 'message_complete', content: 'stealth address is a one-time recipient address.' } as SSEEvent
    }),
  }
})

import express from 'express'
import request from 'supertest'
import { _resetForTests as resetIpRateLimit } from '../../../src/lib/ip-rate-limit.js'

describe('/api/public/chat/stream', () => {
  let app: express.Express

  beforeEach(async () => {
    chatStreamCalls.length = 0
    await resetIpRateLimit()
    const { publicRouter } = await import('../../../src/routes/public/index.js')
    app = express()
    app.set('trust proxy', 1)
    app.use(express.json())
    app.use('/api/public', publicRouter)
  })

  it('returns SSE stream on valid POST', async () => {
    const res = await request(app)
      .post('/api/public/chat/stream')
      .send({ messages: [{ role: 'user', content: 'What is a stealth address?' }] })
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
    expect(res.text).toContain('data: ')
    expect(res.text).toContain('[DONE]')
  })

  it('emits X-RateLimit-* headers', async () => {
    const res = await request(app)
      .post('/api/public/chat/stream')
      .send({ messages: [{ role: 'user', content: 'hello' }] })
    expect(res.headers['x-ratelimit-limit']).toBe('5')
    expect(Number(res.headers['x-ratelimit-remaining'])).toBeGreaterThanOrEqual(0)
    expect(Number(res.headers['x-ratelimit-remaining'])).toBeLessThanOrEqual(4)
    expect(res.headers['x-ratelimit-reset']).toBeDefined()
  })

  it('returns 429 + RATE_LIMITED envelope after 5 requests in 24h', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/public/chat/stream')
        .send({ messages: [{ role: 'user', content: 'q' }] })
    }
    const res = await request(app)
      .post('/api/public/chat/stream')
      .send({ messages: [{ role: 'user', content: 'q' }] })
    expect(res.status).toBe(429)
    expect(res.body).toEqual({
      error: { code: 'RATE_LIMITED', message: expect.any(String), resetAt: expect.any(Number) },
    })
  })

  it('different IPs have independent budgets', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/public/chat/stream')
        .send({ messages: [{ role: 'user', content: 'q' }] })
        .set('X-Forwarded-For', '1.1.1.1')
    }
    const res = await request(app)
      .post('/api/public/chat/stream')
      .send({ messages: [{ role: 'user', content: 'q' }] })
      .set('X-Forwarded-For', '2.2.2.2')
    expect(res.status).toBe(200)
  })

  it('exports UNAUTHED_SYSTEM_PROMPT as a string', async () => {
    const mod = await import('../../../src/routes/public/chat.js')
    expect(typeof mod.UNAUTHED_SYSTEM_PROMPT).toBe('string')
    expect(mod.UNAUTHED_SYSTEM_PROMPT).toMatch(/SIPHER/)
    expect(mod.UNAUTHED_SYSTEM_PROMPT).toMatch(/no tools/i)
  })

  it('invokes chatStream with empty tools array and UNAUTHED_SYSTEM_PROMPT', async () => {
    const mod = await import('../../../src/routes/public/chat.js')
    await request(app)
      .post('/api/public/chat/stream')
      .send({ messages: [{ role: 'user', content: 'How does a stealth address work?' }] })
    expect(chatStreamCalls.length).toBe(1)
    const call = chatStreamCalls[0]
    expect(call.userMessage).toBe('How does a stealth address work?')
    expect(call.opts.systemPrompt).toBe(mod.UNAUTHED_SYSTEM_PROMPT)
    expect(call.opts.tools).toEqual([])
  })

  it('rejects empty messages array with 400', async () => {
    const res = await request(app)
      .post('/api/public/chat/stream')
      .send({ messages: [] })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({
      error: { code: 'VALIDATION_FAILED', message: expect.any(String) },
    })
  })
})
