import { describe, it, expect } from 'vitest'
import { SERVICE_TOOLS, SERVICE_SYSTEM_PROMPT, SERVICE_TOOL_NAMES } from '../../packages/agent/src/agents/service-sipher.js'

describe('Service SIPHER', () => {
  it('exports SERVICE_TOOLS with read-only tools only', () => {
    const names = SERVICE_TOOLS.map(t => t.name)
    expect(names).toContain('privacyScore')
    expect(names).toContain('threatCheck')
    expect(names).toContain('history')
    expect(names).toContain('status')
    expect(names).toHaveLength(4)
  })

  it('does NOT include fund-moving tools', () => {
    const names = SERVICE_TOOLS.map(t => t.name)
    expect(names).not.toContain('deposit')
    expect(names).not.toContain('send')
    expect(names).not.toContain('swap')
    expect(names).not.toContain('claim')
    expect(names).not.toContain('refund')
  })

  it('exports SERVICE_SYSTEM_PROMPT', () => {
    expect(SERVICE_SYSTEM_PROMPT).toContain('read-only')
    expect(SERVICE_SYSTEM_PROMPT).toContain('Sipher Service')
  })

  it('exports SERVICE_TOOL_NAMES', () => {
    expect(SERVICE_TOOL_NAMES).toEqual(['privacyScore', 'threatCheck', 'history', 'status'])
  })

  it('SERVICE_TOOLS are properly adapted with parameters property', () => {
    SERVICE_TOOLS.forEach(tool => {
      expect(tool).toHaveProperty('name')
      expect(tool).toHaveProperty('description')
      expect(tool).toHaveProperty('parameters')
      expect(typeof tool.name).toBe('string')
      expect(typeof tool.description).toBe('string')
      expect(typeof tool.parameters).toBe('object')
    })
  })

  it('SERVICE_TOOLS should not have input_schema property (Anthropic format)', () => {
    SERVICE_TOOLS.forEach(tool => {
      expect(tool).not.toHaveProperty('input_schema')
    })
  })
})
