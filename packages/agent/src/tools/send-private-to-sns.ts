import type { AnthropicTool } from '../pi/tool-adapter.js'
import { executeResolveSNS, type ResolveSNSToolResult } from './resolve-sns.js'
import { executeSend, type SendToolResult } from './send.js'

// ─────────────────────────────────────────────────────────────────────────────
// sendPrivateToSNS — composite tool
//
// Resolves a .sol domain to its SIP-STEALTH meta-address, builds the sip:
// URI in the 0x-hex form that sendTool expects, then delegates to executeSend
// (which derives the one-time stealth address, builds the Pedersen commitment,
// encrypts the amount + blinding, and serializes the unsigned withdraw tx).
//
// SENTINEL preflight: registered in preflight-rules.ts FUND_MOVING_TOOLS.
// The gate at agent.ts:executeTool reads input.recipient (= the .sol domain)
// for blacklist/known-repeat/dust evaluation BEFORE this executor runs.
// ─────────────────────────────────────────────────────────────────────────────

export interface SendPrivateToSNSParams {
  /** Recipient .sol domain (case-insensitive). Naming matches the preflight gate's input.recipient read. */
  recipient: string
  amount: number
  token: string
  wallet?: string
  memo?: string
}

export type SendPrivateToSNSToolResult =
  | {
      action: 'sendPrivateToSNS'
      status: 'ok'
      domain: string
      resolved: { chain: 'solana'; spending: string; viewing: string }
      send: SendToolResult
    }
  | {
      action: 'sendPrivateToSNS'
      status: 'cannot-send'
      domain: string
      reason: 'no-domain' | 'no-record' | 'malformed-record' | 'network-error'
      detail?: string
    }

export const sendPrivateToSNSTool: AnthropicTool = {
  name: 'sendPrivateToSNS',
  description:
    'Send a private payment to a .sol domain by name. Resolves the SIP-STEALTH ' +
    'record on the domain, builds the sip: meta-address URI, then routes through ' +
    'the send tool. Returns status=ok with the unsigned withdraw tx (status: ' +
    'awaiting_signature) when the domain has a SIP-STEALTH record, or status=' +
    'cannot-send with a reason when the record is missing, malformed, or the RPC ' +
    'is unreachable.',
  input_schema: {
    type: 'object' as const,
    properties: {
      recipient: {
        type: 'string',
        description: 'Recipient .sol domain (e.g. "rector.sol"). Case-insensitive.',
      },
      amount: {
        type: 'number',
        description: 'Amount to send (in human-readable units)',
      },
      token: {
        type: 'string',
        description: 'Token symbol — SOL, USDC, USDT, or SPL mint address',
      },
      wallet: {
        type: 'string',
        description:
          'Sender wallet address (base58). Required to build the unsigned transaction; ' +
          'omit for a preview result with no tx.',
      },
      memo: {
        type: 'string',
        description: 'Optional encrypted memo for the recipient',
      },
    },
    required: ['recipient', 'amount', 'token'],
  },
}

export async function executeSendPrivateToSNS(
  params: SendPrivateToSNSParams,
): Promise<SendPrivateToSNSToolResult> {
  if (!params.recipient || params.recipient.trim().length === 0) {
    throw new Error('Recipient .sol domain is required')
  }
  const domain = params.recipient.trim().toLowerCase()
  if (!domain.endsWith('.sol')) {
    throw new Error('Recipient must be a .sol domain')
  }

  const resolved: ResolveSNSToolResult = await executeResolveSNS({ domain })

  if (resolved.status !== 'resolved') {
    return mapResolveFailure(domain, resolved)
  }

  const recipientUri = `sip:solana:0x${resolved.spending}:0x${resolved.viewing}`

  const sendResult = await executeSend({
    amount: params.amount,
    token: params.token,
    recipient: recipientUri,
    wallet: params.wallet,
    memo: params.memo,
  })

  return {
    action: 'sendPrivateToSNS',
    status: 'ok',
    domain: resolved.domain,
    resolved: {
      chain: resolved.chain,
      spending: resolved.spending,
      viewing: resolved.viewing,
    },
    send: sendResult,
  }
}

function mapResolveFailure(
  domain: string,
  result: Exclude<ResolveSNSToolResult, { status: 'resolved' }>,
): SendPrivateToSNSToolResult {
  if (result.status === 'not-found') {
    return {
      action: 'sendPrivateToSNS',
      status: 'cannot-send',
      domain,
      reason: result.subject === 'domain' ? 'no-domain' : 'no-record',
    }
  }
  if (result.status === 'malformed') {
    return {
      action: 'sendPrivateToSNS',
      status: 'cannot-send',
      domain,
      reason: 'malformed-record',
      detail: result.reason,
    }
  }
  if (result.status === 'network-error') {
    return {
      action: 'sendPrivateToSNS',
      status: 'cannot-send',
      domain,
      reason: 'network-error',
      detail: result.message,
    }
  }
  const exhaustive: never = result
  throw new Error(
    `Unexpected resolveSNS status: ${(exhaustive as { status: string }).status}`,
  )
}
