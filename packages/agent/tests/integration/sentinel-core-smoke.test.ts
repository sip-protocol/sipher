import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Agent, AgentEvent, AgentMessage } from '@mariozechner/pi-agent-core'

let stub: { toolName: string; toolArgs: Record<string, unknown>; finalText: string } = {
  toolName: 'checkReputation',
  toolArgs: { address: 'bad' },
  finalText: '{"risk":"high","score":90,"reasons":["blacklisted"],"recommendation":"block","blockers":["known bad actor"]}',
}

vi.mock('../../src/pi/sipher-agent.js', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  return {
    ...actual,
    createPiAgent: vi.fn((opts: { systemPrompt: string; tools: unknown[]; toolExecutor: (n: string, i: Record<string, unknown>) => Promise<unknown> }) => {
      const subs: Array<(e: AgentEvent, s: AbortSignal) => unknown> = []
      const messages: AgentMessage[] = []
      const fake: Agent = {
        subscribe: (cb) => { subs.push(cb); return () => subs.splice(subs.indexOf(cb), 1) },
        prompt: async () => {
          const signal = new AbortController().signal
          for (const cb of [...subs]) await cb({ type: 'tool_execution_start', toolCallId: 't1', toolName: stub.toolName, args: stub.toolArgs }, signal)
          try { await opts.toolExecutor(stub.toolName, stub.toolArgs) } catch {}
          for (const cb of [...subs]) await cb({ type: 'tool_execution_end', toolCallId: 't1', toolName: stub.toolName, isError: false, result: { content: [{ type: 'text', text: '{}' }], details: {} } } as unknown as AgentEvent, signal)
          messages.push({ role: 'assistant', content: [{ type: 'text', text: stub.finalText }], stopReason: 'end_turn', usage: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, totalTokens: 150, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.001 } }, timestamp: Date.now() } as unknown as AgentMessage)
          for (const cb of [...subs]) await cb({ type: 'agent_end', messages } as AgentEvent, signal)
        },
        abort: () => {}, get state() { return { messages, tools: [], systemPrompt: 's', model: null as never, isStreaming: false, pendingToolCalls: new Set() } },
        steer: () => {}, followUp: () => {},
        clearSteeringQueue: () => {}, clearFollowUpQueue: () => {}, clearAllQueues: () => {},
        hasQueuedMessages: () => false, waitForIdle: async () => {}, reset: () => {},
        get signal() { return undefined },
        get steeringMode() { return 'one-at-a-time' as const }, set steeringMode(_) {},
        get followUpMode() { return 'one-at-a-time' as const }, set followUpMode(_) {},
      } as unknown as Agent
      return fake
    }),
  }
})

describe('SENTINEL E2E smoke', () => {
  beforeEach(() => { process.env.DB_PATH = ':memory:' })
  afterEach(() => { delete process.env.DB_PATH })

  async function freshDb() {
    const { closeDb, getDb } = await import('../../src/db.js')
    closeDb()
    getDb()
  }

  it('reactive: threat event → blacklist added via SentinelCore', async () => {
    await freshDb()
    stub = {
      toolName: 'addToBlacklist',
      toolArgs: { address: 'bad', reason: 'auto', severity: 'block' },
      finalText: '{"risk":"high","score":95,"reasons":["threat"],"recommendation":"block","blockers":["auto-blacklisted"]}',
    }
    const { guardianBus } = await import('../../src/coordination/event-bus.js')
    const { SentinelCore } = await import('../../src/sentinel/core.js')
    const { SentinelAdapter } = await import('../../src/sentinel/adapter.js')
    const core = new SentinelCore()
    const adapter = new SentinelAdapter(guardianBus, core)
    adapter.start()

    guardianBus.emit({
      source: 'sentinel', type: 'sentinel:threat', level: 'critical',
      data: { address: 'bad' }, wallet: 'w1', timestamp: new Date().toISOString(),
    })
    await new Promise((r) => setTimeout(r, 50))

    const { getActiveBlacklistEntry, listDecisions } = await import('../../src/db.js')
    expect(getActiveBlacklistEntry('bad')).not.toBeNull()
    expect(listDecisions({ source: 'reactive' }).length).toBe(1)
    adapter.stop()
  })

  it('preflight: send with unknown recipient → gate calls SentinelCore; block propagates', async () => {
    await freshDb()
    stub = {
      toolName: 'checkReputation', toolArgs: { address: 'stranger' },
      finalText: '{"risk":"high","score":90,"reasons":["unknown"],"recommendation":"block","blockers":["insufficient trust"]}',
    }
    const { SentinelCore } = await import('../../src/sentinel/core.js')
    const core = new SentinelCore()
    const { setSentinelAssessor } = await import('../../src/sentinel/preflight-gate.js')
    setSentinelAssessor((ctx) => core.assessRisk(ctx))

    // Mock send so we don't hit RPC
    vi.doMock('../../src/tools/send.js', () => ({
      executeSend: vi.fn().mockResolvedValue({ action: 'send', success: true }),
      sendTool: { name: 'send', description: '', input_schema: { type: 'object', properties: {} } },
    }))
    const { executeTool } = await import('../../src/agent.js')
    await expect(executeTool('send', { wallet: 'w1', recipient: 'stranger', amount: 5 }))
      .rejects.toThrow(/SENTINEL blocked/i)
    vi.doUnmock('../../src/tools/send.js')
  })

  it('startup: restorePendingActions cancels stale rows', async () => {
    await freshDb()
    const cb = await import('../../src/sentinel/circuit-breaker.js')
    const { insertPendingAction, getDb, getPendingAction } = await import('../../src/db.js')
    cb.registerActionExecutor('refund', async () => ({ success: true }))
    const staleId = insertPendingAction({ actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 0 })
    getDb().prepare(`UPDATE sentinel_pending_actions SET execute_at = ? WHERE id = ?`)
      .run(new Date(Date.now() - 30 * 60_000).toISOString(), staleId)
    await cb.restorePendingActions()
    expect(getPendingAction(staleId)!.cancelledBy).toBe('server-restart-stale')
    cb.clearAllTimers()
  })
})
