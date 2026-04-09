import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getDb, closeDb } from '../../src/db.js'

// ─── DB reset between tests ───────────────────────────────────────────────────

beforeEach(() => {
  // force fresh in-memory DB for every test
  closeDb()
  process.env.NODE_ENV = 'test'
  delete process.env.DB_PATH
  delete process.env.HERALD_MONTHLY_BUDGET
  // re-init schema
  getDb()
})

afterEach(() => {
  closeDb()
  vi.restoreAllMocks()
})

// ─── lazy-import so module picks up fresh DB ─────────────────────────────────

async function getBudget() {
  vi.resetModules()
  return import('../../src/herald/budget.js')
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('HERALD budget tracker', () => {
  it('starts with zero spend and gate = normal', async () => {
    const { getBudgetStatus } = await getBudget()
    const status = getBudgetStatus()
    expect(status.spent).toBe(0)
    expect(status.gate).toBe('normal')
    expect(status.percentage).toBe(0)
    expect(status.limit).toBe(150)
  })

  it('tracks API call costs (10 posts_read = $0.05)', async () => {
    const { trackXApiCost, getBudgetStatus } = await getBudget()
    trackXApiCost('posts_read', 10)
    const status = getBudgetStatus()
    expect(status.spent).toBeCloseTo(0.05, 5)
  })

  it('gate → cautious at 80% ($120 of $150)', async () => {
    const { trackXApiCost, getBudgetStatus } = await getBudget()
    // 120 / 0.010 user_read calls = 12000 resources
    trackXApiCost('user_read', 12000)
    const status = getBudgetStatus()
    expect(status.spent).toBeCloseTo(120, 4)
    expect(status.gate).toBe('cautious')
    expect(status.percentage).toBeCloseTo(80, 1)
  })

  it('gate → dm-only at 95% ($142.50 of $150)', async () => {
    const { trackXApiCost, getBudgetStatus } = await getBudget()
    // 142.5 / 0.015 dm_create = 9500 resources
    trackXApiCost('dm_create', 9500)
    const status = getBudgetStatus()
    expect(status.spent).toBeCloseTo(142.5, 4)
    expect(status.gate).toBe('dm-only')
    expect(status.percentage).toBeCloseTo(95, 1)
  })

  it('gate → paused at 100% ($150 of $150)', async () => {
    const { trackXApiCost, getBudgetStatus } = await getBudget()
    // 150 / 0.010 user_read = 15000
    trackXApiCost('user_read', 15000)
    const status = getBudgetStatus()
    expect(status.spent).toBeCloseTo(150, 4)
    expect(status.gate).toBe('paused')
    expect(status.percentage).toBeCloseTo(100, 1)
  })

  it('canMakeCall returns false when paused', async () => {
    const { trackXApiCost, canMakeCall } = await getBudget()
    trackXApiCost('user_read', 15000)
    expect(canMakeCall('posts_read')).toBe(false)
    expect(canMakeCall('dm_read')).toBe(false)
    expect(canMakeCall('dm_create')).toBe(false)
  })

  it('canMakeCall blocks mentions_read in dm-only but allows dm_read', async () => {
    const { trackXApiCost, canMakeCall } = await getBudget()
    // 95% = $142.50
    trackXApiCost('dm_create', 9500)
    expect(canMakeCall('mentions_read')).toBe(false)
    expect(canMakeCall('search_read')).toBe(false)
    expect(canMakeCall('posts_read')).toBe(false)
    expect(canMakeCall('content_create')).toBe(false)
    expect(canMakeCall('user_interaction')).toBe(false)
    expect(canMakeCall('dm_read')).toBe(true)
    expect(canMakeCall('dm_create')).toBe(true)
    expect(canMakeCall('user_read')).toBe(true)
  })
})
