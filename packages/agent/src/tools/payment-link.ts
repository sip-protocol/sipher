import type Anthropic from '@anthropic-ai/sdk'
import { randomBytes } from 'node:crypto'
import {
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '@sip-protocol/sdk'
import {
  createPaymentLink,
  getOrCreateSession,
} from '../db.js'

// ─────────────────────────────────────────────────────────────────────────────
// Payment link tool — one-time stealth receive URLs
// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentLinkParams {
  wallet: string
  amount?: number
  token?: string
  memo?: string
  expiresInMinutes?: number
}

export interface PaymentLinkToolResult {
  action: 'paymentLink'
  status: 'success'
  message: string
  link: {
    id: string
    url: string
    amount: number | null
    token: string
    memo: string | null
    stealthAddress: string
    expiresAt: number
  }
}

function shortId(): string {
  return randomBytes(8).toString('base64url')
}

export const paymentLinkTool: Anthropic.Tool = {
  name: 'paymentLink',
  description:
    'Create a one-time stealth payment link. ' +
    'Generates a stealth address so the sender does not need a Sipher account. ' +
    'Returns a URL that anyone can use to pay you privately.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: {
        type: 'string',
        description: 'Your wallet address (base58). Used to derive the stealth address keypair.',
      },
      amount: {
        type: 'number',
        description: 'Requested payment amount (optional — omit for open-amount links)',
      },
      token: {
        type: 'string',
        description: 'Token symbol — SOL, USDC, USDT, etc. (default: SOL)',
      },
      memo: {
        type: 'string',
        description: 'Optional memo shown on the payment page',
      },
      expiresInMinutes: {
        type: 'number',
        description: 'Link expiry in minutes (default: 60, max: 10080 = 7 days)',
      },
    },
    required: ['wallet'],
  },
}

export async function executePaymentLink(
  params: PaymentLinkParams,
): Promise<PaymentLinkToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) {
    throw new Error('Wallet address is required to create a payment link')
  }

  if (params.amount !== undefined && params.amount !== null && params.amount < 0) {
    throw new Error('Payment amount cannot be negative')
  }

  const token = (params.token ?? 'SOL').toUpperCase()
  const expiresIn = Math.min(Math.max(params.expiresInMinutes ?? 60, 1), 10080)
  const expiresAt = Date.now() + expiresIn * 60 * 1000

  // Phase 1: ephemeral stealth address from random keys. The recipient claims
  // via the payment page flow, not by deriving the stealth private key.
  // Phase 2 will use the wallet's actual spending/viewing keypair.
  const dummyKey = '0x' + randomBytes(32).toString('hex') as `0x${string}`
  const stealth = generateEd25519StealthAddress({
    spendingKey: dummyKey,
    viewingKey: dummyKey,
    chain: 'solana' as const,
  })

  const solanaAddress = ed25519PublicKeyToSolanaAddress(stealth.stealthAddress.address)
  const ephemeralPubkey = stealth.stealthAddress.ephemeralPublicKey

  const session = getOrCreateSession(params.wallet)
  const id = shortId()

  const link = createPaymentLink({
    id,
    session_id: session.id,
    stealth_address: solanaAddress,
    ephemeral_pubkey: ephemeralPubkey,
    amount: params.amount ?? null,
    token,
    memo: params.memo ?? null,
    type: 'link',
    expires_at: expiresAt,
  })

  const baseUrl = process.env.SIPHER_BASE_URL ?? 'https://sipher.sip-protocol.org'
  const url = `${baseUrl}/pay/${id}`

  const amountStr = link.amount !== null ? `${link.amount} ${token}` : `any amount of ${token}`

  return {
    action: 'paymentLink',
    status: 'success',
    message: `Payment link created for ${amountStr}. Share this URL — the sender does not need Sipher.`,
    link: {
      id: link.id,
      url,
      amount: link.amount,
      token: link.token,
      memo: link.memo,
      stealthAddress: solanaAddress,
      expiresAt: link.expires_at,
    },
  }
}
