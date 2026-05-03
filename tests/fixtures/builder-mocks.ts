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

interface SolanaConnectionMockOverrides {
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
  inAmount?: string
  outAmount?: string
  slippageBps?: number
  quoteId?: string
  priceImpactPct?: string
}

/**
 * Builds a canned Jupiter quote response shape for tests.
 * Mock jupiter-provider.getQuote to return this.
 */
export function makeJupiterQuote(opts: JupiterQuoteOptions = {}) {
  const inAmount = opts.inAmount ?? '1000000000'
  const outAmount = opts.outAmount ?? '150000000'
  const slippageBps = opts.slippageBps ?? 50
  return {
    quoteId: opts.quoteId ?? 'jup_test_quote_001',
    inAmount,
    outAmount,
    outAmountMin: String(Math.floor(Number(outAmount) * (10000 - slippageBps) / 10000)),
    priceImpactPct: opts.priceImpactPct ?? '0.05',
    slippageBps,
  }
}

/**
 * Builds a canned Jupiter swap-tx response.
 * Mock jupiter-provider.buildSwapTransaction to return this.
 */
export function makeJupiterSwapTx(swapTransaction = 'mockedJupiterSwapTxBase64String===') {
  return { swapTransaction }
}
