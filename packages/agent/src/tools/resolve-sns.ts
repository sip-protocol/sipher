import type { AnthropicTool } from '../pi/tool-adapter.js'
import {
  resolveSIPStealth,
  MetaAddress,
  NotFound,
  Malformed,
  NetworkError,
} from '@sip-protocol/sns-stealth'
import { createConnection } from '@sipher/sdk'
import { loadNetworkConfig } from '../config/network.js'

// ─────────────────────────────────────────────────────────────────────────────
// resolveSNS tool — read-only resolution of .sol → SIP-STEALTH meta-address
//
// NOTE: Read-only. NOT a fund-mover. Intentionally NOT registered in
// preflight-rules.ts FUND_MOVING_TOOLS. The composite sendPrivateToSNS tool
// (which calls this + executeSend) IS a fund-mover and goes through the gate.
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolveSNSParams {
  domain: string
}

export type ResolveSNSToolResult =
  | {
      status: 'resolved'
      domain: string
      chain: 'solana'
      spending: string
      viewing: string
    }
  | { status: 'not-found'; domain: string; subject: 'domain' | 'record' }
  | { status: 'malformed'; domain: string; reason: 'json-parse' | 'schema' }
  | { status: 'network-error'; domain: string; message: string }

export const resolveSNSTool: AnthropicTool = {
  name: 'resolveSNS',
  description:
    'Resolve a .sol domain to its SIP-STEALTH meta-address. ' +
    'Returns one of: resolved (spending + viewing hex keys), not-found (no domain or no record), ' +
    'malformed (record schema error), network-error (RPC unavailable). ' +
    'Read-only — does not move funds.',
  input_schema: {
    type: 'object' as const,
    properties: {
      domain: {
        type: 'string',
        description: 'The .sol domain to resolve (e.g. "rector.sol"). Case-insensitive.',
      },
    },
    required: ['domain'],
  },
}

export async function executeResolveSNS(
  params: ResolveSNSParams,
): Promise<ResolveSNSToolResult> {
  if (!params.domain || params.domain.trim().length === 0) {
    throw new Error('Domain is required')
  }

  const domain = params.domain.trim().toLowerCase()
  if (!domain.endsWith('.sol')) {
    throw new Error('Domain must end in .sol')
  }

  const connection = createConnection(loadNetworkConfig().clusterName)

  let result
  try {
    result = await resolveSIPStealth(connection, domain)
  } catch (err) {
    if (err instanceof NetworkError) {
      return { status: 'network-error', domain, message: err.message }
    }
    throw err
  }

  if (result instanceof MetaAddress) {
    return {
      status: 'resolved',
      domain: result.domain,
      chain: result.chain,
      spending: bytesToHex(result.spending),
      viewing: bytesToHex(result.viewing),
    }
  }
  if (result instanceof NotFound) {
    return { status: 'not-found', domain, subject: result.subject }
  }
  if (result instanceof Malformed) {
    return { status: 'malformed', domain, reason: result.reason }
  }
  throw new Error('Unexpected resolveSIPStealth result')
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}
