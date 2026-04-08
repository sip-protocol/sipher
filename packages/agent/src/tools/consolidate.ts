import type Anthropic from '@anthropic-ai/sdk'
import { createScheduledOp, getOrCreateSession } from '../db.js'
import { createConnection, scanForPayments } from '@sipher/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// consolidate tool — Merge multiple unclaimed stealth balances with staggered
// claim timing to prevent clustering analysis from simultaneous claims.
// ─────────────────────────────────────────────────────────────────────────────

export interface ConsolidateParams {
  wallet: string
  viewingKey: string
  spendingKey: string
  walletSignature: string
}

export interface ClaimInfo {
  opId: string
  txSignature: string
  stealthAddress: string
  executesAt: number
}

export interface ConsolidateToolResult {
  action: 'consolidate'
  status: 'success'
  message: string
  claims: ClaimInfo[]
  paymentsFound: number
}

export const consolidateTool: Anthropic.Tool = {
  name: 'consolidate',
  description:
    'Merge multiple unclaimed stealth balances with staggered claim timing. ' +
    'Scans for unclaimed payments and schedules claims with random 1-4h delays between each. ' +
    'Prevents clustering analysis from simultaneous claims.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: { type: 'string', description: 'Your wallet address (base58)' },
      viewingKey: { type: 'string', description: 'Your viewing private key (hex)' },
      spendingKey: { type: 'string', description: 'Your spending private key (hex)' },
      walletSignature: { type: 'string', description: 'Wallet signature authorizing claims' },
    },
    required: ['wallet', 'viewingKey', 'spendingKey'],
  },
}

export async function executeConsolidate(
  params: ConsolidateParams,
): Promise<ConsolidateToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) {
    throw new Error('Wallet address is required')
  }
  if (!params.viewingKey || params.viewingKey.trim().length === 0) {
    throw new Error('Viewing key is required for scanning')
  }
  if (!params.spendingKey || params.spendingKey.trim().length === 0) {
    throw new Error('Spending key is required for claiming')
  }

  const network = (process.env.SOLANA_NETWORK ?? 'devnet') as 'devnet' | 'mainnet-beta'
  const connection = createConnection(network)

  // Parse hex keys → Uint8Array (strip optional 0x prefix)
  const vkHex = params.viewingKey.replace(/^0x/, '')
  const viewingPrivateKey = new Uint8Array(
    vkHex.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) ?? [],
  )
  const skHex = params.spendingKey.replace(/^0x/, '')
  const spendingPrivateKey = new Uint8Array(
    skHex.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) ?? [],
  )

  const scanResult = await scanForPayments({
    connection, viewingPrivateKey, spendingPrivateKey, limit: 200,
  })

  if (scanResult.payments.length === 0) {
    return {
      action: 'consolidate',
      status: 'success',
      message: 'No unclaimed payments found to consolidate.',
      claims: [],
      paymentsFound: 0,
    }
  }

  const session = getOrCreateSession(params.wallet)
  const now = Date.now()
  const claims: ClaimInfo[] = []

  for (let i = 0; i < scanResult.payments.length; i++) {
    const payment = scanResult.payments[i]

    // Stagger: 1-4 hours of cumulative gap between each claim
    const minGap = 1 * 3600_000
    const maxGap = 4 * 3600_000
    const cumulativeDelay = i * (minGap + Math.random() * (maxGap - minGap))
    const executesAt = now + Math.max(60_000, cumulativeDelay)

    const op = createScheduledOp({
      session_id: session.id,
      action: 'claim',
      params: {
        wallet: params.wallet,
        txSignature: payment.txSignature,
        stealthAddress: payment.stealthAddress.toBase58(),
        viewingKey: params.viewingKey,
        spendingKey: params.spendingKey,
      },
      wallet_signature: params.walletSignature ?? 'pending',
      next_exec: executesAt,
      expires_at: executesAt + 24 * 3600_000,
      max_exec: 1,
    })

    claims.push({
      opId: op.id,
      txSignature: payment.txSignature,
      stealthAddress: payment.stealthAddress.toBase58(),
      executesAt,
    })
  }

  claims.sort((a, b) => a.executesAt - b.executesAt)

  return {
    action: 'consolidate',
    status: 'success',
    message: `Found ${scanResult.payments.length} unclaimed payments. Scheduling staggered claims over ~${Math.round(claims.length * 2.5)}h.`,
    claims,
    paymentsFound: scanResult.payments.length,
  }
}
