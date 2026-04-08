import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { closeDb } from '../src/db.js'
import {
  resolveSession,
  getConversation,
  appendConversation,
  clearConversation,
  purgeStale,
  activeSessionCount,
  IDLE_TIMEOUT,
} from '../src/session.js'

// ─────────────────────────────────────────────────────────────────────────────
// Use in-memory SQLite for all tests + reset conversation state
// ─────────────────────────────────────────────────────────────────────────────

const WALLET_A = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'
const WALLET_B = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  // Clear all conversations between tests to ensure isolation
  // We purge by clearing each known session — brute force via purgeStale
  // won't work since entries may not be stale yet, so we clear individually
  clearConversation(resolveSession(WALLET_A).id)
  clearConversation(resolveSession(WALLET_B).id)
  closeDb()
  delete process.env.DB_PATH
})

// ─────────────────────────────────────────────────────────────────────────────
// resolveSession
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveSession', () => {
  it('creates a session for a new wallet with 64-char hex ID', () => {
    const ctx = resolveSession(WALLET_A)
    expect(ctx.id).toHaveLength(64)
    expect(ctx.id).toMatch(/^[0-9a-f]{64}$/)
    expect(ctx.wallet).toBe(WALLET_A)
    expect(ctx.preferences).toEqual({})
  })

  it('returns the same session for the same wallet', () => {
    const ctx1 = resolveSession(WALLET_A)
    const ctx2 = resolveSession(WALLET_A)
    expect(ctx1.id).toBe(ctx2.id)
    expect(ctx1.wallet).toBe(ctx2.wallet)
  })

  it('returns different sessions for different wallets', () => {
    const ctxA = resolveSession(WALLET_A)
    const ctxB = resolveSession(WALLET_B)
    expect(ctxA.id).not.toBe(ctxB.id)
    expect(ctxA.wallet).not.toBe(ctxB.wallet)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Conversation management
// ─────────────────────────────────────────────────────────────────────────────

describe('conversation management', () => {
  it('returns empty array for session with no conversation', () => {
    const ctx = resolveSession(WALLET_A)
    expect(getConversation(ctx.id)).toEqual([])
  })

  it('appends and retrieves messages', () => {
    const ctx = resolveSession(WALLET_A)

    appendConversation(ctx.id, [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ])

    const messages = getConversation(ctx.id)
    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({ role: 'user', content: 'Hello' })
    expect(messages[1]).toEqual({ role: 'assistant', content: 'Hi there' })
  })

  it('appends to existing conversation', () => {
    const ctx = resolveSession(WALLET_A)

    appendConversation(ctx.id, [{ role: 'user', content: 'First' }])
    appendConversation(ctx.id, [{ role: 'assistant', content: 'Response' }])

    const messages = getConversation(ctx.id)
    expect(messages).toHaveLength(2)
    expect(messages[0].content).toBe('First')
    expect(messages[1].content).toBe('Response')
  })

  it('clears conversation for a session', () => {
    const ctx = resolveSession(WALLET_A)

    appendConversation(ctx.id, [
      { role: 'user', content: 'Something' },
    ])
    expect(getConversation(ctx.id)).toHaveLength(1)

    clearConversation(ctx.id)
    expect(getConversation(ctx.id)).toEqual([])
  })

  it('clearing non-existent conversation is a no-op', () => {
    expect(() => clearConversation('nonexistent')).not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Conversation isolation between wallets
// ─────────────────────────────────────────────────────────────────────────────

describe('conversation isolation', () => {
  it('isolates conversations between different wallets', () => {
    const ctxA = resolveSession(WALLET_A)
    const ctxB = resolveSession(WALLET_B)

    appendConversation(ctxA.id, [
      { role: 'user', content: 'Wallet A message' },
    ])
    appendConversation(ctxB.id, [
      { role: 'user', content: 'Wallet B message' },
      { role: 'assistant', content: 'Wallet B response' },
    ])

    const messagesA = getConversation(ctxA.id)
    const messagesB = getConversation(ctxB.id)

    expect(messagesA).toHaveLength(1)
    expect(messagesA[0].content).toBe('Wallet A message')

    expect(messagesB).toHaveLength(2)
    expect(messagesB[0].content).toBe('Wallet B message')
  })

  it('clearing one wallet does not affect another', () => {
    const ctxA = resolveSession(WALLET_A)
    const ctxB = resolveSession(WALLET_B)

    appendConversation(ctxA.id, [{ role: 'user', content: 'A' }])
    appendConversation(ctxB.id, [{ role: 'user', content: 'B' }])

    clearConversation(ctxA.id)

    expect(getConversation(ctxA.id)).toEqual([])
    expect(getConversation(ctxB.id)).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Active session count
// ─────────────────────────────────────────────────────────────────────────────

describe('activeSessionCount', () => {
  it('returns 0 when no conversations exist', () => {
    expect(activeSessionCount()).toBe(0)
  })

  it('tracks active conversations', () => {
    const ctxA = resolveSession(WALLET_A)
    const ctxB = resolveSession(WALLET_B)

    appendConversation(ctxA.id, [{ role: 'user', content: 'hi' }])
    expect(activeSessionCount()).toBe(1)

    appendConversation(ctxB.id, [{ role: 'user', content: 'hey' }])
    expect(activeSessionCount()).toBe(2)
  })

  it('decrements when conversation is cleared', () => {
    const ctxA = resolveSession(WALLET_A)
    appendConversation(ctxA.id, [{ role: 'user', content: 'hi' }])
    expect(activeSessionCount()).toBe(1)

    clearConversation(ctxA.id)
    expect(activeSessionCount()).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Stale session purge
// ─────────────────────────────────────────────────────────────────────────────

describe('purgeStale', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0 when no conversations exist', () => {
    expect(purgeStale()).toBe(0)
  })

  it('does not purge active conversations', () => {
    const ctx = resolveSession(WALLET_A)
    appendConversation(ctx.id, [{ role: 'user', content: 'active' }])

    expect(purgeStale()).toBe(0)
    expect(activeSessionCount()).toBe(1)
  })

  it('purges conversations idle beyond 30min timeout', () => {
    const ctxA = resolveSession(WALLET_A)
    const ctxB = resolveSession(WALLET_B)

    appendConversation(ctxA.id, [{ role: 'user', content: 'will go stale' }])
    appendConversation(ctxB.id, [{ role: 'user', content: 'also stale soon' }])

    // Advance time past the 30-minute idle timeout
    vi.advanceTimersByTime(IDLE_TIMEOUT + 1)

    // Now make wallet B active again by appending
    appendConversation(ctxB.id, [{ role: 'user', content: 'refreshed' }])

    // Wallet A is stale, wallet B was just refreshed
    const purged = purgeStale()
    expect(purged).toBe(1)
    expect(activeSessionCount()).toBe(1)

    // Wallet B's conversation survives (1 original + 1 refreshed = 2)
    expect(getConversation(ctxB.id)).toHaveLength(2)
  })

  it('getConversation returns empty for timed-out session', () => {
    const ctx = resolveSession(WALLET_A)
    appendConversation(ctx.id, [{ role: 'user', content: 'will timeout' }])

    // Advance past the timeout
    vi.advanceTimersByTime(IDLE_TIMEOUT + 1)

    // getConversation should return empty and auto-evict
    expect(getConversation(ctx.id)).toEqual([])
    expect(activeSessionCount()).toBe(0)
  })

  it('idle timeout is 30 minutes', () => {
    expect(IDLE_TIMEOUT).toBe(30 * 60 * 1000)
  })
})
