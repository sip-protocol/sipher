import { describe, it, expect } from 'vitest'
import {
  shouldAutoRefund,
  isRefundSafe,
  generateIdempotencyKey,
} from '../../src/sentinel/refund-guard.js'

describe('refund-guard', () => {
  describe('shouldAutoRefund', () => {
    it('returns true when amount is below threshold', () => {
      expect(shouldAutoRefund(0.5, 1)).toBe(true)
    })

    it('returns false when amount equals threshold', () => {
      expect(shouldAutoRefund(1, 1)).toBe(false)
    })

    it('returns false when amount is above threshold', () => {
      expect(shouldAutoRefund(5, 1)).toBe(false)
    })
  })

  describe('isRefundSafe', () => {
    it('returns true when deposit PDA is not in the in-flight set', () => {
      const result = isRefundSafe('pda123', [
        'pda_abc456',
        'pda_def789',
        'pda_ghi012',
      ])
      expect(result).toBe(true)
    })

    it('returns false when deposit PDA is present in the in-flight set', () => {
      const result = isRefundSafe('pda123', [
        'pda_abc456',
        'pda123',
        'pda_ghi012',
      ])
      expect(result).toBe(false)
    })

    it('requires an exact match, not a substring', () => {
      const result = isRefundSafe('pda123', [
        'pda_abc456',
        'pda123_something',
        'prefix_pda123',
      ])
      expect(result).toBe(true)
    })
  })

  describe('generateIdempotencyKey', () => {
    it('returns deterministic key for same inputs', () => {
      const key1 = generateIdempotencyKey('pda123', 1000)
      const key2 = generateIdempotencyKey('pda123', 1000)
      expect(key1).toBe(key2)
    })

    it('returns different key for different inputs', () => {
      const key1 = generateIdempotencyKey('pda123', 1000)
      const key2 = generateIdempotencyKey('pda456', 1000)
      const key3 = generateIdempotencyKey('pda123', 2000)
      expect(key1).not.toBe(key2)
      expect(key1).not.toBe(key3)
    })
  })
})
