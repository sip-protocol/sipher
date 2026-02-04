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

describe('Health endpoint', () => {
  it('GET /v1/health returns 200', async () => {
    const res = await request(app).get('/v1/health')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('healthy')
    expect(res.body.data.version).toBe('0.1.0')
    expect(res.body.data.solana.connected).toBe(true)
  })

  it('GET /v1/health includes uptime', async () => {
    const res = await request(app).get('/v1/health')
    expect(res.body.data.uptime).toBeTypeOf('number')
    expect(res.body.data.uptime).toBeGreaterThanOrEqual(0)
  })

  it('GET /v1/health includes memory usage', async () => {
    const res = await request(app).get('/v1/health')
    expect(res.body.data.memory).toBeDefined()
    expect(res.body.data.memory.heapUsedMB).toBeTypeOf('number')
    expect(res.body.data.memory.rssMB).toBeTypeOf('number')
    expect(res.body.data.memory.heapUsedMB).toBeGreaterThan(0)
    expect(res.body.data.memory.rssMB).toBeGreaterThan(0)
  })

  it('GET /v1/health includes RPC latency', async () => {
    const res = await request(app).get('/v1/health')
    expect(res.body.data.solana.latencyMs).toBeTypeOf('number')
    expect(res.body.data.solana.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('GET /v1/health includes endpoint count', async () => {
    const res = await request(app).get('/v1/health')
    expect(res.body.data.endpoints).toBe(35)
  })
})

describe('Readiness probe', () => {
  it('GET /v1/ready returns 200 when healthy', async () => {
    const res = await request(app).get('/v1/ready')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.ready).toBe(true)
    expect(res.body.data.checks.solana).toBe(true)
    expect(res.body.data.checks.shutdown).toBe(true)
  })
})

describe('Root endpoint', () => {
  it('GET / returns service info', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('sipher')
    expect(res.body.version).toBe('0.1.0')
    expect(res.body.endpoints).toBeDefined()
    expect(res.body.endpoints.health).toBe('GET /v1/health')
  })
})

describe('Skill file', () => {
  it('GET /skill.md returns markdown', async () => {
    const res = await request(app).get('/skill.md')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/markdown/)
    expect(res.text).toContain('Sipher')
  })
})

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/v1/nonexistent')
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})

describe('Request ID', () => {
  it('generates X-Request-ID header', async () => {
    const res = await request(app).get('/')
    expect(res.headers['x-request-id']).toBeDefined()
  })

  it('preserves client X-Request-ID', async () => {
    const res = await request(app)
      .get('/')
      .set('X-Request-ID', 'test-req-123')
    expect(res.headers['x-request-id']).toBe('test-req-123')
  })
})
