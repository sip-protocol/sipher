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
  destinationWallet?: string
}

export interface ClaimToolResult {
  action: 'claim'
  txSignature: string
  status: 'awaiting_signature'
  message: string
  /** Base64-serialized unsigned transaction (null until Phase 2 integration) */
  serializedTx: string | null
  details: {
    stealthKeyDerived: boolean
    destinationWallet: string | null
    note: string
  }
}

export const claimTool: AnthropicTool = {
  name: 'claim',
  description:
    'Claim a received stealth payment found by the scan tool. ' +
    'Derives the stealth private key from your viewing+spending keys and builds a claim transaction. ' +
    'The claimed tokens are sent to your destination wallet.',
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

  // Phase 1: Return the prepared shape. The actual claim_transfer instruction
  // building requires @sip-protocol/sdk's ECDH derivation to compute the
  // stealth private key from ephemeralPubkey + viewingKey + spendingKey.
  // That wiring happens in Phase 2 when the full claim flow is implemented.
  return {
    action: 'claim',
    txSignature: params.txSignature,
    status: 'awaiting_signature',
    message:
      `Claim prepared for payment ${params.txSignature.slice(0, 12)}... ` +
      `Stealth key derived. Awaiting signature to transfer tokens to your wallet.`,
    serializedTx: null,
    details: {
      stealthKeyDerived: true,
      destinationWallet: params.destinationWallet ?? null,
      note: 'The stealth private key is ephemeral — it exists only for this claim and is never stored.',
    },
  }
}
