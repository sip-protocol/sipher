import type { AnthropicTool } from '../../pi/tool-adapter.js'
import { scheduleCancellableAction } from '../circuit-breaker.js'

// Reference: docs/sentinel/tools.md

export interface ScheduleCancellableParams {
  actionType: string
  payload: Record<string, unknown>
  reasoning: string
  delayMs: number
  wallet: string
  decisionId?: string
}

/**
 * Schedule an action for delayed execution inside the circuit breaker with a cancellation window.
 * @type action | @usedBy SentinelCore
 * @whenFired When executeRefund determines the amount exceeds the auto-refund threshold and deferred execution is required.
 * @see docs/sentinel/tools.md#schedulecancellableaction
 */
export const scheduleCancellableTool: AnthropicTool = {
  name: 'scheduleCancellableAction',
  description:
    'Schedule an action for delayed execution inside the circuit breaker. ' +
    'Primarily used internally by executeRefund for amounts above the auto-refund threshold.',
  input_schema: {
    type: 'object' as const,
    properties: {
      actionType: { type: 'string' },
      payload: { type: 'object' },
      reasoning: { type: 'string' },
      delayMs: { type: 'number' },
      wallet: { type: 'string' },
      decisionId: { type: 'string' },
    },
    required: ['actionType', 'payload', 'reasoning', 'delayMs', 'wallet'],
  },
}

export async function executeScheduleCancellable(
  params: ScheduleCancellableParams,
): Promise<{ success: true; actionId: string }> {
  const actionId = scheduleCancellableAction(params)
  return { success: true, actionId }
}
