import { PublicKey } from '@solana/web3.js'
import { claimStealthPayment, type SolanaClaimResult } from '@sip-protocol/sdk'
import { createConnection } from '@sipher/sdk'
import { loadNetworkConfig } from '../config/network.js'
import {
  resolveStealthContext,
  StealthContextError,
  deriveDestinationFromSpending,
  formatClaimAmount,
} from './claim-helpers.js'
import { normalizeKey } from '../utils/key-normalize.js'
import type { AnthropicTool } from '../pi/tool-adapter.js'

// ─────────────────────────────────────────────────────────────────────────────
// Claim tool — Claim a received stealth payment
//
// Delegates ECDH derivation + SPL transfer + broadcast to @sip-protocol/sdk's
// claimStealthPayment. Stealth context (stealth address, ephemeral pubkey,
// mint) is resolved from the deposit tx via resolveStealthContext (helper).
// Returns the claim tx signature for honest Torque attribution.
// ─────────────────────────────────────────────────────────────────────────────

export interface ClaimParams {
  txSignature: string
  viewingKey: string
  spendingKey: string
  /** Optional destination wallet (base58). Defaults to the spending pubkey. */
  destinationWallet?: string
  /**
   * Optional SPL token mint (base58). If omitted, the mint is resolved from
   * the deposit transaction. Provide explicitly when you already know it
   * (e.g. from a prior scan result) to skip the on-chain lookup.
   */
  mint?: string
}

export interface ClaimToolResult {
  action: 'claim'
  status: 'confirmed'
  /** The input deposit-tx signature (for traceability). */
  depositTxSignature: string
  /** The CLAIM tx signature — growth-hook reads this as the Torque attribution key. */
  signature: string
  /** Base58 destination wallet that received the funds. */
  destinationWallet: string
  /** Claimed amount in the token's smallest unit, stringified to avoid BigInt JSON issues. */
  amount: string
  /** Base58 SPL token mint. */
  mint: string
  /** Explorer URL for the claim transaction. */
  explorerUrl: string
  /** Human-readable summary for the chat UX. */
  message: string
}

export const claimTool: AnthropicTool = {
  name: 'claim',
  description:
    'Claim a received stealth payment found by the scan tool. ' +
    'Derives the stealth private key from your viewing+spending keys, ' +
    'transfers the tokens to your destination wallet, and returns the claim tx signature.',
  input_schema: {
    type: 'object' as const,
    properties: {
      txSignature: {
        type: 'string',
        description: 'Transaction signature of the stealth payment to claim (from scan results)',
      },
      viewingKey: {
        type: 'string',
        description: 'Your viewing private key (hex, with or without 0x prefix)',
      },
      spendingKey: {
        type: 'string',
        description: 'Your spending private key (hex, with or without 0x prefix). Used to derive the stealth key.',
      },
      destinationWallet: {
        type: 'string',
        description: 'Wallet address (base58) to receive claimed tokens. Defaults to the spending pubkey.',
      },
      mint: {
        type: 'string',
        description:
          'Optional SPL token mint (base58). If omitted, the mint is resolved from the deposit transaction.',
      },
    },
    required: ['txSignature', 'viewingKey', 'spendingKey'],
  },
}

export async function executeClaim(params: ClaimParams): Promise<ClaimToolResult> {
  if (!params.txSignature || params.txSignature.trim().length === 0) {
    throw new Error('Transaction signature is required')
  }
  if (!params.viewingKey || params.viewingKey.trim().length === 0) {
    throw new Error('Viewing key is required to derive stealth key')
  }
  if (!params.spendingKey || params.spendingKey.trim().length === 0) {
    throw new Error('Spending key is required to derive stealth key')
  }

  const network = loadNetworkConfig().clusterName
  const connection = createConnection(network)

  let ctx
  try {
    ctx = await resolveStealthContext(connection, params.txSignature)
  } catch (err) {
    if (err instanceof StealthContextError) {
      throw new Error(`Cannot resolve stealth payment: ${err.message}`)
    }
    throw err
  }

  const mintBase58 = params.mint ?? ctx.mint
  if (!mintBase58) {
    throw new Error('Internal: resolveStealthContext returned no mint and no override was provided')
  }
  const destinationAddress = params.destinationWallet ?? deriveDestinationFromSpending(params.spendingKey)
  const viewingPrivateKey = normalizeKey(params.viewingKey)
  const spendingPrivateKey = normalizeKey(params.spendingKey)

  let sdkResult: SolanaClaimResult
  try {
    sdkResult = await claimStealthPayment({
      connection,
      stealthAddress: ctx.stealthAddress,
      ephemeralPublicKey: ctx.ephemeralPublicKey,
      viewingPrivateKey,
      spendingPrivateKey,
      destinationAddress,
      mint: new PublicKey(mintBase58),
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`Claim broadcast failed: ${detail}`)
  }

  return {
    action: 'claim',
    status: 'confirmed',
    depositTxSignature: params.txSignature,
    signature: sdkResult.txSignature,
    destinationWallet: sdkResult.destinationAddress,
    amount: sdkResult.amount.toString(),
    mint: mintBase58,
    explorerUrl: sdkResult.explorerUrl,
    message:
      `Claimed payment ${params.txSignature.slice(0, 12)}... → claim tx ${sdkResult.txSignature.slice(0, 12)}... ` +
      `(${formatClaimAmount(sdkResult.amount, mintBase58)} to ${sdkResult.destinationAddress.slice(0, 8)}...)`,
  }
}
