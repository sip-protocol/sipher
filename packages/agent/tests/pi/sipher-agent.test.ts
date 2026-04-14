import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createPiAgent } from '../../src/pi/sipher-agent.js'
import type Anthropic from '@anthropic-ai/sdk'
import type { AgentTool } from '@mariozechner/pi-agent-core'

const sampleTools: Anthropic.Tool[] = [
  {
    name: 'echo',
    description: 'Echo input',
    input_schema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] },
  },
]

describe('createPiAgent', () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key'
  })

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY
    delete process.env.SIPHER_MODEL
  })

  it('builds an Agent with the specified model and tools', () => {
    const agent = createPiAgent({
      systemPrompt: 'You are a test bot.',
      tools: sampleTools,
      toolExecutor: async () => ({ ok: true }),
      model: 'openrouter:anthropic/claude-haiku-4.5',
    })
    expect(agent).toBeDefined()
    expect(agent.state.systemPrompt).toBe('You are a test bot.')
    expect(agent.state.tools).toHaveLength(1)
    expect(agent.state.tools[0].name).toBe('echo')
  })

  it('seeds prior history into agent state', () => {
    const agent = createPiAgent({
      systemPrompt: 'You are a test bot.',
      tools: sampleTools,
      toolExecutor: async () => ({ ok: true }),
      history: [
        { role: 'user', content: [{ type: 'text', text: 'Hi' }], timestamp: 1 } as never,
        { role: 'assistant', content: [{ type: 'text', text: 'Hello!' }], stopReason: 'end_turn', usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, timestamp: 2 } as never,
      ],
    })
    expect(agent.state.messages).toHaveLength(2)
    expect(agent.state.messages[0].role).toBe('user')
  })

  it('uses default SIPHER model when no model passed', () => {
    const agent = createPiAgent({
      systemPrompt: 'test',
      tools: [],
      toolExecutor: async () => ({}),
    })
    expect(agent.state.model).toBeDefined()
  })

  it('attaches execute callback to each Pi AgentTool', async () => {
    let called = false
    const agent = createPiAgent({
      systemPrompt: 'test',
      tools: sampleTools,
      toolExecutor: async (name, input) => {
        called = true
        expect(name).toBe('echo')
        expect(input).toEqual({ msg: 'hi' })
        return { result: 'ok' }
      },
    })
    const tool = agent.state.tools[0] as AgentTool
    expect(tool.execute).toBeTypeOf('function')
    const result = await tool.execute('call-1', { msg: 'hi' })
    expect(called).toBe(true)
    expect(result.content).toHaveLength(1)
    expect(result.content[0]).toMatchObject({ type: 'text', text: JSON.stringify({ result: 'ok' }) })
    expect(result.details).toEqual({ result: 'ok' })
  })

  it('wraps tool errors as thrown exceptions (Pi convention: throw on failure)', async () => {
    const agent = createPiAgent({
      systemPrompt: 'test',
      tools: sampleTools,
      toolExecutor: async () => {
        throw new Error('tool failed')
      },
    })
    const tool = agent.state.tools[0] as AgentTool
    await expect(tool.execute('call-2', { msg: 'hi' })).rejects.toThrow('tool failed')
  })

  it('rejects model strings without provider:modelId format', () => {
    expect(() =>
      createPiAgent({
        systemPrompt: 'test',
        tools: [],
        toolExecutor: async () => ({}),
        model: 'claude-sonnet-no-provider',
      }),
    ).toThrow("'provider:modelId' format")
  })

  it('assigns a label to each AgentTool', () => {
    const agent = createPiAgent({
      systemPrompt: 'test',
      tools: sampleTools,
      toolExecutor: async () => ({}),
    })
    const tool = agent.state.tools[0] as AgentTool
    expect(tool.label).toBeTruthy()
    expect(typeof tool.label).toBe('string')
  })
})
