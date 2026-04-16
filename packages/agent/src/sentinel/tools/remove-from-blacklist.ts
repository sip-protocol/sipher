import type { AnthropicTool } from '../../pi/tool-adapter.js'
import { softRemoveBlacklist } from '../../db.js'
import { guardianBus } from '../../coordination/event-bus.js'

export interface RemoveFromBlacklistParams { entryId: string; reason: string }
export interface RemoveFromBlacklistResult { success: boolean }

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
