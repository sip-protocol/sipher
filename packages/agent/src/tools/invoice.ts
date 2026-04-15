import type { AnthropicTool } from '../pi/tool-adapter.js'
import { randomBytes } from 'node:crypto'
import {
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '@sip-protocol/sdk'
import { createPaymentLink, getOrCreateSession } from '../db.js'

export interface InvoiceParams {
  wallet: string
  amount: number
  token?: string
  description?: string
  dueDate?: string
  reference?: string
  expiresInMinutes?: number
}

export interface InvoiceToolResult {
  action: 'invoice'
  status: 'success'
  message: string
  invoice: {
    id: string
    url: string
    amount: number
    token: string
    description: string | null
    dueDate: string | null
    reference: string | null
    stealthAddress: string
    expiresAt: number
  }
}

function shortId(): string {
  return randomBytes(8).toString('base64url')
}

export const invoiceTool: AnthropicTool = {
  name: 'invoice',
  description:
    'Create a structured payment invoice with description, due date, and reference number. ' +
    'Like a payment link but with formal invoice metadata. ' +
    'A viewing key is auto-generated for the invoice transaction.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: {
        type: 'string',
        description: 'Your wallet address (base58)',
      },
      amount: {
        type: 'number',
        description: 'Invoice amount (required — invoices must have a specific amount)',
      },
      token: {
        type: 'string',
        description: 'Token symbol — SOL, USDC, etc. (default: SOL)',
      },
      description: {
        type: 'string',
        description: 'Invoice description (e.g. "Consulting services — March 2026")',
      },
      dueDate: {
        type: 'string',
        description: 'Due date in YYYY-MM-DD format (optional)',
      },
      reference: {
        type: 'string',
        description: 'Invoice reference number (e.g. INV-2026-042)',
      },
      expiresInMinutes: {
        type: 'number',
        description: 'Invoice expiry in minutes (default: 10080 = 7 days)',
      },
    },
    required: ['wallet', 'amount'],
  },
}

export async function executeInvoice(
  params: InvoiceParams,
): Promise<InvoiceToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) {
    throw new Error('Wallet address is required to create an invoice')
  }

  if (!params.amount || params.amount <= 0) {
    throw new Error('Invoice amount must be greater than zero')
  }

  const token = (params.token ?? 'SOL').toUpperCase()
  const expiresIn = Math.min(Math.max(params.expiresInMinutes ?? 10080, 1), 43200)
  const expiresAt = Date.now() + expiresIn * 60 * 1000

  // Phase 1: ephemeral stealth address from random keys (same as paymentLink).
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

  const invoiceMeta = {
    description: params.description ?? null,
    dueDate: params.dueDate ?? null,
    reference: params.reference ?? null,
  }

  createPaymentLink({
    id,
    session_id: session.id,
    stealth_address: solanaAddress,
    ephemeral_pubkey: ephemeralPubkey,
    amount: params.amount,
    token,
    memo: params.description ?? null,
    type: 'invoice',
    invoice_meta: invoiceMeta,
    expires_at: expiresAt,
  })

  const baseUrl = process.env.SIPHER_BASE_URL ?? 'https://sipher.sip-protocol.org'
  const url = `${baseUrl}/pay/${id}`

  return {
    action: 'invoice',
    status: 'success',
    message: `Invoice created for ${params.amount} ${token}. ${params.reference ? `Ref: ${params.reference}. ` : ''}Share the URL to request payment.`,
    invoice: {
      id,
      url,
      amount: params.amount,
      token,
      description: params.description ?? null,
      dueDate: params.dueDate ?? null,
      reference: params.reference ?? null,
      stealthAddress: solanaAddress,
      expiresAt,
    },
  }
}
