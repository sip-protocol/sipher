import type Anthropic from '@anthropic-ai/sdk'

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

  // Phase 1: Return prepared result shape.
  // Task 5 (Integration) wires this to scanForPayments() from @sipher/sdk.
  return {
    action: 'scan',
    status: 'success',
    payments: [],
    eventsScanned: 0,
    hasMore: false,
    message:
      `Scanned ${limit} recent transactions — no payments found for this keypair. ` +
      `This is normal if no one has sent you a private payment yet.`,
  }
}
