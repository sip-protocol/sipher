import type Anthropic from '@anthropic-ai/sdk'
import { PublicKey } from '@solana/web3.js'
import {
  createConnection,
  getVaultHistory,
  resolveTokenMint,
} from '@sipher/sdk'
import type { VaultEvent } from '@sipher/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// History tool — Transaction history from on-chain vault events
//
// Queries the sipher_vault program's transaction logs, parses Anchor events,
// and returns wallet-filtered vault activity (deposits, sends, refunds).
// ─────────────────────────────────────────────────────────────────────────────

export interface HistoryParams {
  wallet: string
  token?: string
  limit?: number
}

export interface HistoryTransaction {
  txSignature: string
  type: 'deposit' | 'send' | 'refund'
  amount: string
  token: string
  tokenMint: string
  timestamp: number
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
    'Shows deposits, private sends, and refunds parsed from on-chain event logs. ' +
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

  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100)
  const token = params.token?.toUpperCase() ?? null

  // Resolve token filter to mint address if provided
  let tokenMint: string | undefined
  if (token) {
    try {
      tokenMint = resolveTokenMint(token).toBase58()
    } catch {
      // If resolution fails, treat as raw mint address passthrough
      tokenMint = params.token?.trim()
    }
  }

  // Query on-chain events
  const connection = createConnection('devnet')
  const { events, hasMore } = await getVaultHistory(
    connection,
    params.wallet,
    { limit, tokenMint }
  )

  // Map VaultEvent → HistoryTransaction
  const transactions: HistoryTransaction[] = events.map((e: VaultEvent) => ({
    txSignature: e.txSignature,
    type: e.type,
    amount: e.amount,
    token: e.token,
    tokenMint: e.tokenMint,
    timestamp: e.timestamp,
  }))

  const message = transactions.length > 0
    ? `Found ${transactions.length} transaction(s) for ${params.wallet.slice(0, 8)}...` +
      (token ? ` (filtered by ${token})` : '') +
      (hasMore ? '. More transactions available — increase limit or paginate.' : '')
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
    hasMore,
    message,
  }
}
