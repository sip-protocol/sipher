import type Anthropic from '@anthropic-ai/sdk'
import { PublicKey } from '@solana/web3.js'

// ─────────────────────────────────────────────────────────────────────────────
// History tool — Transaction history for a wallet's vault activity
//
// Phase 1: Validates inputs and returns the scaffold structure. Populated
// from on-chain event data when the integration phase wires up
// getSignaturesForAddress + parsed transaction logs.
// ─────────────────────────────────────────────────────────────────────────────

export interface HistoryParams {
  wallet: string
  token?: string
  limit?: number
}

export interface HistoryTransaction {
  txSignature: string
  type: 'deposit' | 'send' | 'refund' | 'claim' | 'swap'
  amount: string
  token: string
  timestamp: number
  status: 'confirmed' | 'finalized'
}

export interface HistoryToolResult {
  action: 'history'
  wallet: string
  token: string | null
  status: 'success'
  transactions: HistoryTransaction[]
  total: number
  hasMore: boolean
  message: string
}

export const historyTool: Anthropic.Tool = {
  name: 'history',
  description:
    'Retrieve transaction history for a wallet\'s vault activity. ' +
    'Shows deposits, private sends, refunds, claims, and swaps. ' +
    'Optionally filter by token. Read-only — no wallet signature required.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: {
        type: 'string',
        description: 'Wallet address (base58) to fetch history for',
      },
      token: {
        type: 'string',
        description: 'Optional token filter — SOL, USDC, USDT, or SPL mint address',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of transactions to return (default: 20, max: 100)',
      },
    },
    required: ['wallet'],
  },
}

export async function executeHistory(params: HistoryParams): Promise<HistoryToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) {
    throw new Error('Wallet address is required')
  }

  // Validate wallet is a valid Solana pubkey
  try {
    new PublicKey(params.wallet)
  } catch {
    throw new Error(`Invalid wallet address: ${params.wallet}`)
  }

  const token = params.token?.toUpperCase() ?? null
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100)

  // Phase 1: Return empty transaction list. The integration phase will
  // fetch on-chain signatures via getSignaturesForAddress, parse logs for
  // vault events, and populate the transaction array.
  const transactions: HistoryTransaction[] = []

  const message = transactions.length > 0
    ? `Found ${transactions.length} transaction(s) for ${params.wallet.slice(0, 8)}...`
    : `No vault transactions found for ${params.wallet.slice(0, 8)}... ` +
      `${token ? `(filtered by ${token}) ` : ''}` +
      `Deposit first to start building transaction history.`

  return {
    action: 'history',
    wallet: params.wallet,
    token,
    status: 'success',
    transactions,
    total: transactions.length,
    hasMore: false,
    message,
  }
}
