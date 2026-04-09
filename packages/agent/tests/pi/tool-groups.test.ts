import { describe, it, expect } from 'vitest'

const {
  TOOL_GROUPS,
  getToolGroup,
  routeIntentTool,
  ALL_TOOL_NAMES,
} = await import('../../src/pi/tool-groups.js')

describe('TOOL_GROUPS', () => {
  it('has exactly 4 groups', () => {
    expect(Object.keys(TOOL_GROUPS)).toHaveLength(4)
    expect(Object.keys(TOOL_GROUPS)).toEqual(
      expect.arrayContaining(['vault', 'intel', 'product', 'scheduled'])
    )
  })

  it('vault group has 6 tools', () => {
    expect(TOOL_GROUPS['vault']).toHaveLength(6)
  })

  it('intel group has 5 tools', () => {
    expect(TOOL_GROUPS['intel']).toHaveLength(5)
  })

  it('product group has 3 tools', () => {
    expect(TOOL_GROUPS['product']).toHaveLength(3)
  })

  it('scheduled group has 7 tools', () => {
    expect(TOOL_GROUPS['scheduled']).toHaveLength(7)
  })

  it('vault group contains expected tools', () => {
    const names = TOOL_GROUPS['vault'].map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining(['deposit', 'send', 'claim', 'refund', 'balance', 'scan'])
    )
  })

  it('intel group contains expected tools', () => {
    const names = TOOL_GROUPS['intel'].map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining(['privacyScore', 'threatCheck', 'viewingKey', 'history', 'status'])
    )
  })

  it('product group contains expected tools', () => {
    const names = TOOL_GROUPS['product'].map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining(['paymentLink', 'invoice', 'swap'])
    )
  })

  it('scheduled group contains expected tools', () => {
    const names = TOOL_GROUPS['scheduled'].map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'scheduleSend',
        'splitSend',
        'drip',
        'recurring',
        'sweep',
        'consolidate',
        'roundAmount',
      ])
    )
  })

  it('all tools have name, description, and parameters', () => {
    for (const [, tools] of Object.entries(TOOL_GROUPS)) {
      for (const tool of tools) {
        expect(tool).toHaveProperty('name')
        expect(tool).toHaveProperty('description')
        expect(tool).toHaveProperty('parameters')
        expect(typeof tool.name).toBe('string')
        expect(typeof tool.description).toBe('string')
      }
    }
  })
})

describe('getToolGroup', () => {
  it('returns vault group', () => {
    const tools = getToolGroup('vault')
    expect(tools).toHaveLength(6)
    expect(tools[0]).toHaveProperty('name')
  })

  it('returns intel group', () => {
    const tools = getToolGroup('intel')
    expect(tools).toHaveLength(5)
  })

  it('returns product group', () => {
    const tools = getToolGroup('product')
    expect(tools).toHaveLength(3)
  })

  it('returns scheduled group', () => {
    const tools = getToolGroup('scheduled')
    expect(tools).toHaveLength(7)
  })

  it('throws for unknown group', () => {
    expect(() => getToolGroup('unknown')).toThrow()
    expect(() => getToolGroup('')).toThrow()
    expect(() => getToolGroup('admin')).toThrow()
  })
})

describe('routeIntentTool', () => {
  it('has name routeIntent', () => {
    expect(routeIntentTool.name).toBe('routeIntent')
  })

  it('has description', () => {
    expect(typeof routeIntentTool.description).toBe('string')
    expect(routeIntentTool.description.length).toBeGreaterThan(0)
  })

  it('has parameters as object type', () => {
    expect(routeIntentTool.parameters).toBeDefined()
    expect((routeIntentTool.parameters as any).type).toBe('object')
  })

  it('has group property with enum of 4 values', () => {
    const props = (routeIntentTool.parameters as any).properties
    expect(props).toHaveProperty('group')
    expect(props.group.type).toBe('string')
    expect(props.group.enum).toHaveLength(4)
    expect(props.group.enum).toEqual(
      expect.arrayContaining(['vault', 'intel', 'product', 'scheduled'])
    )
  })

  it('has reasoning property', () => {
    const props = (routeIntentTool.parameters as any).properties
    expect(props).toHaveProperty('reasoning')
    expect(props.reasoning.type).toBe('string')
  })

  it('requires group', () => {
    const required = (routeIntentTool.parameters as any).required
    expect(required).toContain('group')
  })
})

describe('ALL_TOOL_NAMES', () => {
  it('has 21 entries', () => {
    expect(ALL_TOOL_NAMES).toHaveLength(21)
  })

  it('contains all expected tool names', () => {
    expect(ALL_TOOL_NAMES).toEqual(
      expect.arrayContaining([
        'deposit', 'send', 'claim', 'refund', 'balance', 'scan',
        'privacyScore', 'threatCheck', 'viewingKey', 'history', 'status',
        'paymentLink', 'invoice', 'swap',
        'scheduleSend', 'splitSend', 'drip', 'recurring', 'sweep', 'consolidate', 'roundAmount',
      ])
    )
  })

  it('has no duplicates', () => {
    const unique = new Set(ALL_TOOL_NAMES)
    expect(unique.size).toBe(ALL_TOOL_NAMES.length)
  })
})
