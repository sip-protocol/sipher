import type Anthropic from '@anthropic-ai/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// Deposit tool — Fund the Sipher privacy vault
// ─────────────────────────────────────────────────────────────────────────────

export interface DepositParams {
  amount: number
  token: string
  wallet?: string
}

export interface DepositToolResult {
  action: 'deposit'
  amount: number
  token: string
  wallet: string | null
  status: 'awaiting_signature'
  message: string
  details: {
    vaultProgram: string
    estimatedFee: string
    note: string
  }
}

export const depositTool: Anthropic.Tool = {
  name: 'deposit',
  description:
    'Deposit tokens into the Sipher privacy vault. ' +
    'User must sign the resulting transaction with their wallet. ' +
    'Supports SOL (native) and any SPL token (USDC, USDT, etc.).',
  input_schema: {
    type: 'object' as const,
    properties: {
      amount: {
        type: 'number',
        description: 'Amount to deposit (in human-readable units, e.g. 1.5 SOL)',
      },
      token: {
        type: 'string',
        description: 'Token symbol — SOL, USDC, USDT, or any SPL token mint address',
      },
      wallet: {
        type: 'string',
        description: 'Depositor wallet address (base58). Optional if session has a connected wallet.',
      },
    },
    required: ['amount', 'token'],
  },
}

export async function executeDeposit(params: DepositParams): Promise<DepositToolResult> {
  if (params.amount <= 0) {
    throw new Error('Deposit amount must be greater than zero')
  }

  if (!params.token || params.token.trim().length === 0) {
    throw new Error('Token symbol is required')
  }

  const token = params.token.toUpperCase()

  return {
    action: 'deposit',
    amount: params.amount,
    token,
    wallet: params.wallet ?? null,
    status: 'awaiting_signature',
    message: `Deposit prepared: ${params.amount} ${token} into vault. Awaiting wallet signature.`,
    details: {
      vaultProgram: 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB',
      estimatedFee: '~5000 lamports (tx fee)',
      note: 'Funds enter the shared anonymity pool. Refundable after 24h cooldown.',
    },
  }
}
