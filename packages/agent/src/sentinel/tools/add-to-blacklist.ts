import type { AnthropicTool } from '../../pi/tool-adapter.js'
import { insertBlacklist } from '../../db.js'
import { isBlacklistWithinRateLimit } from '../rate-limit.js'
import { getSentinelConfig } from '../config.js'
import { guardianBus } from '../../coordination/event-bus.js'

export interface AddToBlacklistParams {
  address: string
  reason: string
  severity: 'warn' | 'block' | 'critical'
  expiresAt?: string
  sourceEventId?: string
}

export interface AddToBlacklistResult {
  success: boolean
  entryId?: string
  error?: string
}

export const addToBlacklistTool: AnthropicTool = {
  name: 'addToBlacklist',
  description: 'Add an address to the SENTINEL blacklist. Rate-limited to SENTINEL_RATE_LIMIT_BLACKLIST_PER_HOUR/hr.',
  input_schema: {
    type: 'object' as const,
    properties: {
      address: { type: 'string' },
      reason: { type: 'string' },
      severity: { type: 'string', enum: ['warn', 'block', 'critical'] },
      expiresAt: { type: 'string', description: 'ISO timestamp; null for permanent' },
      sourceEventId: { type: 'string' },
    },
    required: ['address', 'reason', 'severity'],
  },
}

export async function executeAddToBlacklist(
  params: AddToBlacklistParams,
): Promise<AddToBlacklistResult> {
  const config = getSentinelConfig()
  if (!config.blacklistAutonomy) {
    return { success: false, error: 'blacklist autonomy disabled (SENTINEL_BLACKLIST_AUTONOMY=false)' }
  }
  if (!isBlacklistWithinRateLimit(config.rateLimitBlacklistPerHour)) {
    return { success: false, error: `rate-limit: ${config.rateLimitBlacklistPerHour}/hr cap reached` }
  }
  const entryId = insertBlacklist({ ...params, addedBy: 'sentinel' })
  guardianBus.emit({
    source: 'sentinel',
    type: 'sentinel:blacklist-added',
    level: 'important',
    data: { entryId, address: params.address, severity: params.severity, reason: params.reason },
    wallet: null,
    timestamp: new Date().toISOString(),
  })
  return { success: true, entryId }
}
