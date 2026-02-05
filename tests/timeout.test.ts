import { describe, it, expect } from 'vitest'
import { ENDPOINT_TIMEOUTS } from '../src/middleware/timeout.js'

describe('timeout middleware', () => {
  describe('ENDPOINT_TIMEOUTS', () => {
    it('has timeouts for all critical endpoints', () => {
      // Fast endpoints (15s)
      expect(ENDPOINT_TIMEOUTS['/v1/stealth/generate']).toBe(15_000)
      expect(ENDPOINT_TIMEOUTS['/v1/commitment/create']).toBe(15_000)

      // Batch operations (30s)
      expect(ENDPOINT_TIMEOUTS['/v1/stealth/generate/batch']).toBe(30_000)

      // Heavy operations (45s)
      expect(ENDPOINT_TIMEOUTS['/v1/scan/payments']).toBe(45_000)
      expect(ENDPOINT_TIMEOUTS['/v1/privacy/score']).toBe(45_000)

      // Proof generation (60s)
      expect(ENDPOINT_TIMEOUTS['/v1/proofs/funding/generate']).toBe(60_000)

      // Blockchain transactions (90s)
      expect(ENDPOINT_TIMEOUTS['/v1/transfer/claim']).toBe(90_000)
    })

    it('health endpoints have short timeouts', () => {
      expect(ENDPOINT_TIMEOUTS['/v1/health']).toBe(5_000)
      expect(ENDPOINT_TIMEOUTS['/v1/ready']).toBe(5_000)
    })

    it('all timeouts are reasonable values', () => {
      for (const [path, timeout] of Object.entries(ENDPOINT_TIMEOUTS)) {
        expect(timeout).toBeGreaterThanOrEqual(5_000)
        expect(timeout).toBeLessThanOrEqual(90_000)
        expect(Number.isInteger(timeout)).toBe(true)
      }
    })
  })
})
