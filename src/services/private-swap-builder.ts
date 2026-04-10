import {
  generateStealthMetaAddress,
  generateStealthAddress,
  ed25519PublicKeyToSolanaAddress,
  commit,
} from '@sip-protocol/sdk'
import type { StealthMetaAddress, HexString, ChainId } from '@sip-protocol/types'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { getQuote, buildSwapTransaction } from './jupiter-provider.js'
import { getCSPLService } from './cspl.js'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PrivateSwapRequest {
  sender: string
  inputMint: string
  inputAmount: string
  outputMint: string
  slippageBps?: number
  recipientMetaAddress?: {
    spendingKey: string
    viewingKey: string
    chain: string
    label?: string
  }
}

export interface SwapTransaction {
  type: 'wrap' | 'swap'
  transaction: string
  description: string
}

export interface PrivateSwapResult {
  // Privacy artifacts
  outputStealthAddress: string
  ephemeralPublicKey: string
  viewTag: number
  commitment: string
  blindingFactor: string
  viewingKeyHash: string
  sharedSecret: string

  // Swap details
  inputMint: string
  inputAmount: string
  outputMint: string
  outputAmount: string
  outputAmountMin: string
  quoteId: string
  priceImpactPct: string
  slippageBps: number

  // Transaction bundle
  transactions: SwapTransaction[]
  executionOrder: string[]
  estimatedComputeUnits: number

  // C-SPL status
  csplWrapped: boolean
}

// ─── Orchestration ──────────────────────────────────────────────────────────

export async function buildPrivateSwap(req: PrivateSwapRequest): Promise<PrivateSwapResult> {
  const { sender, inputMint, inputAmount, outputMint, slippageBps = 50 } = req

  // Step 1: Generate or use provided stealth meta-address
  let meta: StealthMetaAddress
  if (req.recipientMetaAddress) {
    meta = {
      spendingKey: req.recipientMetaAddress.spendingKey as HexString,
      viewingKey: req.recipientMetaAddress.viewingKey as HexString,
      chain: req.recipientMetaAddress.chain as ChainId,
      label: req.recipientMetaAddress.label,
    }
  } else {
    // Ephemeral meta-address
    const ephemeral = generateStealthMetaAddress('solana' as ChainId)
    meta = ephemeral.metaAddress
  }

  const stealthResult = generateStealthAddress(meta)
  const outputStealthAddress = ed25519PublicKeyToSolanaAddress(stealthResult.stealthAddress.address)

  // Step 2: Get Jupiter quote
  const quote = await getQuote({
    inputMint,
    outputMint,
    amount: inputAmount,
    slippageBps,
  })

  // Step 3: Create Pedersen commitment for output amount
  const outAmountBigInt = BigInt(quote.outAmount)
  const { commitment, blinding } = commit(outAmountBigInt)

  // Step 4: Viewing key hash
  let viewingKeyHash: string
  if (req.recipientMetaAddress) {
    const viewingKeyBytes = hexToBytes(req.recipientMetaAddress.viewingKey.slice(2))
    viewingKeyHash = `0x${bytesToHex(sha256(viewingKeyBytes))}`
  } else {
    viewingKeyHash = `0x${bytesToHex(sha256(new TextEncoder().encode('ephemeral-' + outputStealthAddress)))}`
  }

  // Step 5: Optional C-SPL wrap
  const transactions: SwapTransaction[] = []
  const executionOrder: string[] = []
  let csplWrapped = false

  try {
    const cspl = await getCSPLService()
    const wrapResult = await cspl.wrap({
      mint: inputMint,
      amount: BigInt(inputAmount),
      owner: sender,
    })
    if (wrapResult?.success && wrapResult.signature) {
      transactions.push({
        type: 'wrap',
        transaction: wrapResult.signature,
        description: `C-SPL wrap ${inputAmount} of ${inputMint} for confidential transfer`,
      })
      executionOrder.push('wrap')
      csplWrapped = true
    }
  } catch {
    // C-SPL wrap is optional — proceed without it for less privacy
  }

  // Step 6: Build Jupiter swap tx routed to stealth address
  const swapTx = await buildSwapTransaction({
    quoteId: quote.quoteId,
    userPublicKey: sender,
    destinationAddress: outputStealthAddress,
  })

  transactions.push({
    type: 'swap',
    transaction: swapTx.swapTransaction,
    description: `Jupiter swap ${inputAmount} ${inputMint} → ${quote.outAmount} ${outputMint} to stealth address`,
  })
  executionOrder.push('swap')

  const estimatedComputeUnits = csplWrapped ? 400_000 : 200_000

  return {
    outputStealthAddress,
    ephemeralPublicKey: stealthResult.stealthAddress.ephemeralPublicKey,
    viewTag: stealthResult.stealthAddress.viewTag,
    commitment,
    blindingFactor: blinding,
    viewingKeyHash,
    sharedSecret: stealthResult.sharedSecret,

    inputMint,
    inputAmount,
    outputMint,
    outputAmount: quote.outAmount,
    outputAmountMin: quote.outAmountMin,
    quoteId: quote.quoteId,
    priceImpactPct: quote.priceImpactPct,
    slippageBps: quote.slippageBps,

    transactions,
    executionOrder,
    estimatedComputeUnits,
    csplWrapped,
  }
}
