import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { resetBackendRegistry } from '../src/services/backend-registry.js'
import { createApiKey, resetApiKeyService } from '../src/services/api-keys.js'

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation(function () { return ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    }) }),
  }
})

const { default: app } = await import('../src/server.js')

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetBackendRegistry()
  resetApiKeyService()
})

// ─── GET /v1/backends ──────────────────────────────────────────────────────────

describe('GET /v1/backends', () => {
  it('returns 200 with backends array containing sip-native', async () => {
    const res = await request(app).get('/v1/backends')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.backends).toBeInstanceOf(Array)
    expect(res.body.data.backends.length).toBeGreaterThanOrEqual(1)

    const sipNative = res.body.data.backends.find((b: any) => b.name === 'sip-native')
    expect(sipNative).toBeDefined()
  })

  it('backend has correct name, type, and chains', async () => {
    const res = await request(app).get('/v1/backends')
    const sipNative = res.body.data.backends[0]

    expect(sipNative.name).toBe('sip-native')
    expect(sipNative.type).toBeDefined()
    expect(sipNative.chains).toBeInstanceOf(Array)
    expect(sipNative.chains.length).toBeGreaterThan(0)
  })

  it('includes capabilities (hiddenAmount, hiddenRecipient, etc.)', async () => {
    const res = await request(app).get('/v1/backends')
    const caps = res.body.data.backends[0].capabilities

    expect(caps).toBeDefined()
    expect(typeof caps.hiddenAmount).toBe('boolean')
    expect(typeof caps.hiddenRecipient).toBe('boolean')
    expect(typeof caps.hiddenSender).toBe('boolean')
    expect(typeof caps.complianceSupport).toBe('boolean')
    expect(typeof caps.setupRequired).toBe('boolean')
    expect(['fast', 'medium', 'slow']).toContain(caps.latencyEstimate)
  })

  it('includes health state', async () => {
    const res = await request(app).get('/v1/backends')
    const backend = res.body.data.backends[0]

    // Health may be null or object depending on tracker state
    if (backend.health) {
      expect(backend.health).toHaveProperty('circuitState')
      expect(backend.health).toHaveProperty('isHealthy')
    }
  })

  it('returns total and totalEnabled counts', async () => {
    const res = await request(app).get('/v1/backends')

    expect(res.body.data.total).toBeGreaterThanOrEqual(1)
    expect(res.body.data.totalEnabled).toBeGreaterThanOrEqual(1)
    expect(res.body.data.totalEnabled).toBeLessThanOrEqual(res.body.data.total)
  })
})

// ─── GET /v1/backends/:id/health ──────────────────────────────────────────────

describe('GET /v1/backends/:id/health', () => {
  it('returns 200 with health data for sip-native', async () => {
    const res = await request(app).get('/v1/backends/sip-native/health')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.name).toBe('sip-native')
  })

  it('includes availability result', async () => {
    const res = await request(app).get('/v1/backends/sip-native/health')

    expect(typeof res.body.data.available).toBe('boolean')
  })

  it('includes capabilities in response', async () => {
    const res = await request(app).get('/v1/backends/sip-native/health')

    expect(res.body.data.capabilities).toBeDefined()
    expect(typeof res.body.data.capabilities.hiddenAmount).toBe('boolean')
  })

  it('returns 404 for non-existent backend', async () => {
    const res = await request(app).get('/v1/backends/nonexistent/health')

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('NOT_FOUND')
    expect(res.body.error.available).toBeInstanceOf(Array)
  })

  it('returns metrics (may be null if no requests yet)', async () => {
    const res = await request(app).get('/v1/backends/sip-native/health')

    // Metrics can be null when no requests have been tracked
    if (res.body.data.metrics) {
      expect(typeof res.body.data.metrics.totalRequests).toBe('number')
      expect(typeof res.body.data.metrics.averageLatencyMs).toBe('number')
    } else {
      expect(res.body.data.metrics).toBeNull()
    }
  })
})

// ─── POST /v1/backends/select ─────────────────────────────────────────────────

describe('POST /v1/backends/select', () => {
  it('returns 400 for missing body', async () => {
    const res = await request(app)
      .post('/v1/backends/select')
      .send({})

    expect(res.status).toBe(400)
  })

  it('returns 400 for non-existent backend', async () => {
    const key = createApiKey('pro', 'Test Backend Select')
    const res = await request(app)
      .post('/v1/backends/select')
      .set('X-API-Key', key.key)
      .send({ backend: 'nonexistent-backend' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.available).toBeInstanceOf(Array)
  })

  it('returns 400 when no tiered API key', async () => {
    // Without setting X-API-Key, req.apiKey will be undefined in test mode
    const res = await request(app)
      .post('/v1/backends/select')
      .send({ backend: 'sip-native' })

    expect(res.status).toBe(400)
    expect(res.body.error.message).toContain('tiered API key')
  })

  it('successfully selects backend with tiered key', async () => {
    const key = createApiKey('pro', 'Test Backend Select')
    const res = await request(app)
      .post('/v1/backends/select')
      .set('X-API-Key', key.key)
      .send({ backend: 'sip-native' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.keyId).toBe(key.id)
    expect(res.body.data.preferredBackend).toBe('sip-native')
  })

  it('returns keyId and preferredBackend in response', async () => {
    const key = createApiKey('enterprise', 'Enterprise Select')
    const res = await request(app)
      .post('/v1/backends/select')
      .set('X-API-Key', key.key)
      .send({ backend: 'sip-native' })

    expect(res.body.data).toHaveProperty('keyId')
    expect(res.body.data).toHaveProperty('preferredBackend')
    expect(typeof res.body.data.keyId).toBe('string')
  })
})

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe('Backend edge cases', () => {
  it('GET /backends returns health when tracker has no data yet', async () => {
    // Fresh registry — health tracker exists but no requests have been made
    const res = await request(app).get('/v1/backends')

    expect(res.status).toBe(200)
    const backend = res.body.data.backends[0]
    // Health state may be null or have default values
    if (backend.health) {
      expect(backend.health.consecutiveFailures).toBe(0)
    }
  })

  it('GET /backends/:id/health with valid but unused backend', async () => {
    const res = await request(app).get('/v1/backends/sip-native/health')

    expect(res.status).toBe(200)
    expect(res.body.data.available).toBe(true)
  })
})
