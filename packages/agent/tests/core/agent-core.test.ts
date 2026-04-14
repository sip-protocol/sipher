import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { MsgContext, ResponseChunk } from '../../src/core/types.js'

// ─────────────────────────────────────────────────────────────────────────────
// Mock agent.ts — prevent real LLM calls
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../../src/agent.js', () => ({
  chat: vi.fn().mockResolvedValue({ text: 'Mock response', toolsUsed: [] }),
  chatStream: vi.fn().mockImplementation(async function* () {
    yield { type: 'content_block_delta', text: 'Mock ' }
    yield { type: 'content_block_delta', text: 'streamed' }
    yield { type: 'message_complete', content: 'Mock streamed' }
  }),
  executeTool: vi.fn().mockResolvedValue({ ok: true }),
  TOOLS: [],
  SYSTEM_PROMPT: 'Test system prompt',
}))

// ─────────────────────────────────────────────────────────────────────────────
// Import after mocks are registered
// ─────────────────────────────────────────────────────────────────────────────

import { AgentCore } from '../../src/core/agent-core.js'
import { chat } from '../../src/agent.js'
import { closeDb } from '../../src/db.js'
import { clearConversation, resolveSession } from '../../src/session.js'

const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
  vi.clearAllMocks()
})

afterEach(() => {
  clearConversation(resolveSession(WALLET).id)
  closeDb()
  delete process.env.DB_PATH
})

// ─────────────────────────────────────────────────────────────────────────────
// processMessage
// ─────────────────────────────────────────────────────────────────────────────

describe('AgentCore.processMessage', () => {
  it('returns text response from chat', async () => {
    const core = new AgentCore()
    const ctx: MsgContext = {
      platform: 'web',
      userId: WALLET,
      message: 'What is my balance?',
    }

    const result = await core.processMessage(ctx)

    expect(result.text).toBe('Mock response')
    expect(result.toolsUsed).toEqual([])
  })

  it('propagates toolsUsed from chat return value', async () => {
    const chatMock = vi.mocked(chat)
    chatMock.mockResolvedValueOnce({
      text: 'Your balance is 5 SOL',
      toolsUsed: ['balance', 'scan'],
    })

    const core = new AgentCore()
    const ctx: MsgContext = {
      platform: 'web',
      userId: WALLET,
      message: 'Check my balance',
    }

    const result = await core.processMessage(ctx)

    expect(result.text).toBe('Your balance is 5 SOL')
    expect(result.toolsUsed).toEqual(['balance', 'scan'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// streamMessage
// ─────────────────────────────────────────────────────────────────────────────

describe('AgentCore.streamMessage', () => {
  it('yields text chunks and a done chunk', async () => {
    const core = new AgentCore()
    const ctx: MsgContext = {
      platform: 'telegram',
      userId: WALLET,
      message: 'Send 1 SOL',
    }

    const chunks: ResponseChunk[] = []
    for await (const chunk of core.streamMessage(ctx)) {
      chunks.push(chunk)
    }

    // Should have 2 text chunks + 1 done
    const textChunks = chunks.filter((c) => c.type === 'text')
    expect(textChunks).toHaveLength(2)
    expect(textChunks[0].text).toBe('Mock ')
    expect(textChunks[1].text).toBe('streamed')

    const doneChunk = chunks.find((c) => c.type === 'done')
    expect(doneChunk).toBeDefined()
    expect(doneChunk!.text).toBe('Mock streamed')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Session resolution
// ─────────────────────────────────────────────────────────────────────────────

describe('AgentCore session resolution', () => {
  it('resolves session from userId without errors on repeated calls', async () => {
    const core = new AgentCore()
    const ctx: MsgContext = {
      platform: 'x',
      userId: WALLET,
      message: 'Hello',
    }

    // First call — creates session
    const result1 = await core.processMessage(ctx)
    expect(result1.text).toBe('Mock response')

    // Second call — reuses session, no errors
    const result2 = await core.processMessage(ctx)
    expect(result2.text).toBe('Mock response')
  })
})
