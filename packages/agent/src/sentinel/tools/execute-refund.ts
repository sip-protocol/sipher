import type { AnthropicTool } from '../../pi/tool-adapter.js'
import { getSentinelConfig } from '../config.js'
import { scheduleCancellableAction } from '../circuit-breaker.js'
import { performVaultRefund } from '../vault-refund.js'

// Reference: docs/sentinel/tools.md

export interface SentinelRefundParams {
  pda: string
  amount: number
  reasoning: string
  wallet: string
  decisionId?: string
}

export interface SentinelRefundResult {
  mode: 'immediate' | 'scheduled'
  actionId?: string
  result?: Record<string, unknown>
}

/**
 * Auto-refund a deposit PDA back to the depositor via the sipher_vault authority_refund path.
 * Small amounts execute immediately; larger amounts enter the circuit breaker with a cancellation window.
 * @type action | @usedBy SentinelCore
 * @whenFired When SENTINEL determines a deposit should be returned — either on timeout, suspected fraud, or operator directive.
 * @see docs/sentinel/tools.md#executerefund
 */
export const executeRefundTool: AnthropicTool = {
  name: 'executeRefund',
  description:
    'Auto-refund a deposit PDA back to the depositor. Amounts ≤ SENTINEL_AUTO_REFUND_THRESHOLD execute immediately; ' +
    'larger amounts go through the circuit-breaker with SENTINEL_CANCEL_WINDOW_MS delay.',
  input_schema: {
    type: 'object' as const,
    properties: {
      pda: { type: 'string' },
      amount: { type: 'number', description: 'Amount in SOL' },
      reasoning: { type: 'string', description: 'Why this refund is fired' },
      wallet: { type: 'string', description: 'Owner wallet (for rate-limit scope)' },
      decisionId: { type: 'string' },
    },
    required: ['pda', 'amount', 'reasoning', 'wallet'],
  },
}

export async function executeSentinelRefund(
  params: SentinelRefundParams,
): Promise<SentinelRefundResult> {
  const config = getSentinelConfig()
  if (config.mode === 'advisory' || config.mode === 'off') {
    throw new Error(`SENTINEL mode=${config.mode} cannot execute refunds`)
  }

  if (params.amount <= config.autoRefundThreshold) {
    const result = await performVaultRefund(params.pda, params.amount)
    return { mode: 'immediate', result }
  }

  const actionId = scheduleCancellableAction({
    actionType: 'refund',
    payload: { pda: params.pda, amount: params.amount },
    reasoning: params.reasoning,
    wallet: params.wallet,
    delayMs: config.cancelWindowMs,
    decisionId: params.decisionId,
  })
  return { mode: 'scheduled', actionId }
}
