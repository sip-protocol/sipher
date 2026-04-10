import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { AgentResponse, ResponseChunk } from '../../src/core/types.js'

// ─────────────────────────────────────────────────────────────────────────────
// Mock AgentCore — prevent real LLM calls
// ─────────────────────────────────────────────────────────────────────────────

const mockProcessMessage = vi.fn<(ctx: unknown) => Promise<AgentResponse>>()
const mockStreamMessage = vi.fn()

vi.mock('../../src/core/agent-core.js', () => ({
  AgentCore: vi.fn().mockImplementation(() => ({
    processMessage: mockProcessMessage,
    streamMessage: mockStreamMessage,
  })),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Import after mocks are registered
// ─────────────────────────────────────────────────────────────────────────────

import { createWebAdapter } from '../../src/adapters/web.js'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — minimal Express-like req/res mocks
// ─────────────────────────────────────────────────────────────────────────────

function mockReq(overrides: Record<string, unknown> = {}) {
  return { body: {}, wallet: 'TestWallet123', ...overrides } as never
}

function mockRes() {
  const writes: string[] = []
  const headers: Record<string, string> = {}
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn((k: string, v: string) => { headers[k] = v }),
    flushHeaders: vi.fn(),
    write: vi.fn((data: string) => { writes.push(data) }),
    end: vi.fn(),
    on: vi.fn(),
    writableEnded: false,
    _writes: writes,
    _headers: headers,
  }
  return res as typeof res & { _writes: string[]; _headers: Record<string, string> }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockProcessMessage.mockResolvedValue({
    text: 'adapter response',
    toolsUsed: ['balance'],
  })
  mockStreamMessage.mockImplementation(async function* () {
    yield { type: 'text', text: 'streaming ' } as ResponseChunk
    yield { type: 'text', text: 'response' } as ResponseChunk
    yield { type: 'done', text: 'streaming response' } as ResponseChunk
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// handleCommand
// ─────────────────────────────────────────────────────────────────────────────

describe('handleCommand', () => {
  it('returns AgentResponse for valid message', async () => {
    const adapter = createWebAdapter()
    const req = mockReq({ body: { message: 'test' } })
    const res = mockRes()

    await adapter.handleCommand(req, res)

    expect(res.json).toHaveBeenCalledWith({
      status: 'ok',
      wallet: 'TestWallet123',
      response: { text: 'adapter response', toolsUsed: ['balance'] },
    })
    expect(mockProcessMessage).toHaveBeenCalledWith({
      platform: 'web',
      userId: 'TestWallet123',
      message: 'test',
    })
  })

  it('rejects missing message with 400', async () => {
    const adapter = createWebAdapter()
    const req = mockReq({ body: {} })
    const res = mockRes()

    await adapter.handleCommand(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'message is required' })
  })

  it('rejects message exceeding 4000 chars with 400', async () => {
    const adapter = createWebAdapter()
    const req = mockReq({ body: { message: 'x'.repeat(4001) } })
    const res = mockRes()

    await adapter.handleCommand(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'message exceeds 4000 character limit',
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// handleChat
// ─────────────────────────────────────────────────────────────────────────────

describe('handleChat', () => {
  it('returns response from last user message', async () => {
    const adapter = createWebAdapter()
    const req = mockReq({
      body: {
        messages: [
          { role: 'user', content: 'first question' },
          { role: 'assistant', content: 'first answer' },
          { role: 'user', content: 'follow up' },
        ],
      },
    })
    const res = mockRes()

    await adapter.handleChat(req, res)

    expect(mockProcessMessage).toHaveBeenCalledWith({
      platform: 'web',
      userId: 'TestWallet123',
      message: 'follow up',
    })
    expect(res.json).toHaveBeenCalledWith({
      text: 'adapter response',
      toolsUsed: ['balance'],
    })
  })

  it('rejects empty messages array with 400', async () => {
    const adapter = createWebAdapter()
    const req = mockReq({ body: { messages: [] } })
    const res = mockRes()

    await adapter.handleChat(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'messages array is required and must not be empty',
    })
  })

  it('rejects missing messages with 400', async () => {
    const adapter = createWebAdapter()
    const req = mockReq({ body: {} })
    const res = mockRes()

    await adapter.handleChat(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'messages array is required and must not be empty',
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// handleChatStream
// ─────────────────────────────────────────────────────────────────────────────

describe('handleChatStream', () => {
  it('writes SSE events in correct format', async () => {
    const adapter = createWebAdapter()
    const req = mockReq({
      body: {
        messages: [{ role: 'user', content: 'stream test' }],
      },
    })
    const res = mockRes()

    await adapter.handleChatStream(req, res)

    // Should have 3 chunk writes + [DONE]
    const sseWrites = res._writes.filter((w) => w.startsWith('data: '))
    expect(sseWrites).toHaveLength(4) // 2 text + 1 done + [DONE]

    // Verify text chunks map to content_block_delta
    const first = JSON.parse(sseWrites[0].replace('data: ', '').trim())
    expect(first).toEqual({ type: 'content_block_delta', text: 'streaming ' })

    const second = JSON.parse(sseWrites[1].replace('data: ', '').trim())
    expect(second).toEqual({ type: 'content_block_delta', text: 'response' })

    // Verify done chunk maps to message_complete
    const done = JSON.parse(sseWrites[2].replace('data: ', '').trim())
    expect(done).toEqual({
      type: 'message_complete',
      content: 'streaming response',
    })

    // Verify final [DONE] sentinel
    expect(sseWrites[3]).toBe('data: [DONE]\n\n')

    // Verify stream ended
    expect(res.end).toHaveBeenCalled()
  })

  it('sets correct SSE headers', async () => {
    const adapter = createWebAdapter()
    const req = mockReq({
      body: {
        messages: [{ role: 'user', content: 'headers test' }],
      },
    })
    const res = mockRes()

    await adapter.handleChatStream(req, res)

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/event-stream',
    )
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache')
    expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive')
    expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no')
    expect(res.flushHeaders).toHaveBeenCalled()
  })

  it('handles tool_start and tool_end chunks', async () => {
    mockStreamMessage.mockImplementation(async function* () {
      yield { type: 'tool_start', toolName: 'balance', toolId: 'tool_1' } as ResponseChunk
      yield { type: 'tool_end', toolName: 'balance', toolId: 'tool_1', success: true } as ResponseChunk
      yield { type: 'done', text: 'done' } as ResponseChunk
    })

    const adapter = createWebAdapter()
    const req = mockReq({
      body: { messages: [{ role: 'user', content: 'check' }] },
    })
    const res = mockRes()

    await adapter.handleChatStream(req, res)

    const sseWrites = res._writes.filter((w) => w.startsWith('data: ') && w !== 'data: [DONE]\n\n')
    const toolStart = JSON.parse(sseWrites[0].replace('data: ', '').trim())
    expect(toolStart).toEqual({
      type: 'tool_use',
      name: 'balance',
      id: 'tool_1',
    })

    const toolEnd = JSON.parse(sseWrites[1].replace('data: ', '').trim())
    expect(toolEnd).toEqual({
      type: 'tool_result',
      name: 'balance',
      id: 'tool_1',
      success: true,
    })
  })

  it('writes error event on stream failure', async () => {
    mockStreamMessage.mockImplementation(async function* () {
      yield { type: 'text', text: 'partial' } as ResponseChunk
      throw new Error('LLM connection lost')
    })

    const adapter = createWebAdapter()
    const req = mockReq({
      body: { messages: [{ role: 'user', content: 'fail' }] },
    })
    const res = mockRes()

    await adapter.handleChatStream(req, res)

    const errorWrite = res._writes.find((w) =>
      w.includes('"type":"error"'),
    )
    expect(errorWrite).toBeDefined()
    const parsed = JSON.parse(errorWrite!.replace('data: ', '').trim())
    expect(parsed.type).toBe('error')
    expect(parsed.message).toBe('LLM connection lost')

    // Should still end with [DONE]
    expect(res._writes[res._writes.length - 1]).toBe('data: [DONE]\n\n')
    expect(res.end).toHaveBeenCalled()
  })

  it('rejects missing messages with 400', async () => {
    const adapter = createWebAdapter()
    const req = mockReq({ body: {} })
    const res = mockRes()

    await adapter.handleChatStream(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'messages array is required and must not be empty',
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// core reference
// ─────────────────────────────────────────────────────────────────────────────

describe('adapter core reference', () => {
  it('exposes core instance', () => {
    const adapter = createWebAdapter()
    expect(adapter.core).toBeDefined()
    expect(adapter.core.processMessage).toBeDefined()
    expect(adapter.core.streamMessage).toBeDefined()
  })
})
