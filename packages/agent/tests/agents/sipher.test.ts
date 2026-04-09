import { describe, it, expect } from 'vitest'

const {
  SIPHER_SYSTEM_PROMPT,
  FUND_MOVING_TOOLS,
  getToolExecutor,
  isFundMoving,
  getRouterTools,
  getGroupTools,
} = await import('../../src/agents/sipher.js')

describe('SIPHER agent factory', () => {
  it('exports SIPHER_SYSTEM_PROMPT', () => {
    expect(SIPHER_SYSTEM_PROMPT).toContain('Sipher')
    expect(SIPHER_SYSTEM_PROMPT).toContain('privacy')
    expect(SIPHER_SYSTEM_PROMPT).toContain('routeIntent')
  })

  it('exports FUND_MOVING_TOOLS set', () => {
    expect(FUND_MOVING_TOOLS).toContain('deposit')
    expect(FUND_MOVING_TOOLS).toContain('send')
    expect(FUND_MOVING_TOOLS).toContain('swap')
    expect(FUND_MOVING_TOOLS).not.toContain('balance')
    expect(FUND_MOVING_TOOLS).not.toContain('privacyScore')
    expect(FUND_MOVING_TOOLS).not.toContain('history')
  })

  it('isFundMoving returns true for fund-moving tools', () => {
    expect(isFundMoving('deposit')).toBe(true)
    expect(isFundMoving('send')).toBe(true)
    expect(isFundMoving('balance')).toBe(false)
    expect(isFundMoving('privacyScore')).toBe(false)
  })

  it('getRouterTools returns routeIntent', () => {
    const tools = getRouterTools()
    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('routeIntent')
  })

  it('getGroupTools delegates to getToolGroup', () => {
    const tools = getGroupTools('vault')
    expect(tools.map((t: { name: string }) => t.name)).toContain('deposit')
  })

  it('getToolExecutor returns a function', () => {
    const exec = getToolExecutor('balance')
    expect(typeof exec).toBe('function')
  })
})
