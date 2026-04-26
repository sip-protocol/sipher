import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// SENTINEL advisory SSE event — covers the path:
//   runPreflightGate → executeTool(onAdvisory) → chatStream(SSE injection)
//
// Two layers of test:
//   1. runPreflightGate populates `advisory` for warn-recommendation reports
//   2. executeTool fires the onAdvisory callback only in advisory mode
//
// We don't drive a full chatStream here — the queue/injection logic is
// exercised by integration tests in pi-smoke. The new behavior we need to
// prove is the gate change + callback wiring.
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

describe('executeTool onAdvisory callback', () => {
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

  it('fires onAdvisory when SENTINEL warns AND mode === advisory', async () => {
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
    const onAdvisory = vi.fn()

    const result = await executeTool(
      'send',
      { wallet: 'w1', recipient: 'stranger', amount: 5 },
      onAdvisory,
    )

    expect(result).toMatchObject({ success: true })
    expect(onAdvisory).toHaveBeenCalledTimes(1)
    expect(onAdvisory).toHaveBeenCalledWith({
      severity: 'medium',
      description: 'unknown recipient',
      recommendation: 'warn',
    })
    vi.doUnmock('../../src/tools/send.js')
  })

  it('does NOT fire onAdvisory when mode !== advisory (yolo allows silently)', async () => {
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
    const onAdvisory = vi.fn()

    await executeTool(
      'send',
      { wallet: 'w1', recipient: 'stranger', amount: 5 },
      onAdvisory,
    )

    expect(onAdvisory).not.toHaveBeenCalled()
    vi.doUnmock('../../src/tools/send.js')
  })

  it('existing 2-arg callers still work (onAdvisory is optional)', async () => {
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

    // No onAdvisory passed — must not throw
    const result = await executeTool('send', { wallet: 'w1', recipient: 'stranger', amount: 5 })
    expect(result).toMatchObject({ success: true })
    vi.doUnmock('../../src/tools/send.js')
  })
})

describe('chatStream sentinel_advisory SSE injection', () => {
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

  it('injects sentinel_advisory event before tool_result in advisory mode', async () => {
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

    // Stub Pi agent so we control event emission deterministically.
    // The fake agent invokes the toolExecutor (which is the chatStream-wrapped
    // executor) between tool_execution_start and tool_execution_end so the
    // advisory queue is populated before the tool_result event is yielded.
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
                // executor throws if tools/send.js isn't mocked — keep going so we still emit end
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
    expect(types).toContain('sentinel_advisory')

    const advisoryIdx = types.indexOf('sentinel_advisory')
    const toolResultIdx = types.indexOf('tool_result')
    const toolUseIdx = types.indexOf('tool_use')

    // Order must be: tool_use → sentinel_advisory → tool_result
    expect(toolUseIdx).toBeLessThan(advisoryIdx)
    expect(advisoryIdx).toBeLessThan(toolResultIdx)

    const advisory = events[advisoryIdx] as {
      type: string
      action: string
      amount: string
      severity: string
      description: string
    }
    expect(advisory.severity).toBe('high')
    expect(advisory.description).toBe('recipient flagged in recent activity')
    expect(advisory.amount).toBe('5 SOL')
    expect(advisory.action).toContain('Send to')

    vi.doUnmock('../../src/tools/send.js')
    vi.doUnmock('../../src/pi/sipher-agent.js')
  })
})
