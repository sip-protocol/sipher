import type { AnthropicTool } from '../pi/tool-adapter.js'
import {
  createConnection,
  scanForPayments,
  fromBaseUnits,
} from '@sipher/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// Scan tool — Scan for incoming stealth payments
// ─────────────────────────────────────────────────────────────────────────────

export interface ScanParams {
  viewingKey: string
  spendingKey: string
  limit?: number
}

export interface ScanToolResult {
  action: 'scan'
  status: 'success'
  payments: ScanPaymentSummary[]
  eventsScanned: number
  hasMore: boolean
  message: string
}

interface ScanPaymentSummary {
  txSignature: string
  stealthAddress: string
  amount: string
  fee: string
  timestamp: number
}

export const scanTool: AnthropicTool = {
  name: 'scan',
  description:
    'Scan the vault program for incoming stealth payments addressed to you. ' +
    'Uses your viewing key to check each VaultWithdrawEvent. ' +
    'Matching payments can then be claimed with the claim tool.',
  input_schema: {
    type: 'object' as const,
    properties: {
      viewingKey: {
        type: 'string',
        description: 'Your viewing private key (hex or base58). Used to detect payments addressed to you.',
      },
      spendingKey: {
        type: 'string',
        description: 'Your spending private key (hex). Used with viewing key to verify stealth address ownership.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of transactions to scan (default: 100, max: 1000)',
      },
    },
    required: ['viewingKey', 'spendingKey'],
  },
}

export async function executeScan(params: ScanParams): Promise<ScanToolResult> {
  if (!params.viewingKey || params.viewingKey.trim().length === 0) {
    throw new Error('Viewing key is required to scan for payments')
  }

  if (!params.spendingKey || params.spendingKey.trim().length === 0) {
    throw new Error('Spending private key is required')
  }

  const limit = Math.min(Math.max(params.limit ?? 100, 1), 1000)

  // Convert viewing key string to bytes (hex-encoded)
  let viewingPrivateKey: Uint8Array
  try {
    const hex = params.viewingKey.replace(/^0x/, '')
    viewingPrivateKey = new Uint8Array(
      hex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? []
    )
  } catch {
    throw new Error('Invalid viewing key format — expected hex string')
  }

  if (viewingPrivateKey.length !== 32) {
    throw new Error(`Viewing key must be 32 bytes (64 hex chars), got ${viewingPrivateKey.length} bytes`)
  }

  // Convert spending private key to bytes (hex-encoded)
  let spendingPrivateKey: Uint8Array
  try {
    const hex = params.spendingKey.replace(/^0x/, '')
    spendingPrivateKey = new Uint8Array(
      hex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? []
    )
  } catch {
    throw new Error('Invalid spending key format — expected hex string')
  }

  if (spendingPrivateKey.length !== 32) {
    throw new Error(`Spending key must be 32 bytes (64 hex chars), got ${spendingPrivateKey.length} bytes`)
  }

  const network = (process.env.SOLANA_NETWORK ?? 'mainnet-beta') as 'devnet' | 'mainnet-beta'
  const connection = createConnection(network)

  const result = await scanForPayments({
    connection,
    viewingPrivateKey,
    spendingPrivateKey,
    limit,
  })

  // Default to 9 decimals (SOL) for display — in production, resolve per-token
  const decimals = 9

  const payments: ScanPaymentSummary[] = result.payments.map((p) => ({
    txSignature: p.txSignature,
    stealthAddress: p.stealthAddress.toBase58(),
    amount: fromBaseUnits(p.transferAmount, decimals),
    fee: fromBaseUnits(p.feeAmount, decimals),
    timestamp: p.timestamp,
  }))

  const message = payments.length > 0
    ? `Found ${payments.length} payment(s) across ${result.eventsScanned} transactions.`
    : `Scanned ${limit} recent transactions — no payments found for this keypair. ` +
      `This is normal if no one has sent you a private payment yet.`

  return {
    action: 'scan',
    status: 'success',
    payments,
    eventsScanned: result.eventsScanned,
    hasMore: result.hasMore,
    message,
  }
}
