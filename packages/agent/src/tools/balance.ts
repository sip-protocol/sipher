import type Anthropic from '@anthropic-ai/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// Balance tool — Check vault balance for a depositor
// ─────────────────────────────────────────────────────────────────────────────

export interface BalanceParams {
  token: string
  wallet: string
}

export interface BalanceToolResult {
  action: 'balance'
  token: string
  wallet: string
  status: 'success'
  balance: {
    total: string
    available: string
    locked: string
    cumulativeVolume: string
    lastDepositAt: string | null
    exists: boolean
  }
  message: string
}

export const balanceTool: Anthropic.Tool = {
  name: 'balance',
  description:
    'Check the vault balance for a wallet address and token. ' +
    'Returns total balance, available (unlocked) balance, and locked amount. ' +
    'No wallet signature required — this is a read-only operation.',
  input_schema: {
    type: 'object' as const,
    properties: {
      token: {
        type: 'string',
        description: 'Token symbol — SOL, USDC, USDT, or SPL mint address',
      },
      wallet: {
        type: 'string',
        description: 'Wallet address (base58) to check balance for',
      },
    },
    required: ['token', 'wallet'],
  },
}

export async function executeBalance(params: BalanceParams): Promise<BalanceToolResult> {
  if (!params.token || params.token.trim().length === 0) {
    throw new Error('Token symbol is required')
  }

  if (!params.wallet || params.wallet.trim().length === 0) {
    throw new Error('Wallet address is required')
  }

  const token = params.token.toUpperCase()

  // Phase 1: Return prepared result shape.
  // Task 5 (Integration) wires this to getVaultBalance() from @sipher/sdk.
  return {
    action: 'balance',
    token,
    wallet: params.wallet,
    status: 'success',
    balance: {
      total: '0',
      available: '0',
      locked: '0',
      cumulativeVolume: '0',
      lastDepositAt: null,
      exists: false,
    },
    message:
      `Vault balance for ${params.wallet}: 0 ${token} (no deposit record found). ` +
      `Deposit first to start using privacy features.`,
  }
}
