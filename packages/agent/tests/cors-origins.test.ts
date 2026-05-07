import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import express, { type Request, type Response } from 'express'
import supertest from 'supertest'
import { buildCorsMiddleware } from '../src/cors-config.js'

function createApp(corsOriginsEnv: string) {
  const app = express()
  const middleware = buildCorsMiddleware(corsOriginsEnv)
  if (middleware) app.use(middleware)
  app.get('/test', (_req: Request, res: Response) => res.json({ ok: true }))
  return app
}

describe('CORS allowlist', () => {
  it('accepts a production origin in the explicit allowlist', async () => {
    const app = createApp('https://sipher.sip-protocol.org')
    const res = await supertest(app)
      .get('/test')
      .set('Origin', 'https://sipher.sip-protocol.org')
    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBe('https://sipher.sip-protocol.org')
  })

  it('accepts a Vercel preview origin matching *-sipher.vercel.app', async () => {
    const app = createApp('https://sipher.sip-protocol.org')
    const res = await supertest(app)
      .get('/test')
      .set('Origin', 'https://feat-redesign-tokens-sipher.vercel.app')
    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBe('https://feat-redesign-tokens-sipher.vercel.app')
  })

  it('rejects an unrelated origin not in the allowlist and not a sipher preview', async () => {
    const app = createApp('https://sipher.sip-protocol.org')
    const res = await supertest(app)
      .get('/test')
      .set('Origin', 'https://evil.example.com')
    expect(res.status).toBe(200) // request still served; CORS headers simply absent
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('rejects a different Vercel project that is not *-sipher.vercel.app', async () => {
    const app = createApp('https://sipher.sip-protocol.org')
    const res = await supertest(app)
      .get('/test')
      .set('Origin', 'https://something-else.vercel.app')
    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('passes requests with no Origin header (SSR / curl)', async () => {
    const app = createApp('https://sipher.sip-protocol.org')
    const res = await supertest(app).get('/test') // no Origin header
    expect(res.status).toBe(200)
    // No Origin on request → no ACAO header emitted (no-cors context)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('returns no CORS middleware when corsOriginsEnv is empty', async () => {
    const middleware = buildCorsMiddleware('')
    expect(middleware).toBeNull()
  })
})
