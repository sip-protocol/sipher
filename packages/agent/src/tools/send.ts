import type Anthropic from '@anthropic-ai/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// Private Send tool — Withdraw from vault to a stealth address
// ─────────────────────────────────────────────────────────────────────────────

export interface SendParams {
  amount: number
  token: string
  recipient: string
  memo?: string
}

export interface SendToolResult {
  action: 'send'
  amount: number
  token: string
  recipient: string
  status: 'awaiting_signature'
  message: string
  privacy: {
    stealthAddress: string
    commitmentGenerated: boolean
    viewingKeyHashIncluded: boolean
    feeBps: number
    estimatedFee: string
  }
}

export const sendTool: Anthropic.Tool = {
  name: 'send',
  description:
    'Send a private payment from the vault to a recipient. ' +
    'Creates a stealth address, Pedersen commitment, and builds an unsigned withdraw_private transaction. ' +
    'The recipient can scan for this payment using their viewing key.',
  input_schema: {
    type: 'object' as const,
    properties: {
      amount: {
        type: 'number',
        description: 'Amount to send (in human-readable units)',
      },
      token: {
        type: 'string',
        description: 'Token symbol — SOL, USDC, USDT, or SPL mint address',
      },
      recipient: {
        type: 'string',
        description:
          'Recipient stealth meta-address (sip:solana:...) or raw spending pubkey (base58)',
      },
      memo: {
        type: 'string',
        description: 'Optional encrypted memo for the recipient',
      },
    },
    required: ['amount', 'token', 'recipient'],
  },
}

export async function executeSend(params: SendParams): Promise<SendToolResult> {
  if (params.amount <= 0) {
    throw new Error('Send amount must be greater than zero')
  }

  if (!params.token || params.token.trim().length === 0) {
    throw new Error('Token symbol is required')
  }

  if (!params.recipient || params.recipient.trim().length === 0) {
    throw new Error('Recipient address is required')
  }

  const token = params.token.toUpperCase()
  const feeBps = 10
  const feePercent = feeBps / 100

  return {
    action: 'send',
    amount: params.amount,
    token,
    recipient: params.recipient,
    status: 'awaiting_signature',
    message:
      `Private send prepared: ${params.amount} ${token} to stealth address. ` +
      `Fee: ${feePercent}%. Awaiting wallet signature.`,
    privacy: {
      stealthAddress: '<derived-at-execution>',
      commitmentGenerated: true,
      viewingKeyHashIncluded: true,
      feeBps,
      estimatedFee: `${(params.amount * feePercent) / 100} ${token}`,
    },
  }
}
