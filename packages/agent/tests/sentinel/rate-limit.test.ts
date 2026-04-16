import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('sentinel rate-limit queries', () => {
  beforeEach(() => { process.env.DB_PATH = ':memory:' })
  afterEach(() => { delete process.env.DB_PATH })

  async function freshDb() {
    const { closeDb, getDb } = await import('../../src/db.js')
    closeDb()
    getDb()
  }

  it('isFundActionWithinRateLimit returns true when under cap', async () => {
    await freshDb()
    const { insertPendingAction } = await import('../../src/db.js')
    const { isFundActionWithinRateLimit } = await import('../../src/sentinel/rate-limit.js')
    insertPendingAction({ actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 0 })
    expect(isFundActionWithinRateLimit('w1', 5)).toBe(true)
  })

  it('isFundActionWithinRateLimit returns false when cap reached', async () => {
    await freshDb()
    const { insertPendingAction } = await import('../../src/db.js')
    const { isFundActionWithinRateLimit } = await import('../../src/sentinel/rate-limit.js')
    for (let i = 0; i < 3; i++) {
      insertPendingAction({ actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 0 })
    }
    expect(isFundActionWithinRateLimit('w1', 3)).toBe(false)
    expect(isFundActionWithinRateLimit('w1', 4)).toBe(true)
  })

  it('isFundActionWithinRateLimit is per-wallet', async () => {
    await freshDb()
    const { insertPendingAction } = await import('../../src/db.js')
    const { isFundActionWithinRateLimit } = await import('../../src/sentinel/rate-limit.js')
    insertPendingAction({ actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 0 })
    insertPendingAction({ actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 0 })
    expect(isFundActionWithinRateLimit('w1', 2)).toBe(false)
    expect(isFundActionWithinRateLimit('w2', 2)).toBe(true)
  })

  it('isBlacklistWithinRateLimit returns true under cap', async () => {
    await freshDb()
    const { insertBlacklist } = await import('../../src/db.js')
    const { isBlacklistWithinRateLimit } = await import('../../src/sentinel/rate-limit.js')
    insertBlacklist({ address: 'a1', reason: 'r', severity: 'warn', addedBy: 'sentinel' })
    expect(isBlacklistWithinRateLimit(20)).toBe(true)
  })

  it('isBlacklistWithinRateLimit returns false when cap reached', async () => {
    await freshDb()
    const { insertBlacklist } = await import('../../src/db.js')
    const { isBlacklistWithinRateLimit } = await import('../../src/sentinel/rate-limit.js')
    for (let i = 0; i < 5; i++) {
      insertBlacklist({ address: `a${i}`, reason: 'r', severity: 'warn', addedBy: 'sentinel' })
    }
    expect(isBlacklistWithinRateLimit(5)).toBe(false)
  })

  it('isBlacklistWithinRateLimit only counts sentinel-added entries', async () => {
    await freshDb()
    const { insertBlacklist } = await import('../../src/db.js')
    const { isBlacklistWithinRateLimit } = await import('../../src/sentinel/rate-limit.js')
    for (let i = 0; i < 3; i++) {
      insertBlacklist({ address: `admin${i}`, reason: 'r', severity: 'warn', addedBy: 'admin:rector' })
    }
    // admin-added entries don't count against SENTINEL's rate limit
    expect(isBlacklistWithinRateLimit(2)).toBe(true)
  })
})
