import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getDb, closeDb } from '../../src/db.js'

// Mock twitter-api-v2 to avoid real API calls
vi.mock('twitter-api-v2', () => ({
  TwitterApi: vi.fn().mockImplementation(() => ({
    v2: {
      userMentionTimeline: vi.fn().mockResolvedValue({ data: { data: [] } }),
      listDmEvents: vi.fn().mockResolvedValue({ data: { data: [] } }),
      tweet: vi.fn().mockResolvedValue({ data: { id: 'tw-1', text: 'test' } }),
    },
  })),
}))

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
  process.env.HERALD_MONTHLY_BUDGET = '150'
  process.env.X_BEARER_TOKEN = 'test'
  process.env.X_CONSUMER_KEY = 'ck'
  process.env.X_CONSUMER_SECRET = 'cs'
  process.env.X_ACCESS_TOKEN = 'at'
  process.env.X_ACCESS_SECRET = 'as'
  process.env.HERALD_X_USER_ID = '999'
  getDb()
})

afterEach(() => {
  closeDb()
  for (const key of [
    'DB_PATH',
    'HERALD_MONTHLY_BUDGET',
    'X_BEARER_TOKEN',
    'X_CONSUMER_KEY',
    'X_CONSUMER_SECRET',
    'X_ACCESS_TOKEN',
    'X_ACCESS_SECRET',
    'HERALD_X_USER_ID',
  ]) {
    delete process.env[key]
  }
})

describe('HERALD Integration', () => {
  it('HERALD has 9 tools', async () => {
    const { HERALD_TOOLS } = await import('../../src/herald/herald.js')
    expect(HERALD_TOOLS).toHaveLength(9)
  })

  it('intent classifier + budget tracker work together', async () => {
    const { classifyIntent } = await import('../../src/herald/intent.js')
    const { getBudgetStatus, trackXApiCost } = await import('../../src/herald/budget.js')
    const intent = classifyIntent('@SipProtocol privacy score for 7xKz')
    expect(intent.intent).toBe('command')
    expect(intent.tool).toBe('privacyScore')
    trackXApiCost('posts_read', 5)
    const status = getBudgetStatus()
    expect(status.spent).toBeGreaterThan(0)
    expect(status.gate).toBe('normal')
  })

  it('approval queue → publish flow', async () => {
    const { executePostTweet } = await import('../../src/herald/tools/post-tweet.js')
    const { approvePost, getReadyToPublish } = await import('../../src/herald/approval.js')
    const queued = await executePostTweet({ text: 'Privacy is default.' })
    expect(queued.queued).toBe(true)
    expect(typeof queued.id).toBe('string')
    approvePost(queued.id, 'rector')
    const ready = getReadyToPublish()
    expect(ready.length).toBeGreaterThanOrEqual(1)
  })

  it('poller state management', async () => {
    const { createPollerState, getNextInterval } = await import('../../src/herald/poller.js')
    const state = createPollerState()
    expect(state.emptyStreaks).toBe(0)
    state.emptyStreaks = 3
    expect(getNextInterval(state)).toBeGreaterThan(state.mentionInterval)
    state.emptyStreaks = 0
    expect(getNextInterval(state)).toBe(state.mentionInterval)
  })
})
