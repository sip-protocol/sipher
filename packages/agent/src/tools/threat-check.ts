import type { AnthropicTool } from '../pi/tool-adapter.js'
import {
  classifyAddress,
  isOfacSanctioned,
  getExchangeLabel,
  getScamDescription,
} from '../data/known-addresses.js'

export interface ThreatCheckParams {
  address: string
}

export interface ThreatCheckToolResult {
  action: 'threatCheck'
  status: 'success'
  verdict: 'safe' | 'caution' | 'blocked'
  reason: string | null
  addressType: 'exchange' | 'ofac' | 'scam' | 'unknown'
  message: string
}

export const threatCheckTool: AnthropicTool = {
  name: 'threatCheck',
  description:
    'Check a recipient address for known risks before sending. ' +
    'Screens against OFAC sanctions, known exchange deposit addresses, ' +
    'and community-reported scam databases. Run this before large transfers.',
  input_schema: {
    type: 'object' as const,
    properties: {
      address: {
        type: 'string',
        description: 'Recipient address (base58) to check',
      },
    },
    required: ['address'],
  },
}

export async function executeThreatCheck(
  params: ThreatCheckParams,
): Promise<ThreatCheckToolResult> {
  if (!params.address || params.address.trim().length === 0) {
    throw new Error('Recipient address is required for threat checking')
  }

  const address = params.address.trim()

  if (isOfacSanctioned(address)) {
    return {
      action: 'threatCheck',
      status: 'success',
      verdict: 'blocked',
      reason: 'Address is on the OFAC SDN sanctions list',
      addressType: 'ofac',
      message: 'BLOCKED: This address is sanctioned by the US Treasury (OFAC). Sending funds to this address may violate sanctions law.',
    }
  }

  const scamDesc = getScamDescription(address)
  if (scamDesc) {
    return {
      action: 'threatCheck',
      status: 'success',
      verdict: 'blocked',
      reason: `Known scam address: ${scamDesc}`,
      addressType: 'scam',
      message: `BLOCKED: This address has been reported as a scam — ${scamDesc}. Do not send funds.`,
    }
  }

  const exchangeLabel = getExchangeLabel(address)
  if (exchangeLabel) {
    return {
      action: 'threatCheck',
      status: 'success',
      verdict: 'caution',
      reason: `Known ${exchangeLabel} deposit/hot wallet`,
      addressType: 'exchange',
      message: `CAUTION: This appears to be a ${exchangeLabel} deposit address. Sending directly to an exchange reduces privacy — the exchange can link this to your identity. Consider using a stealth address intermediary.`,
    }
  }

  return {
    action: 'threatCheck',
    status: 'success',
    verdict: 'safe',
    reason: null,
    addressType: 'unknown',
    message: 'Address is not on any known risk lists. Proceed with normal precautions.',
  }
}
