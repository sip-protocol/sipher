import type { AnthropicTool } from '../../pi/tool-adapter.js'
import { insertActivity } from '../../db.js'
import { guardianBus } from '../../coordination/event-bus.js'

// Reference: docs/sentinel/tools.md

export interface AlertUserParams {
  wallet: string
  severity: 'warn' | 'block' | 'critical'
  title: string
  detail: string
  actionableId?: string
}

export interface AlertUserResult {
  success: boolean
  activityId: string
}

/**
 * Emit a SENTINEL alert visible in the activity stream and optionally surfaced as a UI toast.
 * @type action | @usedBy SentinelCore
 * @whenFired When SENTINEL detects a suspicious event that requires user attention without blocking the operation.
 * @see docs/sentinel/tools.md#alertuser
 */
export const alertUserTool: AnthropicTool = {
  name: 'alertUser',
  description: 'Emit a SENTINEL alert visible in the activity stream + optional UI toast.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: { type: 'string' },
      severity: { type: 'string', enum: ['warn', 'block', 'critical'] },
      title: { type: 'string' },
      detail: { type: 'string' },
      actionableId: { type: 'string' },
    },
    required: ['wallet', 'severity', 'title', 'detail'],
  },
}

export async function executeAlertUser(params: AlertUserParams): Promise<AlertUserResult> {
  const activityId = insertActivity({
    agent: 'sentinel',
    level: params.severity === 'critical' ? 'critical' : 'important',
    type: 'alert',
    title: params.title,
    detail: params.detail,
    wallet: params.wallet,
  })
  guardianBus.emit({
    source: 'sentinel',
    type: 'sentinel:alert',
    level: params.severity === 'critical' ? 'critical' : 'important',
    data: { title: params.title, detail: params.detail, severity: params.severity, actionableId: params.actionableId },
    wallet: params.wallet,
    timestamp: new Date().toISOString(),
  })
  return { success: true, activityId }
}
