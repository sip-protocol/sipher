import { keccak_256 } from '@noble/hashes/sha3'
import { bytesToHex } from '@noble/hashes/utils'
import { LRUCache } from 'lru-cache'

// ─── Constants ──────────────────────────────────────────────────────────────

const JUPITER_BASE_URL = process.env.JUPITER_API_URL ?? 'https://lite-api.jup.ag'

export const SUPPORTED_TOKENS: Record<string, { symbol: string; name: string; decimals: number }> = {
  So11111111111111111111111111111111111111112: { symbol: 'SOL', name: 'Wrapped SOL', decimals: 9 },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: { symbol: 'mSOL', name: 'Marinade Staked SOL', decimals: 9 },
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: { symbol: 'JitoSOL', name: 'Jito Staked SOL', decimals: 9 },
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface QuoteParams {
  inputMint: string
  outputMint: string
  amount: string       // lamports / smallest unit
  slippageBps?: number // default 50 (0.5%)
}

export interface QuoteEntry {
  quoteId: string
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  outAmountMin: string
  priceImpactPct: string
  slippageBps: number
  expiresAt: number
}

export interface SwapTransactionParams {
  quoteId: string
  userPublicKey: string
  destinationAddress: string
}

export interface SwapTransactionResult {
  swapTransaction: string // base64
  quoteId: string
  computeUnitPrice: number
  priorityFee: number
}

// ─── Cache ──────────────────────────────────────────────────────────────────

interface CachedQuote {
  entry: QuoteEntry
  rawResponse: Record<string, unknown> // Full Jupiter API response for swap building
}

const quoteCache = new LRUCache<string, CachedQuote>({
  max: 1000,
  ttl: 30 * 1000, // 30s — quotes expire fast
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateQuoteId(inputMint: string, outputMint: string, amount: string): string {
  const payload = new TextEncoder().encode(inputMint + outputMint + amount + Date.now().toString())
  const hash = keccak_256(payload)
  return 'jup_' + bytesToHex(hash)
}

// ─── Get Quote ──────────────────────────────────────────────────────────────

export async function getQuote(params: QuoteParams): Promise<QuoteEntry> {
  const { inputMint, outputMint, amount, slippageBps = 50 } = params

  if (inputMint === outputMint) {
    const err = new Error('Input and output mints must be different')
    err.name = 'JupiterQuoteError'
    throw err
  }

  const url = new URL(`${JUPITER_BASE_URL}/swap/v1/quote`)
  url.searchParams.set('inputMint', inputMint)
  url.searchParams.set('outputMint', outputMint)
  url.searchParams.set('amount', amount)
  url.searchParams.set('slippageBps', String(slippageBps))

  let response: Response
  try {
    response = await fetch(url.toString())
  } catch (fetchErr) {
    const err = new Error(`Jupiter API request failed: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`)
    err.name = 'JupiterQuoteError'
    throw err
  }

  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json() as Record<string, unknown>
      detail = typeof body.error === 'string' ? body.error : JSON.stringify(body)
    } catch {
      detail = `HTTP ${response.status}`
    }
    const err = new Error(`Jupiter quote failed: ${detail}`)
    err.name = 'JupiterQuoteError'
    throw err
  }

  const data = await response.json() as Record<string, unknown>

  const quoteId = generateQuoteId(inputMint, outputMint, amount)
  const now = Date.now()

  const entry: QuoteEntry = {
    quoteId,
    inputMint: String(data.inputMint),
    outputMint: String(data.outputMint),
    inAmount: String(data.inAmount),
    outAmount: String(data.outAmount),
    outAmountMin: String(data.otherAmountThreshold),
    priceImpactPct: String(data.priceImpactPct ?? '0'),
    slippageBps: Number(data.slippageBps ?? slippageBps),
    expiresAt: now + 30_000,
  }

  quoteCache.set(quoteId, { entry, rawResponse: data })
  return entry
}

// ─── Build Swap Transaction ─────────────────────────────────────────────────

export async function buildSwapTransaction(params: SwapTransactionParams): Promise<SwapTransactionResult> {
  const { quoteId, userPublicKey, destinationAddress } = params

  const cached = quoteCache.get(quoteId)
  if (!cached) {
    const err = new Error(`Quote not found or expired: ${quoteId}`)
    err.name = 'JupiterSwapError'
    throw err
  }

  let response: Response
  try {
    response = await fetch(`${JUPITER_BASE_URL}/swap/v1/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: cached.rawResponse,
        userPublicKey,
        destinationTokenAccount: destinationAddress,
      }),
    })
  } catch (fetchErr) {
    const err = new Error(`Jupiter swap API request failed: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`)
    err.name = 'JupiterSwapError'
    throw err
  }

  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json() as Record<string, unknown>
      detail = typeof body.error === 'string' ? body.error : JSON.stringify(body)
    } catch {
      detail = `HTTP ${response.status}`
    }
    const err = new Error(`Jupiter swap transaction failed: ${detail}`)
    err.name = 'JupiterSwapError'
    throw err
  }

  const data = await response.json() as Record<string, unknown>

  return {
    swapTransaction: String(data.swapTransaction),
    quoteId,
    computeUnitPrice: 0, // Jupiter handles compute unit pricing
    priorityFee: Number(data.prioritizationFeeLamports ?? 0),
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

/** Token label lookup (informational — Jupiter supports all SPL tokens). */
export function getSupportedTokens(): typeof SUPPORTED_TOKENS {
  return SUPPORTED_TOKENS
}

export function resetJupiterProvider(): void {
  quoteCache.clear()
}
