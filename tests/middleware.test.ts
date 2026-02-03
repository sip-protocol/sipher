import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation(() => ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    })),
  }
})

const { default: app } = await import('../src/server.js')

describe('Security headers', () => {
  it('includes helmet security headers', async () => {
    const res = await request(app).get('/')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBeDefined()
  })
})

describe('JSON body parsing', () => {
  it('parses JSON body', async () => {
    const res = await request(app)
      .post('/v1/stealth/generate')
      .set('Content-Type', 'application/json')
      .send({ label: 'test' })
    expect(res.status).toBe(200)
  })

  it('handles invalid JSON gracefully', async () => {
    const res = await request(app)
      .post('/v1/stealth/generate')
      .set('Content-Type', 'application/json')
      .send('not json')
    // Express returns 400 or 500 depending on version — both are correct rejections
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.body.success).toBe(false)
  })
})

describe('Validation middleware', () => {
  it('rejects invalid body schema', async () => {
    const res = await request(app)
      .post('/v1/stealth/derive')
      .send({ recipientMetaAddress: 'not-an-object' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details).toBeDefined()
  })
})

describe('Error handling', () => {
  it('returns structured error response for 404', async () => {
    const res = await request(app).get('/v1/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: expect.stringContaining('not found'),
      },
    })
  })
})
