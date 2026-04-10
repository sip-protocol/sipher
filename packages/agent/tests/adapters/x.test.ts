import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { GuardianEvent } from '../../src/coordination/event-bus.js'
import type { AgentResponse } from '../../src/core/types.js'

// ─────────────────────────────────────────────────────────────────────────────
// Hoisted mocks — vi.hoisted() ensures these exist before vi.mock factories
// ─────────────────────────────────────────────────────────────────────────────

type Handler = (event: GuardianEvent) => void

const {
  mockProcessMessage,
  mockGetBudgetStatus,
  handlers,
  emittedEvents,
  mockGuardianBus,
} = vi.hoisted(() => {
  const mockProcessMessage = vi.fn<(ctx: unknown) => Promise<AgentResponse>>()
  const mockGetBudgetStatus = vi.fn()
  const handlers = new Map<string, Handler[]>()
  const emittedEvents: GuardianEvent[] = []
  const mockGuardianBus = {
    on: vi.fn((type: string, handler: Handler) => {
      if (!handlers.has(type)) handlers.set(type, [])
      handlers.get(type)!.push(handler)
    }),
    emit: vi.fn((event: GuardianEvent) => {
      emittedEvents.push(event)
    }),
  }
  return { mockProcessMessage, mockGetBudgetStatus, handlers, emittedEvents, mockGuardianBus }
})

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../../src/core/agent-core.js', () => ({
  AgentCore: vi.fn().mockImplementation(() => ({
    processMessage: mockProcessMessage,
  })),
}))

vi.mock('../../src/herald/herald.js', () => ({
  HERALD_SYSTEM_PROMPT: 'mock-system-prompt',
  HERALD_TOOLS: [],
  HERALD_TOOL_EXECUTORS: {},
}))

vi.mock('../../src/herald/budget.js', () => ({
  getBudgetStatus: () => mockGetBudgetStatus(),
}))

vi.mock('../../src/coordination/event-bus.js', () => ({
  guardianBus: mockGuardianBus,
}))

// ─────────────────────────────────────────────────────────────────────────────
// Import after mocks
// ─────────────────────────────────────────────────────────────────────────────

import { createXAdapter } from '../../src/adapters/x.js'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeMentionEvent(overrides: Partial<GuardianEvent['data']> = {}): GuardianEvent {
  return {
    source: 'herald',
    type: 'herald:mention',
    level: 'routine',
    data: {
      mentionId: 'tweet_123',
      authorId: 'user_456',
      text: 'What is SIP Protocol?',
      intent: 'question',
      tool: null,
      needsExecLink: false,
      confidence: 0.9,
      ...overrides,
    },
    timestamp: new Date().toISOString(),
  }
}

function makeDMEvent(overrides: Partial<GuardianEvent['data']> = {}): GuardianEvent {
  return {
    source: 'herald',
    type: 'herald:dm',
    level: 'routine',
    data: {
      dmId: 'dm_789',
      senderId: 'user_101',
      text: 'How do stealth addresses work?',
      intent: 'question',
      tool: null,
      needsExecLink: false,
      confidence: 0.85,
      ...overrides,
    },
    timestamp: new Date().toISOString(),
  }
}

function dispatchEvent(event: GuardianEvent): void {
  const list = handlers.get(event.type) ?? []
  for (const handler of list) handler(event)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  handlers.clear()
  emittedEvents.length = 0
  mockProcessMessage.mockResolvedValue({ text: 'reply text', toolsUsed: [] })
  mockGetBudgetStatus.mockReturnValue({ gate: 'normal', spent: 0, limit: 150, percentage: 0 })
})

describe('createXAdapter', () => {
  it('subscribes to herald:mention and herald:dm events', () => {
    createXAdapter()

    const registeredTypes = mockGuardianBus.on.mock.calls.map(
      (call) => call[0],
    )
    expect(registeredTypes).toContain('herald:mention')
    expect(registeredTypes).toContain('herald:dm')
  })

  it('ignores spam mentions', async () => {
    createXAdapter()
    dispatchEvent(makeMentionEvent({ intent: 'spam' }))

    await new Promise((r) => setTimeout(r, 50))

    expect(mockProcessMessage).not.toHaveBeenCalled()
  })

  it('processes question mentions through AgentCore', async () => {
    createXAdapter()
    dispatchEvent(makeMentionEvent())

    await new Promise((r) => setTimeout(r, 50))

    expect(mockProcessMessage).toHaveBeenCalledWith({
      platform: 'x',
      userId: 'user_456',
      message: 'What is SIP Protocol?',
      metadata: { mentionId: 'tweet_123', intent: 'question' },
    })
  })

  it('processes DMs through AgentCore', async () => {
    createXAdapter()
    dispatchEvent(makeDMEvent())

    await new Promise((r) => setTimeout(r, 50))

    expect(mockProcessMessage).toHaveBeenCalledWith({
      platform: 'x',
      userId: 'user_101',
      message: 'How do stealth addresses work?',
      metadata: { dmId: 'dm_789', intent: 'question', isDM: true },
    })
  })

  it('skips mentions when budget gate is paused', async () => {
    mockGetBudgetStatus.mockReturnValue({ gate: 'paused', spent: 150, limit: 150, percentage: 100 })
    createXAdapter()
    dispatchEvent(makeMentionEvent())

    await new Promise((r) => setTimeout(r, 50))

    expect(mockProcessMessage).not.toHaveBeenCalled()
  })

  it('skips mentions when budget gate is dm-only', async () => {
    mockGetBudgetStatus.mockReturnValue({ gate: 'dm-only', spent: 143, limit: 150, percentage: 95 })
    createXAdapter()
    dispatchEvent(makeMentionEvent())

    await new Promise((r) => setTimeout(r, 50))

    expect(mockProcessMessage).not.toHaveBeenCalled()
  })

  it('processes DMs even when budget gate is dm-only', async () => {
    mockGetBudgetStatus.mockReturnValue({ gate: 'dm-only', spent: 143, limit: 150, percentage: 95 })
    createXAdapter()
    dispatchEvent(makeDMEvent())

    await new Promise((r) => setTimeout(r, 50))

    expect(mockProcessMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'x',
        userId: 'user_101',
        metadata: expect.objectContaining({ isDM: true }),
      }),
    )
  })
})
