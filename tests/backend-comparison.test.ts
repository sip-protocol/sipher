import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { resetBackendRegistry } from '../src/services/backend-registry.js'
import { clearComparisonCache, scoreBackend, getPrivacyLevel, isBackendSuitableForOperation } from '../src/services/backend-comparison.js'

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetBackendRegistry()
  clearComparisonCache()
})

// ─── Basic Functionality ──────────────────────────────────────────────────────

describe('POST /v1/backends/compare — basic', () => {
  it('returns comparisons for stealth_privacy → 200', async () => {
    const res = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'stealth_privacy' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.operation).toBe('stealth_privacy')
    expect(res.body.data.chain).toBe('solana')
    expect(res.body.data.comparisons).toBeInstanceOf(Array)
    expect(res.body.data.recommendation).toBeDefined()
  })

  it('returns comparisons for encrypted_compute → 200', async () => {
    const res = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'encrypted_compute' })

    expect(res.status).toBe(200)
    expect(res.body.data.operation).toBe('encrypted_compute')
    expect(res.body.data.comparisons.length).toBeGreaterThanOrEqual(1)
  })

  it('returns comparisons for compliance_audit → 200', async () => {
    const res = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'compliance_audit' })

    expect(res.status).toBe(200)
    expect(res.body.data.operation).toBe('compliance_audit')
  })

  it('includes all registered backends in response', async () => {
    const res = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'stealth_privacy' })

    const names = res.body.data.comparisons.map((c: any) => c.backend)
    expect(names).toContain('sip-native')
  })
})

// ─── Scoring & Recommendations ────────────────────────────────────────────────

describe('POST /v1/backends/compare — scoring', () => {
  it('sip-native scored highest for stealth_privacy (free + fast)', async () => {
    const res = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'stealth_privacy' })

    const sipNative = res.body.data.comparisons.find((c: any) => c.backend === 'sip-native')
    expect(sipNative).toBeDefined()
    expect(sipNative.available).toBe(true)
    expect(sipNative.score).toBeGreaterThan(0)

    // sip-native should be the recommended one for stealth privacy
    expect(res.body.data.recommendation.best_overall).toBe('sip-native')
  })

  it('sip-native not available for encrypted_compute', async () => {
    const res = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'encrypted_compute' })

    const sipNative = res.body.data.comparisons.find((c: any) => c.backend === 'sip-native')
    // sip-native doesn't have hiddenCompute, so it shouldn't be available for compute
    expect(sipNative.available).toBe(false)
    expect(sipNative.score).toBe(0)
  })

  it('sip-native available for compliance_audit', async () => {
    const res = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'compliance_audit' })

    // sip-native has complianceSupport: true
    const sipNative = res.body.data.comparisons.find((c: any) => c.backend === 'sip-native')
    expect(sipNative.available).toBe(true)
  })

  it('sets recommended: true on highest-scored backend', async () => {
    const res = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'stealth_privacy' })

    const recommended = res.body.data.comparisons.filter((c: any) => c.recommended)
    expect(recommended.length).toBe(1)

    // Verify it's the first (highest scored)
    expect(res.body.data.comparisons[0].recommended).toBe(true)
  })

  it('recommendation object has best_overall, best_value, fastest, most_private', async () => {
    const res = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'stealth_privacy' })

    const rec = res.body.data.recommendation
    expect(rec).toHaveProperty('best_overall')
    expect(rec).toHaveProperty('best_value')
    expect(rec).toHaveProperty('fastest')
    expect(rec).toHaveProperty('most_private')
    expect(rec).toHaveProperty('reasoning')
    expect(typeof rec.reasoning).toBe('string')
  })
})

// ─── Prioritize Parameter ─────────────────────────────────────────────────────

describe('POST /v1/backends/compare — prioritize', () => {
  it('prioritize: "cost" adjusts score weighting', async () => {
    const defaultRes = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'stealth_privacy' })

    clearComparisonCache()

    const costRes = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'stealth_privacy', prioritize: 'cost' })

    const sipDefault = defaultRes.body.data.comparisons.find((c: any) => c.backend === 'sip-native')
    const sipCost = costRes.body.data.comparisons.find((c: any) => c.backend === 'sip-native')

    // Both should produce valid scores; prioritize changes weighting, not availability
    expect(sipDefault.score).toBeGreaterThan(0)
    expect(sipCost.score).toBeGreaterThan(0)
  })

  it('prioritize: "speed" adjusts score weighting', async () => {
    const defaultRes = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'stealth_privacy' })

    clearComparisonCache()

    const speedRes = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'stealth_privacy', prioritize: 'speed' })

    const sipDefault = defaultRes.body.data.comparisons.find((c: any) => c.backend === 'sip-native')
    const sipSpeed = speedRes.body.data.comparisons.find((c: any) => c.backend === 'sip-native')

    // Both should produce valid scores
    expect(sipDefault.score).toBeGreaterThan(0)
    expect(sipSpeed.score).toBeGreaterThan(0)
  })
})

// ─── Validation ───────────────────────────────────────────────────────────────

describe('POST /v1/backends/compare — validation', () => {
  it('rejects invalid operation type → 400', async () => {
    const res = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'invalid_op' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('rejects missing operation → 400', async () => {
    const res = await request(app)
      .post('/v1/backends/compare')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('defaults chain to solana', async () => {
    const res = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'stealth_privacy' })

    expect(res.body.data.chain).toBe('solana')
  })
})

// ─── Cache ────────────────────────────────────────────────────────────────────

describe('POST /v1/backends/compare — cache', () => {
  it('returns cached result on same params', async () => {
    const res1 = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'stealth_privacy' })

    const res2 = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'stealth_privacy' })

    expect(res1.body.data).toEqual(res2.body.data)
  })

  it('different params produce different (uncached) result', async () => {
    const res1 = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'stealth_privacy' })

    const res2 = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'encrypted_compute' })

    expect(res1.body.data.operation).toBe('stealth_privacy')
    expect(res2.body.data.operation).toBe('encrypted_compute')
    expect(res1.body.data.comparisons).not.toEqual(res2.body.data.comparisons)
  })

  it('clearComparisonCache() works', async () => {
    await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'stealth_privacy' })

    clearComparisonCache()

    // After clearing, a new request should still work
    const res = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'stealth_privacy' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe('POST /v1/backends/compare — edge cases', () => {
  it('costSOL formatted correctly for sip-native (5000 lamports)', async () => {
    const res = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'stealth_privacy' })

    const sipNative = res.body.data.comparisons.find((c: any) => c.backend === 'sip-native')
    expect(sipNative.costSOL).toBe('0.000005000')
    expect(sipNative.costLamports).toBe(5000)
  })

  it('unavailable backend has available: false and score 0', async () => {
    const res = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'encrypted_compute' })

    // sip-native doesn't support encrypted_compute
    const sipNative = res.body.data.comparisons.find((c: any) => c.backend === 'sip-native')
    expect(sipNative.available).toBe(false)
    expect(sipNative.score).toBe(0)
  })

  it('all registered backends returned in response', async () => {
    const res = await request(app)
      .post('/v1/backends/compare')
      .send({ operation: 'stealth_privacy' })

    // Only sip-native is registered
    expect(res.body.data.comparisons.length).toBe(1)
  })
})

// ─── Unit Tests (service functions) ───────────────────────────────────────────

describe('backend-comparison service functions', () => {
  it('scoreBackend produces valid 0-100 range', () => {
    const score = scoreBackend(0, 200, { hiddenAmount: true, hiddenRecipient: true, complianceSupport: true })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('getPrivacyLevel returns correct levels', () => {
    expect(getPrivacyLevel({ hiddenAmount: true, hiddenRecipient: true, hiddenSender: true })).toBe('maximum')
    expect(getPrivacyLevel({ hiddenAmount: true, hiddenRecipient: true })).toBe('high')
    expect(getPrivacyLevel({ hiddenCompute: true })).toBe('moderate')
    expect(getPrivacyLevel({})).toBe('basic')
  })

  it('isBackendSuitableForOperation filters correctly', () => {
    const stealthCaps = { hiddenAmount: true, hiddenRecipient: true, hiddenSender: true }
    const computeCaps = { hiddenCompute: true }
    const complianceCaps = { complianceSupport: true }

    expect(isBackendSuitableForOperation(stealthCaps, 'stealth_privacy')).toBe(true)
    expect(isBackendSuitableForOperation(stealthCaps, 'encrypted_compute')).toBe(false)
    expect(isBackendSuitableForOperation(computeCaps, 'encrypted_compute')).toBe(true)
    expect(isBackendSuitableForOperation(computeCaps, 'stealth_privacy')).toBe(false)
    expect(isBackendSuitableForOperation(complianceCaps, 'compliance_audit')).toBe(true)
    expect(isBackendSuitableForOperation(complianceCaps, 'encrypted_compute')).toBe(false)
  })
})
