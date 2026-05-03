import type { AnthropicTool } from '../../pi/tool-adapter.js'
import { softRemoveBlacklist } from '../../db.js'
import { guardianBus } from '../../coordination/event-bus.js'

// Reference: docs/sentinel/tools.md

export interface RemoveFromBlacklistParams { entryId: string; reason: string }
export interface RemoveFromBlacklistResult { success: boolean }

/**
 * Soft-remove a blacklist entry, reversing a prior addToBlacklist action.
 * @type action | @usedBy SentinelCore
 * @whenFired When SENTINEL determines a prior blacklist entry was erroneous or the threat has been resolved.
 * @see docs/sentinel/tools.md#removefromblacklist
 */
export const removeFromBlacklistTool: AnthropicTool = {
  name: 'removeFromBlacklist',
  description: 'Soft-remove a blacklist entry (reversal of a prior addToBlacklist).',
  input_schema: {
    type: 'object' as const,
    properties: {
      entryId: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['entryId', 'reason'],
  },
}

export async function executeRemoveFromBlacklist(
  params: RemoveFromBlacklistParams,
): Promise<RemoveFromBlacklistResult> {
  softRemoveBlacklist(params.entryId, 'sentinel', params.reason)
  guardianBus.emit({
    source: 'sentinel',
    type: 'sentinel:blacklist-removed',
    level: 'important',
    data: { entryId: params.entryId, reason: params.reason },
    wallet: null,
    timestamp: new Date().toISOString(),
  })
  return { success: true }
}
