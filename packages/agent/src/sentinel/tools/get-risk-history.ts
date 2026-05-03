import type { AnthropicTool } from '../../pi/tool-adapter.js'
import { getRiskHistory, type RiskHistoryRow } from '../../db.js'

// Reference: docs/sentinel/tools.md

export interface GetRiskHistoryParams { address: string; limit?: number }
export interface GetRiskHistoryResult {
  history: Pick<RiskHistoryRow, 'risk' | 'score' | 'recommendation' | 'createdAt'>[]
}

/**
 * Read prior SENTINEL risk reports for an address from sentinel_risk_history.
 * @type read | @usedBy SentinelCore
 * @whenFired When SENTINEL checks whether a wallet has a documented risk escalation history before scoring a new event.
 * @see docs/sentinel/tools.md#getriskhistory
 */
export const getRiskHistoryTool: AnthropicTool = {
  name: 'getRiskHistory',
  description: 'Read prior SENTINEL risk reports for an address (from sentinel_risk_history).',
  input_schema: {
    type: 'object' as const,
    properties: {
      address: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['address'],
  },
}

export async function executeGetRiskHistory(
  params: GetRiskHistoryParams,
): Promise<GetRiskHistoryResult> {
  const rows = getRiskHistory(params.address, params.limit ?? 20)
  return {
    history: rows.map((r) => ({
      risk: r.risk, score: r.score, recommendation: r.recommendation, createdAt: r.createdAt,
    })),
  }
}
