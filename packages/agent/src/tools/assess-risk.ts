import type { AnthropicTool } from '../pi/tool-adapter.js'
import { getSentinelAssessor } from '../sentinel/preflight-gate.js'
import type { PreflightContext } from '../sentinel/prompts.js'
import type { RiskReport } from '../sentinel/risk-report.js'

export const assessRiskTool: AnthropicTool = {
  name: 'assessRisk',
  description:
    'Ask SENTINEL to evaluate a proposed fund-moving action and return a RiskReport. ' +
    'Use when you want an explicit risk verdict before acting. ' +
    'SIPHER also auto-invokes SENTINEL via a preflight gate on fund-moving tools.',
  input_schema: {
    type: 'object' as const,
    properties: {
      action: { type: 'string', description: 'Tool name being assessed (e.g. "send")' },
      wallet: { type: 'string' },
      recipient: { type: 'string' },
      amount: { type: 'number' },
      token: { type: 'string' },
      metadata: { type: 'object', description: 'Optional free-form context' },
    },
    required: ['action', 'wallet'],
  },
}

export async function executeAssessRisk(params: PreflightContext): Promise<RiskReport> {
  const fn = getSentinelAssessor()
  if (!fn) throw new Error('SENTINEL assessor not configured')
  return fn(params)
}
