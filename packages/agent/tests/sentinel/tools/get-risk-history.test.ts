// packages/agent/tests/sentinel/tools/get-risk-history.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  makeRiskHistoryRow,
  VALID_TARGET_ADDRESS,
} from '../../fixtures/sentinel-tool-mocks.js'

const { mockGetRiskHistory } = vi.hoisted(() => ({
  mockGetRiskHistory: vi.fn(),
}))

vi.mock('../../../src/db.js', () => ({
  getRiskHistory: mockGetRiskHistory,
}))

import {
  getRiskHistoryTool,
  executeGetRiskHistory,
} from '../../../src/sentinel/tools/get-risk-history.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetRiskHistory.mockReturnValue([])
})

describe('getRiskHistoryTool definition', () => {
  it('has correct name', () => {
    expect(getRiskHistoryTool.name).toBe('getRiskHistory')
  })

  it('declares required address only (limit optional)', () => {
    expect(getRiskHistoryTool.input_schema.required).toEqual(['address'])
    expect(getRiskHistoryTool.input_schema.properties).toHaveProperty('limit')
  })

  it('has a non-empty description', () => {
    expect(getRiskHistoryTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeGetRiskHistory — happy path', () => {
  it('returns mapped history rows when DB returns entries', async () => {
    mockGetRiskHistory.mockReturnValueOnce([
      makeRiskHistoryRow({ risk: 'high', score: 90 }),
    ])

    const r = await executeGetRiskHistory({ address: VALID_TARGET_ADDRESS })

    expect(r.history.length).toBe(1)
    expect(r.history[0].risk).toBe('high')
    expect(r.history[0].score).toBe(90)
    expect(r.history[0].recommendation).toBe('block')
    expect(typeof r.history[0].createdAt).toBe('string')
  })

  it('strips fields outside the documented projection (no id, address, reasons leak)', async () => {
    mockGetRiskHistory.mockReturnValueOnce([
      makeRiskHistoryRow({ reasons: ['mixer'] }),
    ])

    const r = await executeGetRiskHistory({ address: VALID_TARGET_ADDRESS })

    const row = r.history[0] as Record<string, unknown>
    expect(row).not.toHaveProperty('id')
    expect(row).not.toHaveProperty('address')
    expect(row).not.toHaveProperty('reasons')
    expect(Object.keys(row).sort()).toEqual(['createdAt', 'recommendation', 'risk', 'score'])
  })
})

describe('executeGetRiskHistory — branches', () => {
  it('returns empty history array when DB returns []', async () => {
    mockGetRiskHistory.mockReturnValueOnce([])

    const r = await executeGetRiskHistory({ address: 'clean' })

    expect(r.history).toEqual([])
  })
})

describe('executeGetRiskHistory — service interaction', () => {
  it('passes default limit of 20 when not provided', async () => {
    await executeGetRiskHistory({ address: VALID_TARGET_ADDRESS })

    expect(mockGetRiskHistory).toHaveBeenCalledTimes(1)
    expect(mockGetRiskHistory).toHaveBeenCalledWith(VALID_TARGET_ADDRESS, 20)
  })

  it('forwards explicit limit value', async () => {
    await executeGetRiskHistory({ address: VALID_TARGET_ADDRESS, limit: 5 })

    expect(mockGetRiskHistory).toHaveBeenCalledWith(VALID_TARGET_ADDRESS, 5)
  })

  it('propagates getRiskHistory throw', async () => {
    mockGetRiskHistory.mockImplementationOnce(() => {
      throw new Error('db locked')
    })

    await expect(
      executeGetRiskHistory({ address: VALID_TARGET_ADDRESS }),
    ).rejects.toThrow(/db locked/)
  })
})
