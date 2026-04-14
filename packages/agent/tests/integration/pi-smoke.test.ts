import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Agent, AgentEvent, AgentMessage } from '@mariozechner/pi-agent-core'

// ─────────────────────────────────────────────────────────────────────────────
// Stub createPiAgent — inject deterministic event sequence without LLM
// ─────────────────────────────────────────────────────────────────────────────
//
// Strategy: mock sipher-agent.js so createPiAgent() returns a fake Pi Agent
// that fires a canned tool_execution_start → tool_execution_end → agent_end
// sequence when prompt() is called.
//
// The real streamPiAgent() in stream-bridge.ts runs unmodified — it subscribes,
// enqueues Pi events, and yields SSEEvents. The real chat() in agent.ts runs
// unmodified — it subscribes, collects toolsUsed, and extracts final text.
//
// Only the LLM call is bypassed. This covers the full:
//   chat()/chatStream() → createPiAgent → streamPiAgent → SSEEvent stream
// pipeline that previous tests only exercised structurally.

type Subscriber = (event: AgentEvent, signal: AbortSignal) => Promise<void> | void

function buildFakeAgent(opts: {
  /** Tool name to "execute" — call the actual tool executor, then emit end event */
  toolName: string
  toolCallId: string
  toolArgs: Record<string, unknown>
  /** Final assistant text to emit at agent_end */
  finalText: string
  /** External toolExecutor pulled from CreatePiAgentOptions */
  toolExecutor: (name: string, input: Record<string, unknown>) => Promise<unknown>
}): Agent {
  const subscribers: Subscriber[] = []
  // Accumulates messages so chat() can read state.messages after prompt() settles
  const messages: AgentMessage[] = []

  const fakeAgent: Agent = {
    subscribe: vi.fn((cb: Subscriber) => {
      subscribers.push(cb)
      return () => {
        const idx = subscribers.indexOf(cb)
        if (idx >= 0) subscribers.splice(idx, 1)
      }
    }),
    prompt: vi.fn(async (_msg: string | AgentMessage | AgentMessage[]) => {
      const signal = new AbortController().signal

      // Emit tool_execution_start
      const startEvt: AgentEvent = {
        type: 'tool_execution_start',
        toolCallId: opts.toolCallId,
        toolName: opts.toolName,
        args: opts.toolArgs,
      }
      for (const cb of [...subscribers]) await cb(startEvt, signal)

      // Invoke the tool executor — ignore errors so the event sequence always
      // completes regardless of whether the executor is registered or not.
      // The primary assertion on executor invocation lives in the dedicated test.
      try {
        await opts.toolExecutor(opts.toolName, opts.toolArgs)
      } catch {
        // executor not registered or threw — swallow here, event sequence continues
      }

      // Emit tool_execution_end (success)
      const endEvt = {
        type: 'tool_execution_end' as const,
        toolCallId: opts.toolCallId,
        toolName: opts.toolName,
        isError: false,
        result: { content: [{ type: 'text', text: '{"ok":true}' }], details: { ok: true } },
      } as unknown as AgentEvent
      for (const cb of [...subscribers]) await cb(endEvt, signal)

      // Build the final assistant message and push it into state
      const assistantMsg: AgentMessage = {
        role: 'assistant',
        content: [{ type: 'text', text: opts.finalText }],
        stopReason: 'end_turn',
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        timestamp: Date.now(),
      } as unknown as AgentMessage
      messages.push(assistantMsg)

      // Emit agent_end
      const doneEvt: AgentEvent = {
        type: 'agent_end',
        messages,
      }
      for (const cb of [...subscribers]) await cb(doneEvt, signal)
    }),
    abort: vi.fn(),
    get state() {
      return {
        messages,
        tools: [],
        systemPrompt: 'stub',
        model: null as never,
        isStreaming: false,
        pendingToolCalls: new Set<string>(),
      }
    },
    steer: vi.fn(),
    followUp: vi.fn(),
    clearSteeringQueue: vi.fn(),
    clearFollowUpQueue: vi.fn(),
    clearAllQueues: vi.fn(),
    hasQueuedMessages: vi.fn(() => false),
    waitForIdle: vi.fn(async () => {}),
    reset: vi.fn(),
    get signal() { return undefined },
    get steeringMode() { return 'one-at-a-time' as const },
    set steeringMode(_m) {},
    get followUpMode() { return 'one-at-a-time' as const },
    set followUpMode(_m) {},
  } as unknown as Agent

  return fakeAgent
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level mock — must be declared before any imports that pull agent.ts
// ─────────────────────────────────────────────────────────────────────────────

let capturedToolExecutor: (name: string, input: Record<string, unknown>) => Promise<unknown> =
  async () => ({})

vi.mock('../../src/pi/sipher-agent.js', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  return {
    ...actual,
    createPiAgent: vi.fn((opts: {
      systemPrompt: string
      tools: unknown[]
      toolExecutor: (name: string, input: Record<string, unknown>) => Promise<unknown>
      model?: string
      history?: AgentMessage[]
      sessionId?: string
    }) => {
      // Capture the toolExecutor so tests can verify invocation
      capturedToolExecutor = opts.toolExecutor

      return buildFakeAgent({
        toolName: 'echo',
        toolCallId: 'stub-t1',
        toolArgs: { msg: 'hi' },
        finalText: 'Done',
        toolExecutor: opts.toolExecutor,
      })
    }),
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Test setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  delete process.env.DB_PATH
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('chatStream() end-to-end with stubbed Pi agent', () => {
  it('drives user message → tool_use → tool_result → message_complete via real streamPiAgent', async () => {
    const { chatStream } = await import('../../src/agent.js')

    let echoCalled = false
    const chunks: Array<{ type: string }> = []

    const echoTool = {
      name: 'echo',
      description: 'Echo a message',
      input_schema: {
        type: 'object' as const,
        properties: { msg: { type: 'string' } },
        required: ['msg'],
      },
    }

    for await (const chunk of chatStream('call echo with msg=hi', {
      tools: [echoTool],
      toolExecutor: async (name: string, input: Record<string, unknown>) => {
        expect(name).toBe('echo')
        expect(input).toEqual({ msg: 'hi' })
        echoCalled = true
        return { ok: true, echoed: (input as { msg: string }).msg }
      },
    })) {
      chunks.push(chunk)
    }

    expect(echoCalled).toBe(true)

    const types = chunks.map((c) => c.type)
    expect(types).toContain('tool_use')
    expect(types).toContain('tool_result')
    expect(types).toContain('message_complete')

    // Verify SSE ordering: tool_use must come before tool_result, which must come before message_complete
    const toolUseIdx = types.indexOf('tool_use')
    const toolResultIdx = types.indexOf('tool_result')
    const doneIdx = types.indexOf('message_complete')

    expect(toolUseIdx).toBeLessThan(toolResultIdx)
    expect(toolResultIdx).toBeLessThan(doneIdx)
  })

  it('tool_use event carries the correct tool name and id', async () => {
    const { chatStream } = await import('../../src/agent.js')
    const chunks: Array<Record<string, unknown>> = []

    for await (const chunk of chatStream('hi', {})) {
      chunks.push(chunk as Record<string, unknown>)
    }

    const toolUse = chunks.find((c) => c.type === 'tool_use')
    expect(toolUse).toBeDefined()
    expect(toolUse!.name).toBe('echo')
    expect(toolUse!.id).toBe('stub-t1')
  })

  it('tool_result event carries success=true on normal execution', async () => {
    const { chatStream } = await import('../../src/agent.js')
    const chunks: Array<Record<string, unknown>> = []

    for await (const chunk of chatStream('hi', {})) {
      chunks.push(chunk as Record<string, unknown>)
    }

    const toolResult = chunks.find((c) => c.type === 'tool_result')
    expect(toolResult).toBeDefined()
    expect(toolResult!.success).toBe(true)
    expect(toolResult!.name).toBe('echo')
  })

  it('message_complete event carries the final assistant text', async () => {
    const { chatStream } = await import('../../src/agent.js')
    const chunks: Array<Record<string, unknown>> = []

    for await (const chunk of chatStream('hi', {})) {
      chunks.push(chunk as Record<string, unknown>)
    }

    const done = chunks.find((c) => c.type === 'message_complete')
    expect(done).toBeDefined()
    expect(done!.content).toBe('Done')
  })
})

describe('chat() end-to-end with stubbed Pi agent', () => {
  it('returns final text and includes tool name in toolsUsed', async () => {
    const { chat } = await import('../../src/agent.js')

    const result = await chat('hi', {
      toolExecutor: async () => ({ ok: true }),
    })

    expect(result.text).toBe('Done')
    expect(result.toolsUsed).toContain('echo')
  })

  it('toolsUsed lists each tool exactly once per tool call', async () => {
    const { chat } = await import('../../src/agent.js')

    const result = await chat('run echo', {
      toolExecutor: async () => ({ ok: true }),
    })

    // Stub fires exactly one tool_execution_start for 'echo'
    expect(result.toolsUsed.filter((t) => t === 'echo')).toHaveLength(1)
  })

  it('calls the provided toolExecutor with the correct tool name and args', async () => {
    const { chat } = await import('../../src/agent.js')

    const execCalls: Array<{ name: string; input: Record<string, unknown> }> = []

    await chat('use echo', {
      toolExecutor: async (name, input) => {
        execCalls.push({ name, input })
        return { ok: true }
      },
    })

    expect(execCalls).toHaveLength(1)
    expect(execCalls[0].name).toBe('echo')
    expect(execCalls[0].input).toEqual({ msg: 'hi' })
  })
})
