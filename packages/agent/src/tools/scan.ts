import type Anthropic from '@anthropic-ai/sdk'
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
  spendingPubkey: string
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

export const scanTool: Anthropic.Tool = {
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
      spendingPubkey: {
        type: 'string',
        description: 'Your spending public key (base58). Used to match stealth addresses.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of transactions to scan (default: 100, max: 1000)',
      },
    },
    required: ['viewingKey', 'spendingPubkey'],
  },
}

export async function executeScan(params: ScanParams): Promise<ScanToolResult> {
  if (!params.viewingKey || params.viewingKey.trim().length === 0) {
    throw new Error('Viewing key is required to scan for payments')
  }

  if (!params.spendingPubkey || params.spendingPubkey.trim().length === 0) {
    throw new Error('Spending public key is required')
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

  // Convert spending pubkey to bytes (base58 pubkey -> 32 bytes)
  let spendingPublicKey: Uint8Array
  try {
    const { PublicKey } = await import('@solana/web3.js')
    spendingPublicKey = new PublicKey(params.spendingPubkey).toBytes()
  } catch {
    throw new Error('Invalid spending public key — expected base58')
  }

  const connection = createConnection('devnet')

  const result = await scanForPayments({
    connection,
    viewingPrivateKey,
    spendingPublicKey,
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
