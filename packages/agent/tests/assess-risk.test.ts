// packages/agent/tests/assess-risk.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetSentinelAssessor } = vi.hoisted(() => ({
  mockGetSentinelAssessor: vi.fn(),
}))

vi.mock('../src/sentinel/preflight-gate.js', () => ({
  getSentinelAssessor: mockGetSentinelAssessor,
}))

import { assessRiskTool, executeAssessRisk } from '../src/tools/assess-risk.js'

const SAMPLE_CONTEXT = {
  action: 'send',
  wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
  recipient: 'So11111111111111111111111111111111111111112',
  amount: 1.5,
  token: 'SOL',
}

const SAMPLE_REPORT = {
  level: 'low' as const,
  summary: 'Routine send, no anomalies detected.',
  factors: [],
  recommendation: 'allow' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('assessRiskTool definition', () => {
  it('has correct name', () => {
    expect(assessRiskTool.name).toBe('assessRisk')
  })

  it('declares required action and wallet fields', () => {
    expect(assessRiskTool.input_schema.required).toEqual(['action', 'wallet'])
  })

  it('declares optional recipient/amount/token/metadata fields', () => {
    const props = assessRiskTool.input_schema.properties
    expect(props).toHaveProperty('recipient')
    expect(props).toHaveProperty('amount')
    expect(props).toHaveProperty('token')
    expect(props).toHaveProperty('metadata')
  })
})

describe('executeAssessRisk — assessor configured', () => {
  it('invokes the assessor with the provided context and returns its report', async () => {
    const fakeAssessor = vi.fn().mockResolvedValue(SAMPLE_REPORT)
    mockGetSentinelAssessor.mockReturnValue(fakeAssessor)

    const result = await executeAssessRisk(SAMPLE_CONTEXT as any)

    expect(fakeAssessor).toHaveBeenCalledTimes(1)
    expect(fakeAssessor).toHaveBeenCalledWith(SAMPLE_CONTEXT)
    expect(result).toEqual(SAMPLE_REPORT)
  })

  it('propagates errors from the underlying assessor', async () => {
    const fakeAssessor = vi.fn().mockRejectedValue(new Error('SENTINEL service down'))
    mockGetSentinelAssessor.mockReturnValue(fakeAssessor)

    await expect(executeAssessRisk(SAMPLE_CONTEXT as any)).rejects.toThrow(
      'SENTINEL service down'
    )
  })
})

describe('executeAssessRisk — assessor not configured', () => {
  it('throws when getSentinelAssessor returns null', async () => {
    mockGetSentinelAssessor.mockReturnValue(null)

    await expect(executeAssessRisk(SAMPLE_CONTEXT as any)).rejects.toThrow(
      /SENTINEL assessor not configured/i
    )
  })

  it('throws when getSentinelAssessor returns undefined', async () => {
    mockGetSentinelAssessor.mockReturnValue(undefined)

    await expect(executeAssessRisk(SAMPLE_CONTEXT as any)).rejects.toThrow(
      /SENTINEL assessor not configured/i
    )
  })
})
