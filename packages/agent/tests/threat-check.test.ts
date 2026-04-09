import { describe, it, expect } from 'vitest'

const { threatCheckTool, executeThreatCheck } = await import('../src/tools/threat-check.js')

describe('threatCheck tool definition', () => {
  it('has correct name', () => {
    expect(threatCheckTool.name).toBe('threatCheck')
  })

  it('requires address', () => {
    expect(threatCheckTool.input_schema.required).toContain('address')
  })
})

describe('executeThreatCheck', () => {
  it('returns safe for unknown address', async () => {
    const result = await executeThreatCheck({
      address: 'RandomSafeAddr111111111111111111111111111111',
    })
    expect(result.action).toBe('threatCheck')
    expect(result.verdict).toBe('safe')
    expect(result.reason).toBeNull()
  })

  it('returns caution for known exchange address', async () => {
    const result = await executeThreatCheck({
      address: '5tzFkiKscMHkVPEGu4rS1dCUx6g9mCEbpXME2AcKJPpP',
    })
    expect(result.verdict).toBe('caution')
    expect(result.reason).toMatch(/Binance/i)
    expect(result.addressType).toBe('exchange')
  })

  it('returns caution for another exchange', async () => {
    const result = await executeThreatCheck({
      address: 'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7TjN',
    })
    expect(result.verdict).toBe('caution')
    expect(result.reason).toMatch(/Coinbase/i)
  })

  it('throws when address is missing', async () => {
    await expect(executeThreatCheck({} as any)).rejects.toThrow(/address/i)
  })

  it('throws when address is empty', async () => {
    await expect(executeThreatCheck({ address: '' })).rejects.toThrow(/address/i)
  })

  it('returns all required fields', async () => {
    const result = await executeThreatCheck({
      address: 'RandomAddr111111111111111111111111111111111111',
    })
    expect(result).toHaveProperty('action', 'threatCheck')
    expect(result).toHaveProperty('status', 'success')
    expect(result).toHaveProperty('verdict')
    expect(result).toHaveProperty('reason')
    expect(result).toHaveProperty('addressType')
    expect(result).toHaveProperty('message')
  })
})
