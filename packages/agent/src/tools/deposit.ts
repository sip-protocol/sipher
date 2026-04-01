import type Anthropic from '@anthropic-ai/sdk'
import { PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import {
  createConnection,
  buildDepositTx,
  resolveTokenMint,
  getTokenDecimals,
  toBaseUnits,
  SIPHER_VAULT_PROGRAM_ID,
} from '@sipher/sdk'

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
  /** Base64-serialized unsigned transaction (when wallet provided) */
  serializedTx: string | null
  details: {
    vaultProgram: string
    depositRecordAddress: string | null
    vaultTokenAddress: string | null
    amountBaseUnits: string | null
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

  // If no wallet provided, return a prepared result without building the tx.
  // The UI will re-invoke once the wallet connects.
  if (!params.wallet) {
    return {
      action: 'deposit',
      amount: params.amount,
      token,
      wallet: null,
      status: 'awaiting_signature',
      message: `Deposit prepared: ${params.amount} ${token} into vault. Connect wallet to sign.`,
      serializedTx: null,
      details: {
        vaultProgram: SIPHER_VAULT_PROGRAM_ID.toBase58(),
        depositRecordAddress: null,
        vaultTokenAddress: null,
        amountBaseUnits: null,
        estimatedFee: '~5000 lamports (tx fee)',
        note: 'Funds enter the shared anonymity pool. Refundable after 24h cooldown.',
      },
    }
  }

  // Build the real transaction
  const tokenMint = resolveTokenMint(params.token)
  const decimals = getTokenDecimals(tokenMint)
  const amountBase = toBaseUnits(params.amount, decimals)

  let depositor: PublicKey
  try {
    depositor = new PublicKey(params.wallet)
  } catch {
    throw new Error(`Invalid wallet address: ${params.wallet}`)
  }

  const depositorTokenAccount = await getAssociatedTokenAddress(tokenMint, depositor)
  const connection = createConnection('devnet')

  const result = await buildDepositTx(
    connection,
    depositor,
    tokenMint,
    depositorTokenAccount,
    amountBase
  )

  // Serialize the unsigned transaction as base64 for the UI to sign
  const serializedTx = result.transaction
    .serialize({ requireAllSignatures: false })
    .toString('base64')

  return {
    action: 'deposit',
    amount: params.amount,
    token,
    wallet: params.wallet,
    status: 'awaiting_signature',
    message: `Deposit prepared: ${params.amount} ${token} into vault. Awaiting wallet signature.`,
    serializedTx,
    details: {
      vaultProgram: SIPHER_VAULT_PROGRAM_ID.toBase58(),
      depositRecordAddress: result.depositRecordAddress.toBase58(),
      vaultTokenAddress: result.vaultTokenAddress.toBase58(),
      amountBaseUnits: amountBase.toString(),
      estimatedFee: '~5000 lamports (tx fee)',
      note: 'Funds enter the shared anonymity pool. Refundable after 24h cooldown.',
    },
  }
}
