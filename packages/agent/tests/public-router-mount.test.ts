import { describe, expect, it, beforeAll } from 'vitest'
import request from 'supertest'

// Probes /api/public/_smoke (a probe route added below) to confirm
// publicRouter mounts cleanly at the expected prefix and 404s on
// unmounted children.

describe('publicRouter mount point', () => {
  let app: import('express').Express

  beforeAll(async () => {
    const { publicRouter } = await import('../src/routes/public/index.js')
    publicRouter.get('/_smoke', (_req, res) => {
      res.json({ ok: true, mount: '/api/public' })
    })
    const express = (await import('express')).default
    app = express()
    app.set('trust proxy', 1)
    app.use('/api/public', publicRouter)
  })

  it('responds at /api/public/_smoke without auth', async () => {
    const res = await request(app).get('/api/public/_smoke')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, mount: '/api/public' })
  })

  it('returns 404 for unmounted /api/public/missing', async () => {
    const res = await request(app).get('/api/public/missing')
    expect(res.status).toBe(404)
  })
})
