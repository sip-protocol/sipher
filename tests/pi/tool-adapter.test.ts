import { describe, it, expect } from 'vitest'
import { adaptTool, adaptTools } from '../../packages/agent/src/pi/tool-adapter.js'
import { depositTool } from '../../packages/agent/src/tools/deposit.js'
import { balanceTool } from '../../packages/agent/src/tools/balance.js'

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
