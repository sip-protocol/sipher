import type Anthropic from '@anthropic-ai/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// Refund tool — Withdraw available balance back to depositor
// ─────────────────────────────────────────────────────────────────────────────

export interface RefundParams {
  token: string
  wallet?: string
}

export interface RefundToolResult {
  action: 'refund'
  token: string
  wallet: string | null
  status: 'awaiting_signature'
  message: string
  details: {
    refundTimeout: string
    note: string
  }
}

export const refundTool: Anthropic.Tool = {
  name: 'refund',
  description:
    'Refund available (unlocked) balance from the vault back to the depositor wallet. ' +
    'Only available after the 24-hour refund cooldown period. ' +
    'Locked funds (from pending private sends) cannot be refunded.',
  input_schema: {
    type: 'object' as const,
    properties: {
      token: {
        type: 'string',
        description: 'Token symbol to refund — SOL, USDC, USDT, or SPL mint address',
      },
      wallet: {
        type: 'string',
        description: 'Depositor wallet address (base58). Optional if session has a connected wallet.',
      },
    },
    required: ['token'],
  },
}

export async function executeRefund(params: RefundParams): Promise<RefundToolResult> {
  if (!params.token || params.token.trim().length === 0) {
    throw new Error('Token symbol is required')
  }

  const token = params.token.toUpperCase()

  return {
    action: 'refund',
    token,
    wallet: params.wallet ?? null,
    status: 'awaiting_signature',
    message:
      `Refund prepared: all available ${token} balance returning to your wallet. ` +
      `Awaiting wallet signature.`,
    details: {
      refundTimeout: '24 hours after last deposit',
      note: 'Locked amounts from pending sends are excluded. Your funds are safe.',
    },
  }
}
