// ─────────────────────────────────────────────────────────────────────────────
// Jupiter quote fetcher + transaction builder
//
// Uses the free lite-api (v1) endpoint for quotes and swap TX building.
// The paid api.jup.ag endpoint requires a portal.jup.ag API key.
// ─────────────────────────────────────────────────────────────────────────────

const JUPITER_QUOTE_URL = 'https://lite-api.jup.ag/swap/v1/quote'
const JUPITER_SWAP_URL = 'https://lite-api.jup.ag/swap/v1/swap'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface JupiterQuote {
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  otherAmountThreshold: string
  swapMode: string
  slippageBps: number
  priceImpactPct: string
  routePlan: JupiterRouteLeg[]
  contextSlot?: number
  timeTaken?: number
}

export interface JupiterRouteLeg {
  swapInfo: {
    ammKey: string
    label?: string
    inputMint: string
    outputMint: string
    inAmount: string
    outAmount: string
    feeAmount: string
    feeMint: string
  }
  percent: number
}

export interface JupiterSwapResponse {
  swapTransaction: string
  lastValidBlockHeight: number
  prioritizationFeeLamports: number
  computeUnitLimit: number
  prioritizationType?: {
    computeBudget?: {
      microLamports: number
      estimatedMicroLamports: number
    }
  }
  dynamicSlippageReport?: {
    slippageBps: number
    otherAmount: number
    simulatedIncurredSlippageBps: number
    amplificationRatio: string
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote fetching
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a swap quote from Jupiter's lite API.
 *
 * @param inputMint  - Base58 mint address of the input token
 * @param outputMint - Base58 mint address of the output token
 * @param amount     - Amount in base units (lamports / smallest unit)
 * @param slippageBps - Slippage tolerance in basis points (default 50 = 0.5%)
 * @returns The Jupiter quote object
 */
export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: bigint,
  slippageBps = 50,
): Promise<JupiterQuote> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: slippageBps.toString(),
  })

  const res = await fetch(`${JUPITER_QUOTE_URL}?${params}`)

  if (!res.ok) {
    const body = await res.text().catch(() => 'unknown error')
    throw new Error(`Jupiter quote failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  return data as JupiterQuote
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction building
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a serialized swap transaction from a Jupiter quote.
 *
 * @param quote                   - The quote object from getJupiterQuote
 * @param userPubkey              - The wallet public key that will sign the TX
 * @param destinationTokenAccount - Optional ATA override for the output token
 *                                  (used for stealth address routing)
 * @returns Base64-encoded serialized transaction ready for wallet signing
 */
export async function buildSwapTx(
  quote: JupiterQuote,
  userPubkey: string,
  destinationTokenAccount?: string,
): Promise<JupiterSwapResponse> {
  const body: Record<string, unknown> = {
    quoteResponse: quote,
    userPublicKey: userPubkey,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: 'auto',
  }

  if (destinationTokenAccount) {
    body.destinationTokenAccount = destinationTokenAccount
  }

  const res = await fetch(JUPITER_SWAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown error')
    throw new Error(`Jupiter swap TX build failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return data as JupiterSwapResponse
}
