import type { AnthropicTool } from '../../pi/tool-adapter.js'
import { scheduleCancellableAction } from '../circuit-breaker.js'

export interface ScheduleCancellableParams {
  actionType: string
  payload: Record<string, unknown>
  reasoning: string
  delayMs: number
  wallet: string
  decisionId?: string
}

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
