import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Express } from 'express'

// ─────────────────────────────────────────────────────────────────────────────
// Mock the Anthropic SDK before importing agent module
// ─────────────────────────────────────────────────────────────────────────────

const mockStreamEvents: Array<{ type: string; delta?: unknown }> = []
let mockFinalMessage = {
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  content: [{ type: 'text', text: 'Hello from Sipher.' }],
  stop_reason: 'end_turn',
  model: 'anthropic/claude-sonnet-4-6',
  usage: { input_tokens: 10, output_tokens: 5 },
}

const mockStream = {
  [Symbol.asyncIterator]: async function* () {
    for (const event of mockStreamEvents) {
      yield event
    }
  },
  finalMessage: vi.fn().mockImplementation(() => Promise.resolve(mockFinalMessage)),
}

const mockMessagesStream = vi.fn().mockReturnValue(mockStream)
const mockMessagesCreate = vi.fn().mockResolvedValue(mockFinalMessage)

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockMessagesCreate,
        stream: mockMessagesStream,
      }
    },
  }
})

// Mock tools to prevent real SDK calls
vi.mock('../src/tools/index.js', () => {
  const makeTool = (name: string) => ({
    name,
    description: `Mock ${name} tool`,
    input_schema: { type: 'object', properties: {} },
  })
  const makeExecutor = () => vi.fn().mockResolvedValue({ success: true })
  return {
    depositTool: makeTool('deposit'),
    executeDeposit: makeExecutor(),
    sendTool: makeTool('send'),
    executeSend: makeExecutor(),
    refundTool: makeTool('refund'),
    executeRefund: makeExecutor(),
    balanceTool: makeTool('balance'),
    executeBalance: makeExecutor(),
    scanTool: makeTool('scan'),
    executeScan: makeExecutor(),
    claimTool: makeTool('claim'),
    executeClaim: makeExecutor(),
    swapTool: makeTool('swap'),
    executeSwap: makeExecutor(),
    viewingKeyTool: makeTool('viewingKey'),
    executeViewingKey: makeExecutor(),
    historyTool: makeTool('history'),
    executeHistory: makeExecutor(),
    statusTool: makeTool('status'),
    executeStatus: makeExecutor(),
    paymentLinkTool: makeTool('paymentLink'),
    executePaymentLink: makeExecutor(),
    invoiceTool: makeTool('invoice'),
    executeInvoice: makeExecutor(),
    privacyScoreTool: makeTool('privacyScore'),
    executePrivacyScore: makeExecutor(),
    threatCheckTool: makeTool('threatCheck'),
    executeThreatCheck: makeExecutor(),
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Import after mocks are set up
// ─────────────────────────────────────────────────────────────────────────────

import { chatStream, type SSEEvent } from '../src/agent.js'
import { app } from '../src/index.js'
import type { Server } from 'http'

// ─────────────────────────────────────────────────────────────────────────────
// Helper: collect all events from the async generator
// ─────────────────────────────────────────────────────────────────────────────

async function collectEvents(gen: AsyncGenerator<SSEEvent>): Promise<SSEEvent[]> {
  const events: SSEEvent[] = []
  for await (const event of gen) {
    events.push(event)
  }
  return events
}

// ─────────────────────────────────────────────────────────────────────────────
// chatStream unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('chatStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: simple text response with two deltas
    mockStreamEvents.length = 0
    mockStreamEvents.push(
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: ' from Sipher.' } },
    )
    mockFinalMessage = {
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello from Sipher.' }],
      stop_reason: 'end_turn',
      model: 'anthropic/claude-sonnet-4-6',
      usage: { input_tokens: 10, output_tokens: 5 },
    }
    mockStream.finalMessage.mockResolvedValue(mockFinalMessage)

    // Restore default stream mock (tool_use test overrides this)
    mockMessagesStream.mockReturnValue(mockStream)
  })

  it('is an async generator function', () => {
    const gen = chatStream([{ role: 'user', content: 'hi' }])
    expect(gen[Symbol.asyncIterator]).toBeDefined()
    expect(typeof gen.next).toBe('function')
    expect(typeof gen.return).toBe('function')
    expect(typeof gen.throw).toBe('function')
  })

  it('yields content_block_delta events for each text token', async () => {
    const events = await collectEvents(
      chatStream([{ role: 'user', content: 'hello' }])
    )

    const deltas = events.filter(e => e.type === 'content_block_delta')
    expect(deltas).toHaveLength(2)
    expect(deltas[0]).toEqual({ type: 'content_block_delta', text: 'Hello' })
    expect(deltas[1]).toEqual({ type: 'content_block_delta', text: ' from Sipher.' })
  })

  it('yields a message_complete event at the end', async () => {
    const events = await collectEvents(
      chatStream([{ role: 'user', content: 'hello' }])
    )

    const complete = events.filter(e => e.type === 'message_complete')
    expect(complete).toHaveLength(1)
    expect(complete[0]).toEqual({
      type: 'message_complete',
      content: 'Hello from Sipher.',
    })
  })

  it('handles tool_use loop — yields tool_use and tool_result events', async () => {
    // First call: tool_use response
    const toolUseFinalMsg = {
      id: 'msg_tool',
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me check.' },
        { type: 'tool_use', id: 'tu_1', name: 'balance', input: {} },
      ],
      stop_reason: 'tool_use',
      model: 'anthropic/claude-sonnet-4-6',
      usage: { input_tokens: 10, output_tokens: 15 },
    }

    // Second call: final text
    const finalTextMsg = {
      id: 'msg_final',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Your balance is 5 SOL.' }],
      stop_reason: 'end_turn',
      model: 'anthropic/claude-sonnet-4-6',
      usage: { input_tokens: 20, output_tokens: 10 },
    }

    let callCount = 0
    mockMessagesStream.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return {
          [Symbol.asyncIterator]: async function* () {
            yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Let me check.' } }
          },
          finalMessage: vi.fn().mockResolvedValue(toolUseFinalMsg),
        }
      }
      return {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Your balance is 5 SOL.' } }
        },
        finalMessage: vi.fn().mockResolvedValue(finalTextMsg),
      }
    })

    const events = await collectEvents(
      chatStream([{ role: 'user', content: 'check balance' }])
    )

    const types = events.map(e => e.type)
    expect(types).toContain('tool_use')
    expect(types).toContain('tool_result')
    expect(types).toContain('message_complete')

    const toolUse = events.find(e => e.type === 'tool_use')
    expect(toolUse).toEqual({ type: 'tool_use', name: 'balance', id: 'tu_1' })

    const toolResult = events.find(e => e.type === 'tool_result')
    expect(toolResult).toEqual({ type: 'tool_result', name: 'balance', id: 'tu_1', success: true })

    const complete = events.find(e => e.type === 'message_complete')
    expect(complete).toEqual({ type: 'message_complete', content: 'Your balance is 5 SOL.' })
  })

  it('skips non-text deltas (e.g. tool input json)', async () => {
    mockStreamEvents.length = 0
    mockStreamEvents.push(
      { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{"x":1}' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'ok' } },
    )
    mockFinalMessage = {
      ...mockFinalMessage,
      content: [{ type: 'text', text: 'ok' }],
    }
    mockStream.finalMessage.mockResolvedValue(mockFinalMessage)

    const events = await collectEvents(
      chatStream([{ role: 'user', content: 'test' }])
    )

    const deltas = events.filter(e => e.type === 'content_block_delta')
    expect(deltas).toHaveLength(1)
    expect(deltas[0]).toEqual({ type: 'content_block_delta', text: 'ok' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SSE endpoint integration tests (supertest-style via app)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/chat/stream', () => {
  let server: Server

  beforeEach(() => {
    vi.clearAllMocks()

    mockStreamEvents.length = 0
    mockStreamEvents.push(
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Streamed.' } },
    )
    mockFinalMessage = {
      id: 'msg_sse',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Streamed.' }],
      stop_reason: 'end_turn',
      model: 'anthropic/claude-sonnet-4-6',
      usage: { input_tokens: 5, output_tokens: 3 },
    }
    mockStream.finalMessage.mockResolvedValue(mockFinalMessage)

    // Restore default stream mock (tool_use test overrides this)
    mockMessagesStream.mockReturnValue(mockStream)
  })

  afterEach(() => {
    if (server) server.close()
  })

  function startServer(): Promise<string> {
    return new Promise((resolve) => {
      // Use port 0 for random available port
      server = app.listen(0, () => {
        const addr = server.address()
        const port = typeof addr === 'object' && addr ? addr.port : 0
        resolve(`http://localhost:${port}`)
      })
    })
  }

  it('returns correct SSE headers', async () => {
    const baseUrl = await startServer()
    const res = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })

    expect(res.headers.get('content-type')).toBe('text/event-stream')
    expect(res.headers.get('cache-control')).toBe('no-cache')

    // Consume the body to prevent hanging
    await res.text()
  })

  it('returns 400 for missing messages', async () => {
    const baseUrl = await startServer()
    const res = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/messages is required/)
  })

  it('returns 400 for empty messages array', async () => {
    const baseUrl = await startServer()
    const res = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    })

    expect(res.status).toBe(400)
  })

  it('streams SSE events and ends with [DONE]', async () => {
    const baseUrl = await startServer()
    const res = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })

    const text = await res.text()
    const lines = text.split('\n').filter(l => l.startsWith('data: '))

    // Should have at least: content_block_delta, message_complete, [DONE]
    expect(lines.length).toBeGreaterThanOrEqual(3)

    // First data line should be a content delta
    const firstEvent = JSON.parse(lines[0].slice(6))
    expect(firstEvent.type).toBe('content_block_delta')
    expect(firstEvent.text).toBe('Streamed.')

    // Second should be message_complete
    const secondEvent = JSON.parse(lines[1].slice(6))
    expect(secondEvent.type).toBe('message_complete')

    // Last line should be [DONE]
    expect(lines[lines.length - 1]).toBe('data: [DONE]')
  })
})
