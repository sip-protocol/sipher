import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Agent, AgentEvent, AgentMessage } from '@mariozechner/pi-agent-core'

// ── Stub createPiAgent (mirrors pi-smoke.test.ts pattern) ──────────────────

let capturedExecutor: ((name: string, input: Record<string, unknown>) => Promise<unknown>) | null = null
let stubBehavior: {
  toolName: string
  toolArgs: Record<string, unknown>
  finalText: string
} = { toolName: 'checkReputation', toolArgs: { address: 'a1' }, finalText: '{"risk":"low","score":10,"reasons":["clean"],"recommendation":"allow"}' }

vi.mock('../../src/pi/sipher-agent.js', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  return {
    ...actual,
    createPiAgent: vi.fn((opts: {
      systemPrompt: string
      tools: unknown[]
      toolExecutor: (name: string, input: Record<string, unknown>) => Promise<unknown>
    }) => {
      capturedExecutor = opts.toolExecutor
      const subs: Array<(e: AgentEvent, s: AbortSignal) => unknown> = []
      const messages: AgentMessage[] = []
      const fake: Agent = {
        subscribe: vi.fn((cb) => {
          subs.push(cb)
          return () => { subs.splice(subs.indexOf(cb), 1) }
        }),
        prompt: vi.fn(async () => {
          const signal = new AbortController().signal
          for (const cb of [...subs]) {
            await cb({ type: 'tool_execution_start', toolCallId: 't1', toolName: stubBehavior.toolName, args: stubBehavior.toolArgs }, signal)
          }
          try { await opts.toolExecutor(stubBehavior.toolName, stubBehavior.toolArgs) } catch {}
          for (const cb of [...subs]) {
            await cb({ type: 'tool_execution_end', toolCallId: 't1', toolName: stubBehavior.toolName, isError: false, result: { content: [{ type: 'text', text: '{}' }], details: {} } } as unknown as AgentEvent, signal)
          }
          messages.push({ role: 'assistant', content: [{ type: 'text', text: stubBehavior.finalText }], stopReason: 'end_turn', usage: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, totalTokens: 150, cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 } }, timestamp: Date.now() } as unknown as AgentMessage)
          for (const cb of [...subs]) { await cb({ type: 'agent_end', messages } as AgentEvent, signal) }
        }),
        abort: vi.fn(),
        get state() { return { messages, tools: [], systemPrompt: 'stub', model: null as never, isStreaming: false, pendingToolCalls: new Set<string>() } },
        steer: vi.fn(), followUp: vi.fn(),
        clearSteeringQueue: vi.fn(), clearFollowUpQueue: vi.fn(), clearAllQueues: vi.fn(),
        hasQueuedMessages: vi.fn(() => false), waitForIdle: vi.fn(async () => {}), reset: vi.fn(),
        get signal() { return undefined },
        get steeringMode() { return 'one-at-a-time' as const }, set steeringMode(_) {},
        get followUpMode() { return 'one-at-a-time' as const }, set followUpMode(_) {},
      } as unknown as Agent
      return fake
    }),
  }
})

describe('SentinelCore', () => {
  beforeEach(() => { process.env.DB_PATH = ':memory:' })
  afterEach(() => { delete process.env.DB_PATH; capturedExecutor = null })

  async function freshDb() {
    const { closeDb, getDb } = await import('../../src/db.js')
    closeDb()
    getDb()
  }

  it('assessRisk writes a sentinel_decisions row with final verdict', async () => {
    await freshDb()
    stubBehavior = { toolName: 'checkReputation', toolArgs: { address: 'a1' }, finalText: '{"risk":"low","score":10,"reasons":["clean"],"recommendation":"allow"}' }
    const { SentinelCore } = await import('../../src/sentinel/core.js')
    const core = new SentinelCore()
    const report = await core.assessRisk({ action: 'send', wallet: 'w1', recipient: 'r1', amount: 1 })
    expect(report.risk).toBe('low')
    expect(report.recommendation).toBe('allow')
    expect(report.decisionId).toBeDefined()

    const { getDecision } = await import('../../src/db.js')
    const row = getDecision(report.decisionId)!
    expect(row.verdict).toBe('allow')
    expect(row.toolCalls.length).toBeGreaterThan(0)
    expect(row.costUsd).toBeGreaterThan(0)
  })

  it('analyze(event) writes a reactive decision', async () => {
    await freshDb()
    stubBehavior = { toolName: 'checkReputation', toolArgs: { address: 'attacker' }, finalText: '{"risk":"high","score":90,"reasons":["known scam"],"recommendation":"block","blockers":["blacklisted"]}' }
    const { SentinelCore } = await import('../../src/sentinel/core.js')
    const core = new SentinelCore()
    const report = await core.analyze({
      source: 'sentinel',
      type: 'sentinel:threat',
      level: 'critical',
      data: { address: 'attacker', wallet: 'w1' },
      wallet: 'w1',
      timestamp: new Date().toISOString(),
    })
    expect(report.recommendation).toBe('block')
    const { listDecisions } = await import('../../src/db.js')
    const decisions = listDecisions({ source: 'reactive' })
    expect(decisions.length).toBe(1)
  })

  it('malformed LLM output → block verdict + sentinel:schema-violation event', async () => {
    await freshDb()
    stubBehavior = { toolName: 'checkReputation', toolArgs: { address: 'a1' }, finalText: 'this is not json at all' }
    const { guardianBus } = await import('../../src/coordination/event-bus.js')
    let captured: unknown = null
    const handler = (e: unknown) => { captured = e }
    guardianBus.on('sentinel:schema-violation', handler)

    const { SentinelCore } = await import('../../src/sentinel/core.js')
    const core = new SentinelCore()
    const report = await core.assessRisk({ action: 'send', wallet: 'w1', recipient: 'r1', amount: 1 })
    expect(report.recommendation).toBe('block')
    expect(report.risk).toBe('high')
    expect(captured).not.toBeNull()
    guardianBus.off('sentinel:schema-violation', handler)
  })

  it('mode=off throws on invocation', async () => {
    await freshDb()
    process.env.SENTINEL_MODE = 'off'
    const { SentinelCore } = await import('../../src/sentinel/core.js')
    const core = new SentinelCore()
    await expect(core.assessRisk({ action: 'send', wallet: 'w1', recipient: 'r1', amount: 1 })).rejects.toThrow(/off/i)
    delete process.env.SENTINEL_MODE
  })
})
