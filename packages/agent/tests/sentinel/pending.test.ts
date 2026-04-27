import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createPending,
  resolvePending,
  rejectPending,
  clearAll,
  _setTimeoutMsForTests,
} from '../../src/sentinel/pending.js'

describe('sentinel-pending', () => {
  beforeEach(() => {
    for (const s of ['test-session', 's1', 's2']) clearAll(s)
    _setTimeoutMsForTests(120_000)
    vi.useRealTimers()
  })

  it('resolves the pending promise on resolvePending', async () => {
    const { flagId, promise } = createPending('test-session', 'send', { amount: 1 })
    setTimeout(() => resolvePending(flagId), 5)
    await expect(promise).resolves.toBeUndefined()
  })

  it('rejects the pending promise on rejectPending', async () => {
    const { flagId, promise } = createPending('test-session', 'send', { amount: 1 })
    setTimeout(() => rejectPending(flagId, 'cancelled_by_user'), 5)
    await expect(promise).rejects.toThrow('cancelled_by_user')
  })

  it('returns false for unknown flag id', () => {
    expect(resolvePending('unknown-id')).toBe(false)
    expect(rejectPending('unknown-id', 'x')).toBe(false)
  })

  it('rejects with timeout after configured duration', async () => {
    _setTimeoutMsForTests(50)
    const { promise } = createPending('test-session', 'send', { amount: 1 })
    await expect(promise).rejects.toThrow(/timed out/i)
  })

  it('clearAll rejects all pending in the given session', async () => {
    const a = createPending('s1', 'send', {})
    const b = createPending('s1', 'swap', {})
    const c = createPending('s2', 'send', {})
    clearAll('s1')
    await expect(a.promise).rejects.toThrow(/disconnected/i)
    await expect(b.promise).rejects.toThrow(/disconnected/i)
    setTimeout(() => resolvePending(c.flagId), 5)
    await expect(c.promise).resolves.toBeUndefined()
  })
})
