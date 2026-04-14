import { describe, it, expect } from 'vitest'
import { adaptTool, adaptTools, toPiTool, toPiTools, toAnthropicTool, toAnthropicTools } from '../../src/pi/tool-adapter.js'
import { depositTool } from '../../src/tools/deposit.js'
import { balanceTool } from '../../src/tools/balance.js'
import type Anthropic from '@anthropic-ai/sdk'
import type { Tool } from '@mariozechner/pi-ai'

const sampleAnthropicTool: Anthropic.Tool = {
  name: 'deposit',
  description: 'Deposit funds into the vault',
  input_schema: {
    type: 'object',
    properties: {
      amount: { type: 'number', description: 'Amount in SOL' },
      token: { type: 'string', description: 'Token mint or symbol' },
    },
    required: ['amount', 'token'],
  },
}

const samplePiTool: Tool = {
  name: 'postTweet',
  description: 'Queue a post',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Tweet text' },
    },
    required: ['text'],
  } as never,
}

describe('adaptTool', () => {
  it('converts Anthropic tool schema to Pi Tool', () => {
    const piTool = adaptTool(depositTool)

    expect(piTool.name).toBe('deposit')
    expect(piTool.description).toBe(depositTool.description)
    expect(piTool.parameters).toBeDefined()
  })

  it('preserves required fields in schema', () => {
    const piTool = adaptTool(depositTool)

    // Verify the schema structure
    expect(piTool.parameters).toEqual(depositTool.input_schema)
    expect(piTool.parameters.type).toBe('object')
    expect(piTool.parameters.properties).toBeDefined()
    expect(piTool.parameters.required).toContain('amount')
    expect(piTool.parameters.required).toContain('token')
  })

  it('converts read-only tool', () => {
    const piTool = adaptTool(balanceTool)

    expect(piTool.name).toBe('balance')
    expect(piTool.description).toBe(balanceTool.description)
    expect(piTool.parameters.required).toContain('token')
    expect(piTool.parameters.required).toContain('wallet')
  })

  it('preserves property descriptions', () => {
    const piTool = adaptTool(depositTool)

    expect(piTool.parameters.properties.amount.description).toBe(
      'Amount to deposit (in human-readable units, e.g. 1.5 SOL)'
    )
    expect(piTool.parameters.properties.token.description).toBe(
      'Token symbol — SOL, USDC, USDT, or any SPL token mint address'
    )
  })
})

describe('adaptTools', () => {
  it('converts multiple tools', () => {
    const piTools = adaptTools([depositTool, balanceTool])

    expect(piTools).toHaveLength(2)
    expect(piTools[0].name).toBe('deposit')
    expect(piTools[1].name).toBe('balance')
  })

  it('preserves all tool properties in batch conversion', () => {
    const piTools = adaptTools([depositTool, balanceTool])

    piTools.forEach((tool) => {
      expect(tool.name).toBeDefined()
      expect(tool.description).toBeDefined()
      expect(tool.parameters).toBeDefined()
      expect(tool.parameters.type).toBe('object')
    })
  })

  it('handles empty tool array', () => {
    const piTools = adaptTools([])

    expect(piTools).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// New symmetrical API: toPiTool / toPiTools / toAnthropicTool / toAnthropicTools
// ─────────────────────────────────────────────────────────────────────────────

describe('toPiTool', () => {
  it('converts Anthropic tool to Pi format', () => {
    const piTool = toPiTool(sampleAnthropicTool)
    expect(piTool.name).toBe('deposit')
    expect(piTool.description).toBe('Deposit funds into the vault')
    expect(piTool.parameters).toMatchObject({
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount in SOL' },
        token: { type: 'string', description: 'Token mint or symbol' },
      },
      required: ['amount', 'token'],
    })
  })

  it('handles tools without required fields', () => {
    const tool: Anthropic.Tool = {
      name: 'noop',
      description: 'Does nothing',
      input_schema: { type: 'object', properties: {} },
    }
    const piTool = toPiTool(tool)
    expect(piTool.parameters).toMatchObject({ type: 'object', properties: {}, required: [] })
  })
})

describe('toPiTools (batch)', () => {
  it('converts an array of tools', () => {
    const piTools = toPiTools([sampleAnthropicTool, sampleAnthropicTool])
    expect(piTools).toHaveLength(2)
    expect(piTools[0].name).toBe('deposit')
  })
})

describe('toAnthropicTool', () => {
  it('converts Pi tool to Anthropic format', () => {
    const anthropicTool = toAnthropicTool(samplePiTool)
    expect(anthropicTool.name).toBe('postTweet')
    expect(anthropicTool.input_schema).toMatchObject({
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Tweet text' },
      },
      required: ['text'],
    })
  })
})

describe('toAnthropicTools (batch)', () => {
  it('converts an array of Pi tools', () => {
    const anthropicTools = toAnthropicTools([samplePiTool])
    expect(anthropicTools).toHaveLength(1)
    expect(anthropicTools[0].name).toBe('postTweet')
  })
})
