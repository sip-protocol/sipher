import type Anthropic from '@anthropic-ai/sdk'
import { PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import {
  createConnection,
  buildRefundTx,
  resolveTokenMint,
  getTokenDecimals,
  fromBaseUnits,
  SIPHER_VAULT_PROGRAM_ID,
} from '@sipher/sdk'

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
  /** Base64-serialized unsigned transaction (when wallet provided) */
  serializedTx: string | null
  details: {
    refundAmount: string | null
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

  // No wallet — return prepared shape, UI will re-invoke once wallet connects
  if (!params.wallet) {
    return {
      action: 'refund',
      token,
      wallet: null,
      status: 'awaiting_signature',
      message:
        `Refund prepared: all available ${token} balance returning to your wallet. ` +
        `Connect wallet to sign.`,
      serializedTx: null,
      details: {
        refundAmount: null,
        refundTimeout: '24 hours after last deposit',
        note: 'Locked amounts from pending sends are excluded. Your funds are safe.',
      },
    }
  }

  const tokenMint = resolveTokenMint(params.token)
  const decimals = getTokenDecimals(tokenMint)

  let depositor: PublicKey
  try {
    depositor = new PublicKey(params.wallet)
  } catch {
    throw new Error(`Invalid wallet address: ${params.wallet}`)
  }

  const depositorTokenAccount = await getAssociatedTokenAddress(tokenMint, depositor)
  const network = (process.env.SOLANA_NETWORK ?? 'mainnet-beta') as 'devnet' | 'mainnet-beta'
  const connection = createConnection(network)

  const result = await buildRefundTx(
    connection,
    depositor,
    tokenMint,
    depositorTokenAccount
  )

  const refundHuman = fromBaseUnits(result.refundAmount, decimals)

  const serializedTx = result.transaction
    .serialize({ requireAllSignatures: false })
    .toString('base64')

  return {
    action: 'refund',
    token,
    wallet: params.wallet,
    status: 'awaiting_signature',
    message:
      `Refund prepared: ${refundHuman} ${token} returning to your wallet. ` +
      `Awaiting wallet signature.`,
    serializedTx,
    details: {
      refundAmount: refundHuman,
      refundTimeout: '24 hours after last deposit',
      note: 'Locked amounts from pending sends are excluded. Your funds are safe.',
    },
  }
}
