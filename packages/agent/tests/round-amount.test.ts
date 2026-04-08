import { describe, it, expect } from 'vitest'

const { roundAmountTool, executeRoundAmount } = await import('../src/tools/round-amount.js')

describe('roundAmount tool definition', () => {
  it('has correct name', () => {
    expect(roundAmountTool.name).toBe('roundAmount')
  })

  it('requires amount and token', () => {
    expect(roundAmountTool.input_schema.required).toContain('amount')
    expect(roundAmountTool.input_schema.required).toContain('token')
  })
})

describe('executeRoundAmount', () => {
  it('rounds 1337.42 to 1000', async () => {
    const result = await executeRoundAmount({ amount: 1337.42, token: 'USDC' })
    expect(result.action).toBe('roundAmount')
    expect(result.roundedAmount).toBe(1000)
    expect(result.remainder).toBeCloseTo(337.42, 2)
    expect(result.denomination).toBe(1000)
  })

  it('rounds 73 to 50', async () => {
    const result = await executeRoundAmount({ amount: 73, token: 'SOL' })
    expect(result.roundedAmount).toBe(50)
    expect(result.remainder).toBeCloseTo(23, 2)
    expect(result.denomination).toBe(50)
  })

  it('rounds 5432 to 5000', async () => {
    const result = await executeRoundAmount({ amount: 5432, token: 'USDC' })
    expect(result.roundedAmount).toBe(5000)
    expect(result.remainder).toBeCloseTo(432, 2)
    expect(result.denomination).toBe(5000)
  })

  it('rounds 15000 to 10000', async () => {
    const result = await executeRoundAmount({ amount: 15000, token: 'USDC' })
    expect(result.roundedAmount).toBe(10000)
    expect(result.remainder).toBeCloseTo(5000, 2)
    expect(result.denomination).toBe(10000)
  })

  it('returns exact amount if already a denomination', async () => {
    const result = await executeRoundAmount({ amount: 100, token: 'USDC' })
    expect(result.roundedAmount).toBe(100)
    expect(result.remainder).toBe(0)
  })

  it('handles amounts below smallest denomination', async () => {
    const result = await executeRoundAmount({ amount: 7, token: 'SOL' })
    expect(result.roundedAmount).toBe(0)
    expect(result.remainder).toBe(7)
    expect(result.denomination).toBe(0)
    expect(result.message).toMatch(/too small/i)
  })

  it('throws when amount is zero or negative', async () => {
    await expect(executeRoundAmount({ amount: 0, token: 'SOL' })).rejects.toThrow(/amount/i)
    await expect(executeRoundAmount({ amount: -5, token: 'SOL' })).rejects.toThrow(/amount/i)
  })
})
