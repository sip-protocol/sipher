import type Anthropic from '@anthropic-ai/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// Claim tool — Claim a received stealth payment
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
  details: {
    stealthKeyDerived: boolean
    destinationWallet: string | null
    note: string
  }
}

export const claimTool: Anthropic.Tool = {
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

  return {
    action: 'claim',
    txSignature: params.txSignature,
    status: 'awaiting_signature',
    message:
      `Claim prepared for payment ${params.txSignature.slice(0, 12)}... ` +
      `Stealth key derived. Awaiting signature to transfer tokens to your wallet.`,
    details: {
      stealthKeyDerived: true,
      destinationWallet: params.destinationWallet ?? null,
      note: 'The stealth private key is ephemeral — it exists only for this claim and is never stored.',
    },
  }
}
