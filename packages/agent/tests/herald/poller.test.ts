import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  createPollerState,
  getNextInterval,
  reactiveEnabled,
  startPoller,
  stopPoller,
  checkScheduledPosts,
} from '../../src/herald/poller.js'

// ─── Module mocks (hoisted by vitest) ────────────────────────────────────────

vi.mock('../../src/herald/approval.js', () => ({
  getReadyToPublish: vi.fn(),
  markPublished: vi.fn(),
}))

vi.mock('../../src/herald/tools/post-tweet.js', () => ({
  publishTweet: vi.fn(),
}))

vi.mock('../../src/herald/discord.js', () => ({
  crosspostDigest: vi.fn().mockResolvedValue(undefined),
}))

import { getReadyToPublish, markPublished } from '../../src/herald/approval.js'
import { publishTweet } from '../../src/herald/tools/post-tweet.js'
import { crosspostDigest } from '../../src/herald/discord.js'

describe('HERALD adaptive poller', () => {
  it('createPollerState() returns correct defaults', () => {
    const prevInterval = process.env.HERALD_POLL_INTERVAL
    delete process.env.HERALD_POLL_INTERVAL

    const state = createPollerState()

    expect(state.mentionInterval).toBe(600000)
    expect(state.dmInterval).toBe(600000)
    expect(state.emptyStreaks).toBe(0)
    expect(state.lastMentionId).toBeNull()
    expect(state.lastDmId).toBeNull()
    expect(state.running).toBe(false)

    if (prevInterval !== undefined) process.env.HERALD_POLL_INTERVAL = prevInterval
  })

  it('getNextInterval() backs off 3x after 3+ empty polls', () => {
    const state = createPollerState()
    state.emptyStreaks = 3
    const base = state.mentionInterval

    const interval = getNextInterval(state)

    expect(interval).toBe(base * 3)
    expect(interval).toBeGreaterThan(base)
  })

  it('getNextInterval() returns base interval when emptyStreaks=0', () => {
    const state = createPollerState()
    state.emptyStreaks = 0
    const base = state.mentionInterval

    const interval = getNextInterval(state)

    expect(interval).toBe(base)
  })
})

describe('reactiveEnabled (HERALD_REACTIVE_ENABLED gate)', () => {
  afterEach(() => {
    delete process.env.HERALD_REACTIVE_ENABLED
  })

  it('defaults to false when the var is unset', () => {
    delete process.env.HERALD_REACTIVE_ENABLED
    expect(reactiveEnabled()).toBe(false)
  })

  it('is true only when set to exactly "true"', () => {
    process.env.HERALD_REACTIVE_ENABLED = 'true'
    expect(reactiveEnabled()).toBe(true)
  })

  it('treats any other value as disabled (fail-safe)', () => {
    for (const v of ['', 'false', 'TRUE', '1', 'yes']) {
      process.env.HERALD_REACTIVE_ENABLED = v
      expect(reactiveEnabled()).toBe(false)
    }
  })
})

describe('startPoller reactive gate', () => {
  afterEach(() => {
    delete process.env.HERALD_REACTIVE_ENABLED
  })

  it('does NOT start mention/DM timers when reactive is disabled, but still publishes scheduled posts', () => {
    delete process.env.HERALD_REACTIVE_ENABLED
    const state = createPollerState()

    const timers = startPoller(state)

    expect(timers.mentionsTimer).toBeNull()
    expect(timers.dmsTimer).toBeNull()
    expect(timers.scheduledTimer).not.toBeNull()
    expect(state.running).toBe(true)

    stopPoller(state, timers)
    expect(state.running).toBe(false)
  })

  it('starts all three timers when reactive is enabled', () => {
    process.env.HERALD_REACTIVE_ENABLED = 'true'
    const state = createPollerState()

    const timers = startPoller(state)

    expect(timers.mentionsTimer).not.toBeNull()
    expect(timers.dmsTimer).not.toBeNull()
    expect(timers.scheduledTimer).not.toBeNull()

    stopPoller(state, timers)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// checkScheduledPosts — Discord cross-post regression
// ─────────────────────────────────────────────────────────────────────────────

describe('checkScheduledPosts', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calls crosspostDigest with the post row and tweet_id after a successful publish', async () => {
    const post = { id: 'row-1', type: 'content', content: 'recap', created_at: '2026-06-12T08:00:00.000Z' }
    const mockedGetReady = vi.mocked(getReadyToPublish)
    const mockedPublish = vi.mocked(publishTweet)
    const mockedCrosspost = vi.mocked(crosspostDigest)

    mockedGetReady.mockReturnValue([post])
    mockedPublish.mockResolvedValue({ tweet_id: 'tw_99' })

    await checkScheduledPosts()

    expect(mockedPublish).toHaveBeenCalledOnce()
    expect(vi.mocked(markPublished)).toHaveBeenCalledWith('row-1', 'tw_99')
    expect(mockedCrosspost).toHaveBeenCalledOnce()
    expect(mockedCrosspost).toHaveBeenCalledWith(post, 'tw_99')
  })
})
