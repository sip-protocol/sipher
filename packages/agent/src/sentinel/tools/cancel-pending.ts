import type { AnthropicTool } from '../../pi/tool-adapter.js'
import { cancelCircuitBreakerAction } from '../circuit-breaker.js'

export interface CancelPendingParams { actionId: string; reason: string }

export const cancelPendingTool: AnthropicTool = {
  name: 'cancelPendingAction',
  description: 'Cancel a pending circuit-breaker action before its execute window fires.',
  input_schema: {
    type: 'object' as const,
    properties: {
      actionId: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['actionId', 'reason'],
  },
}

export async function executeCancelPending(
  params: CancelPendingParams,
): Promise<{ success: boolean }> {
  const ok = cancelCircuitBreakerAction(params.actionId, 'sentinel', params.reason)
  return { success: ok }
}
