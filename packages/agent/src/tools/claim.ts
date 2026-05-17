import type { AnthropicTool } from '../pi/tool-adapter.js'

// ─────────────────────────────────────────────────────────────────────────────
// Claim tool — Claim a received stealth payment
//
// NOTE: Claim uses sip_privacy program's claim_transfer instruction, not
// sipher_vault. The stealth private key derivation requires the full
// @sip-protocol/sdk ECDH flow. This is scaffolded for Phase 1 — the tool
// validates inputs, derives the stealth key concept, and returns the
// prepared shape. Phase 2 will wire to the real claim_transfer instruction.
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
        description: 'Your viewing private key (hex or base58)',
      },
      spendingKey: {
        type: 'string',
        description: 'Your spending private key (hex or base58). Used to derive the stealth key.',
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

  // Task 4 will replace this stub with the real SDK call.
  throw new Error('executeClaim Phase 2 not yet wired — Task 4 placeholder')
}
