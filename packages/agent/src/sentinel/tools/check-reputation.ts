import type { AnthropicTool } from '../../pi/tool-adapter.js'
import { getActiveBlacklistEntry, type BlacklistEntry } from '../../db.js'

export interface CheckReputationParams { address: string }
export interface CheckReputationResult {
  blacklisted: boolean
  entry?: BlacklistEntry
}

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
