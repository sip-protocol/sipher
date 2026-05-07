import { describe, expect, it } from 'vitest'
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

  it('accepts a Vercel preview origin under the rectors-projects team', async () => {
    const app = createApp('https://sipher.sip-protocol.org')
    const res = await supertest(app)
      .get('/test')
      .set('Origin', 'https://sipher-96i1chii4-rectors-projects.vercel.app')
    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBe('https://sipher-96i1chii4-rectors-projects.vercel.app')
  })

  it('accepts a Vercel branch-deploy origin under the rectors-projects team', async () => {
    const app = createApp('https://sipher.sip-protocol.org')
    const res = await supertest(app)
      .get('/test')
      .set('Origin', 'https://sipher-git-feat-redesign-rectors-projects.vercel.app')
    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBe('https://sipher-git-feat-redesign-rectors-projects.vercel.app')
  })

  it('rejects an unrelated origin not in the allowlist and not a sipher preview', async () => {
    const app = createApp('https://sipher.sip-protocol.org')
    const res = await supertest(app)
      .get('/test')
      .set('Origin', 'https://evil.example.com')
    expect(res.status).toBe(200) // request still served; CORS headers simply absent
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('rejects a different Vercel project under any team', async () => {
    const app = createApp('https://sipher.sip-protocol.org')
    const res = await supertest(app)
      .get('/test')
      .set('Origin', 'https://something-else-rectors-projects.vercel.app')
    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('rejects a sipher-named project under a different team', async () => {
    const app = createApp('https://sipher.sip-protocol.org')
    const res = await supertest(app)
      .get('/test')
      .set('Origin', 'https://sipher-abc-attacker-team.vercel.app')
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

  it('sets Vary: Origin on every response so shared caches key by origin', async () => {
    const app = createApp('https://sipher.sip-protocol.org')
    const res = await supertest(app)
      .get('/test')
      .set('Origin', 'https://sipher.sip-protocol.org')
    expect(res.headers['vary']).toBe('Origin')
  })

  it('OPTIONS preflight from allowed origin returns 204 with full CORS headers and Max-Age', async () => {
    const app = createApp('https://sipher.sip-protocol.org')
    const res = await supertest(app)
      .options('/test')
      .set('Origin', 'https://sipher.sip-protocol.org')
      .set('Access-Control-Request-Method', 'POST')
    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe('https://sipher.sip-protocol.org')
    expect(res.headers['access-control-allow-credentials']).toBe('true')
    expect(res.headers['access-control-allow-methods']).toBe('GET, POST, PATCH, DELETE, OPTIONS')
    expect(res.headers['access-control-allow-headers']).toBe('Content-Type, Authorization')
    expect(res.headers['access-control-max-age']).toBe('86400')
    expect(res.headers['vary']).toBe('Origin')
  })

  it('OPTIONS preflight from rejected origin returns 204 with no ACAO header', async () => {
    const app = createApp('https://sipher.sip-protocol.org')
    const res = await supertest(app)
      .options('/test')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'POST')
    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
    expect(res.headers['access-control-allow-credentials']).toBeUndefined()
    expect(res.headers['vary']).toBe('Origin')
  })
})
