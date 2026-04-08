import type Anthropic from '@anthropic-ai/sdk'
import { PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import {
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '@sip-protocol/sdk'
import {
  resolveTokenMint,
  getTokenDecimals,
  toBaseUnits,
  fromBaseUnits,
  getJupiterQuote,
  buildSwapTx,
} from '@sipher/sdk'
import type { JupiterQuote } from '@sipher/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// Swap tool — Private swap via Jupiter + optional stealth output routing
//
// Without wallet: returns a quote preview (no TX built).
// With wallet:    fetches Jupiter quote, optionally routes output to stealth
//                 ATA if recipient is a sip:solana:<spend>:<view> meta-address,
//                 builds swap TX, returns serialized TX for wallet signing.
// ─────────────────────────────────────────────────────────────────────────────

export interface SwapParams {
  amount: number
  fromToken: string
  toToken: string
  recipient?: string
  slippageBps?: number
  wallet?: string
}

export interface SwapToolResult {
  action: 'swap'
  amount: number
  fromToken: string
  toToken: string
  recipient: string | null
  slippageBps: number
  status: 'preview' | 'awaiting_signature'
  message: string
  /** Base64-serialized unsigned transaction (null for preview) */
  serializedTx: string | null
  quote: {
    estimatedOutput: string | null
    priceImpact: string | null
    route: string[] | null
  }
  privacy: {
    stealthRouted: boolean
    stealthAddress: string | null
  }
}

export const swapTool: Anthropic.Tool = {
  name: 'swap',
  description:
    'Execute a private swap: tokens are swapped via Jupiter and optionally routed to a stealth address. ' +
    'The output tokens are unlinkable to the input when a stealth meta-address recipient is provided. ' +
    'Without a wallet address, returns a quote preview only.',
  input_schema: {
    type: 'object' as const,
    properties: {
      amount: {
        type: 'number',
        description: 'Amount to swap (in human-readable units of fromToken)',
      },
      fromToken: {
        type: 'string',
        description: 'Token to swap from — SOL, USDC, USDT, or SPL mint address',
      },
      toToken: {
        type: 'string',
        description: 'Token to swap to — SOL, USDC, USDT, or SPL mint address',
      },
      recipient: {
        type: 'string',
        description: 'Optional stealth meta-address (sip:solana:<spend>:<view>) or pubkey for stealth output routing.',
      },
      slippageBps: {
        type: 'number',
        description: 'Slippage tolerance in basis points (default: 50 = 0.5%)',
      },
      wallet: {
        type: 'string',
        description: 'Sender wallet address (base58). Required to build the swap transaction.',
      },
    },
    required: ['amount', 'fromToken', 'toToken'],
  },
}

export async function executeSwap(params: SwapParams): Promise<SwapToolResult> {
  // ── Input validation ────────────────────────────────────────────────────
  if (params.amount <= 0) {
    throw new Error('Swap amount must be greater than zero')
  }

  if (!params.fromToken || params.fromToken.trim().length === 0) {
    throw new Error('Source token (fromToken) is required')
  }

  if (!params.toToken || params.toToken.trim().length === 0) {
    throw new Error('Destination token (toToken) is required')
  }

  const fromToken = params.fromToken.toUpperCase()
  const toToken = params.toToken.toUpperCase()

  if (fromToken === toToken) {
    throw new Error('Source and destination tokens must be different')
  }

  const slippageBps = Math.min(Math.max(params.slippageBps ?? 50, 1), 1000)

  // ── Resolve mints + compute base units ──────────────────────────────────
  const inputMint = resolveTokenMint(params.fromToken)
  const outputMint = resolveTokenMint(params.toToken)
  const inputDecimals = getTokenDecimals(inputMint)
  const outputDecimals = getTokenDecimals(outputMint)
  const amountBase = toBaseUnits(params.amount, inputDecimals)

  // ── Preview mode (no wallet) — return quote only ────────────────────────
  if (!params.wallet) {
    const quote = await getJupiterQuote(
      inputMint.toBase58(),
      outputMint.toBase58(),
      amountBase,
      slippageBps,
    )

    const routeLabels = extractRouteLabels(quote)
    const outputHuman = fromBaseUnits(BigInt(quote.outAmount), outputDecimals)

    return {
      action: 'swap',
      amount: params.amount,
      fromToken,
      toToken,
      recipient: params.recipient ?? null,
      slippageBps,
      status: 'preview',
      message:
        `Swap preview: ${params.amount} ${fromToken} -> ~${outputHuman} ${toToken}. ` +
        `Slippage: ${slippageBps / 100}%. ` +
        `Connect wallet to execute.`,
      serializedTx: null,
      quote: {
        estimatedOutput: outputHuman,
        priceImpact: quote.priceImpactPct,
        route: routeLabels,
      },
      privacy: {
        stealthRouted: false,
        stealthAddress: null,
      },
    }
  }

  // ── Full mode (wallet provided) — build executable TX ───────────────────
  let walletPubkey: PublicKey
  try {
    walletPubkey = new PublicKey(params.wallet)
  } catch {
    throw new Error(`Invalid wallet address: ${params.wallet}`)
  }

  // Fetch Jupiter quote
  const quote = await getJupiterQuote(
    inputMint.toBase58(),
    outputMint.toBase58(),
    amountBase,
    slippageBps,
  )

  const routeLabels = extractRouteLabels(quote)
  const outputHuman = fromBaseUnits(BigInt(quote.outAmount), outputDecimals)

  // Resolve stealth output routing if recipient is a meta-address
  let destinationAta: string | undefined
  let stealthRouted = false
  let stealthAddress: string | null = null

  if (params.recipient?.startsWith('sip:solana:')) {
    const parts = params.recipient.split(':')
    if (parts.length !== 4 || !parts[2] || !parts[3]) {
      throw new Error(
        `Invalid stealth meta-address: expected sip:solana:<spendingKey>:<viewingKey>, ` +
        `got ${params.recipient}`
      )
    }

    if (!parts[2].startsWith('0x') || !parts[3].startsWith('0x')) {
      throw new Error('Stealth meta-address keys must be 0x-prefixed hex strings')
    }

    const metaAddress = {
      spendingKey: parts[2] as `0x${string}`,
      viewingKey: parts[3] as `0x${string}`,
      chain: 'solana' as const,
    }

    // Generate a one-time stealth address for this swap's output
    const stealth = generateEd25519StealthAddress(metaAddress)
    const solanaAddress = ed25519PublicKeyToSolanaAddress(stealth.stealthAddress.address)
    const stealthPubkey = new PublicKey(solanaAddress)

    // Derive the stealth recipient's ATA for the output token
    const ata = await getAssociatedTokenAddress(outputMint, stealthPubkey)
    destinationAta = ata.toBase58()
    stealthRouted = true
    stealthAddress = stealthPubkey.toBase58()
  }

  // Build the swap transaction
  const swapResponse = await buildSwapTx(
    quote,
    walletPubkey.toBase58(),
    destinationAta,
  )

  return {
    action: 'swap',
    amount: params.amount,
    fromToken,
    toToken,
    recipient: params.recipient ?? null,
    slippageBps,
    status: 'awaiting_signature',
    message:
      `Private swap prepared: ${params.amount} ${fromToken} -> ~${outputHuman} ${toToken}. ` +
      `Slippage: ${slippageBps / 100}%. ` +
      (stealthRouted
        ? `Output routed to stealth address ${stealthAddress!.slice(0, 8)}...`
        : 'Awaiting wallet signature.'),
    serializedTx: swapResponse.swapTransaction,
    quote: {
      estimatedOutput: outputHuman,
      priceImpact: quote.priceImpactPct,
      route: routeLabels,
    },
    privacy: {
      stealthRouted,
      stealthAddress,
    },
  }
}

/**
 * Extract human-readable route labels from a Jupiter quote's route plan.
 */
function extractRouteLabels(quote: JupiterQuote): string[] {
  if (!quote.routePlan?.length) return []
  return quote.routePlan.map(
    (leg) => leg.swapInfo.label ?? leg.swapInfo.ammKey.slice(0, 8)
  )
}
