import type { AnthropicTool } from '../../pi/tool-adapter.js'
import { getActiveBlacklistEntry, type BlacklistEntry } from '../../db.js'

// Reference: docs/sentinel/tools.md

export interface CheckReputationParams { address: string }
export interface CheckReputationResult {
  blacklisted: boolean
  entry?: BlacklistEntry
}

/**
 * Check whether an address is on the SENTINEL blacklist.
 * @type read | @usedBy SentinelCore
 * @whenFired When SENTINEL evaluates an incoming address during preflight or risk assessment.
 * @see docs/sentinel/tools.md#checkreputation
 */
export const checkReputationTool: AnthropicTool = {
  name: 'checkReputation',
  description: 'Check whether an address is on the SENTINEL blacklist. Returns blacklist entry details when found.',
  input_schema: {
    type: 'object' as const,
    properties: {
      address: { type: 'string', description: 'Solana address to check' },
    },
    required: ['address'],
  },
}

export async function executeCheckReputation(
  params: CheckReputationParams,
): Promise<CheckReputationResult> {
  if (!params.address) throw new Error('address is required')
  const entry = getActiveBlacklistEntry(params.address)
  return entry ? { blacklisted: true, entry } : { blacklisted: false }
}
