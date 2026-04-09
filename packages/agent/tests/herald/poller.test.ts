import { describe, it, expect } from 'vitest'
import { createPollerState, getNextInterval } from '../../src/herald/poller.js'

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
