import { vi } from 'vitest'

/**
 * Generates CONFIG_PDA bytes for buildAnchorShieldedSolTransfer tests.
 * The function reads total_transfers at byte offset 43 as u64 LE.
 * See src/services/transaction-builder.ts:155-159
 */
export function makeConfigPDABytes(counter: bigint): Buffer {
  const buf = Buffer.alloc(51)
  buf.writeBigUInt64LE(counter, 43)
  return buf
}

export interface SolanaConnectionMockOverrides {
  getAccountInfo?: ReturnType<typeof vi.fn>
  getLatestBlockhash?: ReturnType<typeof vi.fn>
  getSlot?: ReturnType<typeof vi.fn>
}

/**
 * Returns a vi.mock factory for @solana/web3.js Connection.
 * Spreads vi.importActual to preserve PublicKey/Transaction/SystemProgram constructors.
 * Use: vi.mock('@solana/web3.js', mockSolanaConnection({...}))
 */
export function mockSolanaConnection(overrides: SolanaConnectionMockOverrides = {}) {
  return async () => {
    const actual = await vi.importActual<typeof import('@solana/web3.js')>('@solana/web3.js')
    return {
      ...(actual as object),
      Connection: vi.fn().mockImplementation(() => ({
        rpcEndpoint: 'https://api.mainnet-beta.solana.com',
        getSlot: overrides.getSlot ?? vi.fn().mockResolvedValue(300_000_000),
        getLatestBlockhash: overrides.getLatestBlockhash ?? vi.fn().mockResolvedValue({
          blockhash: '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM',
          lastValidBlockHeight: 300_000_100,
        }),
        getAccountInfo: overrides.getAccountInfo ?? vi.fn().mockResolvedValue(null),
      })),
    }
  }
}

type CSPLBehavior = 'success' | 'fail' | 'throws'

/**
 * Returns a mock CSPL service object for private-swap-builder tests.
 * Used inside vi.mock('./cspl.js', () => ({ getCSPLService: () => mockCSPLService(...) }))
 */
export function mockCSPLService(behavior: CSPLBehavior) {
  if (behavior === 'success') {
    return {
      wrap: vi.fn().mockResolvedValue({
        success: true,
        signature: 'csplwrapsig000000000000000000000000000000000000000000000000000',
      }),
    }
  }
  if (behavior === 'fail') {
    return {
      wrap: vi.fn().mockResolvedValue({ success: false }),
    }
  }
  return {
    wrap: vi.fn().mockRejectedValue(new Error('CSPL wrap failed')),
  }
}

interface JupiterQuoteOptions {
  inputMint?: string
  outputMint?: string
  inAmount?: string
  outAmount?: string
  slippageBps?: number
  quoteId?: string
  priceImpactPct?: string
  expiresAt?: number
}

/**
 * Builds a canned Jupiter QuoteEntry shape for tests.
 * Mock jupiter-provider.getQuote to return this.
 * Matches the QuoteEntry interface in src/services/jupiter-provider.ts:26-36.
 */
export function makeJupiterQuote(opts: JupiterQuoteOptions = {}) {
  const inAmount = opts.inAmount ?? '1000000000'
  const outAmount = opts.outAmount ?? '150000000'
  const slippageBps = opts.slippageBps ?? 50
  return {
    quoteId: opts.quoteId ?? 'jup_test_quote_001',
    inputMint: opts.inputMint ?? 'So11111111111111111111111111111111111111112',
    outputMint: opts.outputMint ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    inAmount,
    outAmount,
    outAmountMin: String(Math.floor(Number(outAmount) * (10000 - slippageBps) / 10000)),
    priceImpactPct: opts.priceImpactPct ?? '0.05',
    slippageBps,
    expiresAt: opts.expiresAt ?? Date.now() + 30_000,
  }
}

interface JupiterSwapTxOptions {
  swapTransaction?: string
  quoteId?: string
  computeUnitPrice?: number
  priorityFee?: number
}

/**
 * Builds a canned Jupiter SwapTransactionResult shape for tests.
 * Mock jupiter-provider.buildSwapTransaction to return this.
 * Matches the SwapTransactionResult interface in src/services/jupiter-provider.ts:44-49.
 */
export function makeJupiterSwapTx(opts: JupiterSwapTxOptions = {}) {
  return {
    swapTransaction: opts.swapTransaction ?? 'mockedJupiterSwapTxBase64String===',
    quoteId: opts.quoteId ?? 'jup_test_quote_001',
    computeUnitPrice: opts.computeUnitPrice ?? 1000,
    priorityFee: opts.priorityFee ?? 5000,
  }
}
