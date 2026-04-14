import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDb, closeDb } from '../../src/db.js'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
  getDb()
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

describe('Pi SDK Migration — Integration', () => {
  it('agent.ts exports remain stable', async () => {
    const mod = await import('../../src/agent.js')
    expect(typeof mod.chat).toBe('function')
    expect(typeof mod.chatStream).toBe('function')
    expect(typeof mod.executeTool).toBe('function')
    expect(typeof mod.SYSTEM_PROMPT).toBe('string')
    expect(Array.isArray(mod.TOOLS)).toBe(true)
    expect(mod.TOOLS.length).toBe(21)
  })

  it('TOOLS contains all 21 expected tool names', async () => {
    const { TOOLS } = await import('../../src/agent.js')
    const names = TOOLS.map((t) => t.name).sort()
    expect(names).toContain('deposit')
    expect(names).toContain('send')
    expect(names).toContain('refund')
    expect(names).toContain('balance')
    expect(names).toContain('scan')
    expect(names).toContain('claim')
    expect(names).toContain('swap')
    expect(names).toContain('viewingKey')
    expect(names).toContain('history')
    expect(names).toContain('status')
    expect(names).toContain('paymentLink')
    expect(names).toContain('invoice')
    expect(names).toContain('privacyScore')
    expect(names).toContain('threatCheck')
    expect(names).toContain('roundAmount')
    expect(names).toContain('scheduleSend')
    expect(names).toContain('splitSend')
    expect(names).toContain('drip')
    expect(names).toContain('recurring')
    expect(names).toContain('sweep')
    expect(names).toContain('consolidate')
  })

  it('every TOOL is in valid AnthropicTool format', async () => {
    const { TOOLS } = await import('../../src/agent.js')
    for (const tool of TOOLS) {
      expect(tool).toHaveProperty('name')
      expect(typeof tool.name).toBe('string')
      expect(tool.name.length).toBeGreaterThan(0)
      expect(tool).toHaveProperty('input_schema')
      expect(tool.input_schema).toHaveProperty('type')
      expect(tool.input_schema.type).toBe('object')
    }
  })

  it('chat() and chatStream() have the expected function arity', async () => {
    const mod = await import('../../src/agent.js')
    // Both accept (userMessage: string, opts?: ChatOptions) — arity >= 1
    expect(mod.chat.length).toBeGreaterThanOrEqual(1)
    expect(mod.chatStream.length).toBeGreaterThanOrEqual(1)
  })

  it('chatStream() is an async generator function', async () => {
    const { chatStream } = await import('../../src/agent.js')
    // AsyncGeneratorFunction has Symbol.toStringTag === 'AsyncGeneratorFunction'
    const tag = Object.prototype.toString.call(chatStream)
    expect(tag).toContain('Function')
    // Calling it should return an object with a next() method (async iterator)
    // We don't await next() to avoid hitting the LLM — just verify the shape
    const gen = chatStream('test')
    expect(typeof gen.next).toBe('function')
    expect(typeof gen[Symbol.asyncIterator]).toBe('function')
    // Clean up without triggering LLM call
    await gen.return?.(undefined)
  })

  it('executeTool throws on unknown tool name', async () => {
    const { executeTool } = await import('../../src/agent.js')
    await expect(executeTool('nonexistent_tool', {})).rejects.toThrow('Unknown tool')
  })

  it('AgentCore can be instantiated with Pi tools (HERALD path)', async () => {
    const { AgentCore } = await import('../../src/core/agent-core.js')
    const { HERALD_TOOLS, HERALD_SYSTEM_PROMPT } = await import('../../src/herald/herald.js')
    const core = new AgentCore({
      systemPrompt: HERALD_SYSTEM_PROMPT,
      tools: HERALD_TOOLS,
      toolExecutor: async () => ({}),
      model: 'openrouter:anthropic/claude-sonnet-4-6',
    })
    expect(core).toBeDefined()
    expect(core).toBeInstanceOf(AgentCore)
  })

  it('AgentCore can be instantiated with Anthropic tools (SIPHER path)', async () => {
    const { AgentCore } = await import('../../src/core/agent-core.js')
    const { TOOLS, SYSTEM_PROMPT } = await import('../../src/agent.js')
    const core = new AgentCore({
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
      toolExecutor: async () => ({}),
      model: 'openrouter:anthropic/claude-sonnet-4-6',
    })
    expect(core).toBeDefined()
    expect(core).toBeInstanceOf(AgentCore)
  })
})
