import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// SENTINEL pause SSE event — covers the path:
//   runPreflightGate → executeTool(onPause) → chatStream(SSE injection)
//
// Three layers of test:
//   1. runPreflightGate populates `advisory` for warn-recommendation reports
//      (preflight gate behavior is unchanged from the advisory-light era —
//      the gate still emits PreflightOutcome.advisory; only the downstream
//      executor wiring changed)
//   2. executeTool fires the onPause callback only in advisory mode and
//      returns a synthetic cancelled result when onPause rejects
//   3. chatStream injects sentinel_pause events with a flagId before
//      tool_result, via the stream-bridge external queue
// ─────────────────────────────────────────────────────────────────────────────

describe('runPreflightGate advisory surface', () => {
  beforeEach(() => {
    process.env.DB_PATH = ':memory:'
    vi.resetModules()
  })
  afterEach(() => {
    delete process.env.DB_PATH
    delete process.env.SENTINEL_MODE
  })

  async function freshDb() {
    const { closeDb, getDb } = await import('../../src/db.js')
    closeDb()
    getDb()
  }

  it('returns advisory metadata when LLM recommendation === warn', async () => {
    await freshDb()
    const { setSentinelAssessor, runPreflightGate } = await import('../../src/sentinel/preflight-gate.js')
    setSentinelAssessor(vi.fn().mockResolvedValue({
      risk: 'medium',
      score: 50,
      reasons: ['recipient is new', 'amount is large for this wallet'],
      recommendation: 'warn',
      decisionId: 'dec1',
      durationMs: 200,
    }) as never)

    const result = await runPreflightGate('send', { wallet: 'w1', recipient: 'stranger', amount: 5 })

    expect(result.allowed).toBe(true)
    if (result.allowed) {
      expect(result.advisory).toBeDefined()
      expect(result.advisory?.severity).toBe('medium')
      expect(result.advisory?.description).toBe('recipient is new; amount is large for this wallet')
      expect(result.advisory?.recommendation).toBe('warn')
    }
  })

  it('does NOT populate advisory when recommendation === allow', async () => {
    await freshDb()
    const { setSentinelAssessor, runPreflightGate } = await import('../../src/sentinel/preflight-gate.js')
    setSentinelAssessor(vi.fn().mockResolvedValue({
      risk: 'low',
      score: 5,
      reasons: ['ok'],
      recommendation: 'allow',
      decisionId: 'dec2',
      durationMs: 100,
    }) as never)

    const result = await runPreflightGate('send', { wallet: 'w1', recipient: 'stranger', amount: 5 })

    expect(result.allowed).toBe(true)
    if (result.allowed) {
      expect(result.advisory).toBeUndefined()
    }
  })

  it('blocks (no advisory) when recommendation === block', async () => {
    await freshDb()
    const { setSentinelAssessor, runPreflightGate } = await import('../../src/sentinel/preflight-gate.js')
    setSentinelAssessor(vi.fn().mockResolvedValue({
      risk: 'high',
      score: 90,
      reasons: ['suspicious'],
      recommendation: 'block',
      blockers: ['address was reported'],
      decisionId: 'dec3',
      durationMs: 100,
    }) as never)

    const result = await runPreflightGate('send', { wallet: 'w1', recipient: 'stranger', amount: 5 })
    expect(result.allowed).toBe(false)
  })
})

describe('executeTool onPause callback', () => {
  beforeEach(() => {
    process.env.DB_PATH = ':memory:'
    vi.resetModules()
  })
  afterEach(() => {
    delete process.env.DB_PATH
    delete process.env.SENTINEL_MODE
  })

  async function freshDb() {
    const { closeDb, getDb } = await import('../../src/db.js')
    closeDb()
    getDb()
  }

  it('awaits onPause and continues to executor when promise resolves', async () => {
    await freshDb()
    process.env.SENTINEL_MODE = 'advisory'
    const { setSentinelAssessor } = await import('../../src/sentinel/preflight-gate.js')
    setSentinelAssessor(vi.fn().mockResolvedValue({
      risk: 'medium',
      score: 50,
      reasons: ['unknown recipient'],
      recommendation: 'warn',
      decisionId: 'dec1',
      durationMs: 100,
    }) as never)

    const executeSendMock = vi.fn().mockResolvedValue({ action: 'send', success: true })
    vi.doMock('../../src/tools/send.js', () => ({
      executeSend: executeSendMock,
      sendTool: { name: 'send', description: '', input_schema: { type: 'object', properties: {} } },
    }))
    const { executeTool } = await import('../../src/agent.js')
    const onPause = vi.fn().mockResolvedValue(undefined)

    const result = await executeTool(
      'send',
      { wallet: 'w1', recipient: 'stranger', amount: 5 },
      onPause,
    )

    expect(onPause).toHaveBeenCalledTimes(1)
    expect(onPause).toHaveBeenCalledWith({
      severity: 'medium',
      description: 'unknown recipient',
      recommendation: 'warn',
    })
    expect(executeSendMock).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ success: true })
    vi.doUnmock('../../src/tools/send.js')
  })

  it('returns synthetic cancelled result (does NOT throw) when onPause rejects', async () => {
    await freshDb()
    process.env.SENTINEL_MODE = 'advisory'
    const { setSentinelAssessor } = await import('../../src/sentinel/preflight-gate.js')
    setSentinelAssessor(vi.fn().mockResolvedValue({
      risk: 'medium',
      score: 50,
      reasons: ['unknown recipient'],
      recommendation: 'warn',
      decisionId: 'dec1',
      durationMs: 100,
    }) as never)

    const executeSendMock = vi.fn().mockResolvedValue({ action: 'send', success: true })
    vi.doMock('../../src/tools/send.js', () => ({
      executeSend: executeSendMock,
      sendTool: { name: 'send', description: '', input_schema: { type: 'object', properties: {} } },
    }))
    const { executeTool } = await import('../../src/agent.js')
    const onPause = vi.fn().mockRejectedValue(new Error('cancelled_by_user'))

    const result = await executeTool(
      'send',
      { wallet: 'w1', recipient: 'stranger', amount: 5 },
      onPause,
    )

    expect(onPause).toHaveBeenCalledTimes(1)
    // Synthetic cancelled tool result — Pi treats this as the tool's output,
    // and the LLM communicates cancellation to the user.
    expect(result).toEqual({
      status: 'cancelled_by_user',
      reason: 'cancelled_by_user',
    })
    // The underlying executor must NOT have run when the user cancelled.
    expect(executeSendMock).not.toHaveBeenCalled()
    vi.doUnmock('../../src/tools/send.js')
  })

  it('returns synthetic cancelled result when onPause rejects with non-Error reason', async () => {
    await freshDb()
    process.env.SENTINEL_MODE = 'advisory'
    const { setSentinelAssessor } = await import('../../src/sentinel/preflight-gate.js')
    setSentinelAssessor(vi.fn().mockResolvedValue({
      risk: 'medium',
      score: 50,
      reasons: ['unknown recipient'],
      recommendation: 'warn',
      decisionId: 'dec1',
      durationMs: 100,
    }) as never)

    const executeSendMock = vi.fn().mockResolvedValue({ action: 'send', success: true })
    vi.doMock('../../src/tools/send.js', () => ({
      executeSend: executeSendMock,
      sendTool: { name: 'send', description: '', input_schema: { type: 'object', properties: {} } },
    }))
    const { executeTool } = await import('../../src/agent.js')
    // Reject with a non-Error to cover the fallback branch in agent.ts
    const onPause = vi.fn().mockRejectedValue('cancelled_str')

    const result = await executeTool(
      'send',
      { wallet: 'w1', recipient: 'stranger', amount: 5 },
      onPause,
    )

    expect(result).toEqual({
      status: 'cancelled_by_user',
      reason: 'cancelled',
    })
    expect(executeSendMock).not.toHaveBeenCalled()
    vi.doUnmock('../../src/tools/send.js')
  })

  it('does NOT invoke onPause when mode !== advisory (yolo allows silently)', async () => {
    await freshDb()
    // SENTINEL_MODE unset → defaults to 'yolo'
    const { setSentinelAssessor } = await import('../../src/sentinel/preflight-gate.js')
    setSentinelAssessor(vi.fn().mockResolvedValue({
      risk: 'medium',
      score: 50,
      reasons: ['unknown recipient'],
      recommendation: 'warn',
      decisionId: 'dec1',
      durationMs: 100,
    }) as never)

    vi.doMock('../../src/tools/send.js', () => ({
      executeSend: vi.fn().mockResolvedValue({ action: 'send', success: true }),
      sendTool: { name: 'send', description: '', input_schema: { type: 'object', properties: {} } },
    }))
    const { executeTool } = await import('../../src/agent.js')
    const onPause = vi.fn().mockResolvedValue(undefined)

    await executeTool(
      'send',
      { wallet: 'w1', recipient: 'stranger', amount: 5 },
      onPause,
    )

    expect(onPause).not.toHaveBeenCalled()
    vi.doUnmock('../../src/tools/send.js')
  })

  it('existing 2-arg callers still work (onPause is optional)', async () => {
    await freshDb()
    process.env.SENTINEL_MODE = 'advisory'
    const { setSentinelAssessor } = await import('../../src/sentinel/preflight-gate.js')
    setSentinelAssessor(vi.fn().mockResolvedValue({
      risk: 'medium',
      score: 50,
      reasons: ['unknown recipient'],
      recommendation: 'warn',
      decisionId: 'dec1',
      durationMs: 100,
    }) as never)

    vi.doMock('../../src/tools/send.js', () => ({
      executeSend: vi.fn().mockResolvedValue({ action: 'send', success: true }),
      sendTool: { name: 'send', description: '', input_schema: { type: 'object', properties: {} } },
    }))
    const { executeTool } = await import('../../src/agent.js')

    // No onPause passed — must not throw, and the executor runs normally.
    const result = await executeTool('send', { wallet: 'w1', recipient: 'stranger', amount: 5 })
    expect(result).toMatchObject({ success: true })
    vi.doUnmock('../../src/tools/send.js')
  })
})

describe('chatStream sentinel_pause SSE injection', () => {
  beforeEach(() => {
    process.env.DB_PATH = ':memory:'
    vi.resetModules()
  })
  afterEach(() => {
    delete process.env.DB_PATH
    delete process.env.SENTINEL_MODE
  })

  async function freshDb() {
    const { closeDb, getDb } = await import('../../src/db.js')
    closeDb()
    getDb()
  }

  it('injects sentinel_pause event before tool_result with flagId in advisory mode', async () => {
    await freshDb()
    process.env.SENTINEL_MODE = 'advisory'

    const { setSentinelAssessor } = await import('../../src/sentinel/preflight-gate.js')
    setSentinelAssessor(vi.fn().mockResolvedValue({
      risk: 'high',
      score: 70,
      reasons: ['recipient flagged in recent activity'],
      recommendation: 'warn',
      decisionId: 'dec1',
      durationMs: 100,
    }) as never)

    // Force pending flags to time out fast so the executor unblocks within
    // the test (synthetic cancelled result → tool_execution_end fires).
    // 50ms is generous — tests don't need to wait on real users.
    const { _setTimeoutMsForTests } = await import('../../src/sentinel/pending.js')
    _setTimeoutMsForTests(50)

    // Stub Pi agent so we control event emission deterministically.
    // The fake agent invokes the toolExecutor (which is the chatStream-wrapped
    // executor) between tool_execution_start and tool_execution_end. The
    // wrapped executor pushes the pause event onto streamPiAgent's external
    // queue and awaits the pending promise. With the fast timeout above the
    // promise rejects after ~50ms, the executor returns a synthetic cancelled
    // result, and Pi proceeds to tool_execution_end.
    type Subscriber = (event: unknown) => void | Promise<void>
    vi.doMock('../../src/pi/sipher-agent.js', async (orig) => {
      const actual = (await orig()) as Record<string, unknown>
      return {
        ...actual,
        createPiAgent: vi.fn((opts: {
          toolExecutor: (n: string, i: Record<string, unknown>) => Promise<unknown>
        }) => {
          const subscribers: Subscriber[] = []
          const messages: unknown[] = []
          return {
            subscribe: (cb: Subscriber) => {
              subscribers.push(cb)
              return () => {
                const idx = subscribers.indexOf(cb)
                if (idx >= 0) subscribers.splice(idx, 1)
              }
            },
            prompt: async () => {
              for (const cb of [...subscribers]) {
                await cb({ type: 'tool_execution_start', toolCallId: 'c1', toolName: 'send' })
              }
              try {
                await opts.toolExecutor('send', { wallet: 'w1', recipient: 'stranger', amount: 5 })
              } catch {
                // executor may throw if tools/send.js isn't mocked — keep going so we still emit end
              }
              for (const cb of [...subscribers]) {
                await cb({
                  type: 'tool_execution_end',
                  toolCallId: 'c1',
                  toolName: 'send',
                  isError: false,
                })
              }
              messages.push({ role: 'assistant', content: [{ type: 'text', text: 'done' }] })
              for (const cb of [...subscribers]) {
                await cb({ type: 'agent_end', messages })
              }
            },
            abort: () => {},
            state: { messages },
          }
        }),
      }
    })

    vi.doMock('../../src/tools/send.js', () => ({
      executeSend: vi.fn().mockResolvedValue({ action: 'send', success: true }),
      sendTool: { name: 'send', description: '', input_schema: { type: 'object', properties: {} } },
    }))

    const { chatStream } = await import('../../src/agent.js')
    const events: Array<{ type: string }> = []
    for await (const evt of chatStream('send 5 SOL')) {
      events.push(evt as { type: string })
    }

    const types = events.map((e) => e.type)
    expect(types).toContain('sentinel_pause')

    const pauseIdx = types.indexOf('sentinel_pause')
    const toolResultIdx = types.indexOf('tool_result')
    const toolUseIdx = types.indexOf('tool_use')

    // Order must be: tool_use → sentinel_pause → tool_result
    expect(toolUseIdx).toBeGreaterThanOrEqual(0)
    expect(pauseIdx).toBeGreaterThan(toolUseIdx)
    expect(toolResultIdx).toBeGreaterThan(pauseIdx)

    const pause = events[pauseIdx] as {
      type: string
      flagId: string
      action: string
      amount: string
      severity: string
      description: string
    }
    expect(pause.flagId).toBeTypeOf('string')
    expect(pause.flagId.length).toBeGreaterThan(0)
    expect(pause.severity).toBe('high')
    expect(pause.description).toBe('recipient flagged in recent activity')
    expect(pause.amount).toBe('5 SOL')
    expect(pause.action).toContain('Send to')

    // Reset timeout for any other tests that import the module
    _setTimeoutMsForTests(120_000)
    vi.doUnmock('../../src/tools/send.js')
    vi.doUnmock('../../src/pi/sipher-agent.js')
  })
})
