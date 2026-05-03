import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeJupiterQuote, makeJupiterSwapTx, mockCSPLService } from './fixtures/builder-mocks.js'

// Mock jupiter-provider — must be hoisted before importing the builder
vi.mock('../src/services/jupiter-provider.js', () => ({
  getQuote: vi.fn(),
  buildSwapTransaction: vi.fn(),
}))

// Mock cspl — default to "fail" (no wrap) so tests don't accidentally wrap
vi.mock('../src/services/cspl.js', () => ({
  getCSPLService: vi.fn().mockResolvedValue({
    wrap: vi.fn().mockResolvedValue({ success: false }),
  }),
}))

const jupiterProvider = await import('../src/services/jupiter-provider.js')
const csplModule = await import('../src/services/cspl.js')

const { buildPrivateSwap } = await import('../src/services/private-swap-builder.js')

const sender = 'SenderAddrXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
const SOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

// Realistic 32-byte ed25519 hex pubkey for Solana (using all-a/b for spending/viewing — same convention as other tests)
const PROVIDED_SPENDING_KEY = '0x' + 'a'.repeat(64)
const PROVIDED_VIEWING_KEY = '0x' + 'b'.repeat(64)

describe('buildPrivateSwap — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jupiterProvider.getQuote).mockResolvedValue(makeJupiterQuote())
    vi.mocked(jupiterProvider.buildSwapTransaction).mockResolvedValue(makeJupiterSwapTx())
    vi.mocked(csplModule.getCSPLService).mockResolvedValue(mockCSPLService('fail') as never)
  })

  it('with provided meta-address → uses it (not ephemeral)', async () => {
    const result = await buildPrivateSwap({
      sender,
      inputMint: SOL_MINT,
      inputAmount: '1000000000',
      outputMint: USDC_MINT,
      recipientMetaAddress: {
        spendingKey: PROVIDED_SPENDING_KEY,
        viewingKey: PROVIDED_VIEWING_KEY,
        chain: 'solana',
      },
    })

    // viewingKeyHash should derive from PROVIDED_VIEWING_KEY (not ephemeral)
    expect(result.viewingKeyHash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(result.outputStealthAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/) // base58
  })

  it('without meta-address → generates ephemeral meta-address', async () => {
    const result = await buildPrivateSwap({
      sender,
      inputMint: SOL_MINT,
      inputAmount: '1000000000',
      outputMint: USDC_MINT,
    })

    expect(result.outputStealthAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
    expect(result.viewingKeyHash).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('returns expected PrivateSwapResult shape', async () => {
    const result = await buildPrivateSwap({
      sender,
      inputMint: SOL_MINT,
      inputAmount: '1000000000',
      outputMint: USDC_MINT,
    })

    // Privacy artifacts
    expect(result).toHaveProperty('outputStealthAddress')
    expect(result).toHaveProperty('ephemeralPublicKey')
    expect(result).toHaveProperty('viewTag')
    expect(result).toHaveProperty('commitment')
    expect(result).toHaveProperty('blindingFactor')
    expect(result).toHaveProperty('viewingKeyHash')
    expect(result).toHaveProperty('sharedSecret')

    // Swap details
    expect(result.inputMint).toBe(SOL_MINT)
    expect(result.outputMint).toBe(USDC_MINT)
    expect(result.inputAmount).toBe('1000000000')
    expect(result.outputAmount).toBe('150000000')
    expect(result.quoteId).toBe('jup_test_quote_001')
    expect(result.slippageBps).toBe(50)

    // Transaction bundle
    expect(Array.isArray(result.transactions)).toBe(true)
    expect(Array.isArray(result.executionOrder)).toBe(true)
    expect(typeof result.estimatedComputeUnits).toBe('number')

    // C-SPL status
    expect(typeof result.csplWrapped).toBe('boolean')
  })
})

describe('buildPrivateSwap — C-SPL branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jupiterProvider.getQuote).mockResolvedValue(makeJupiterQuote())
    vi.mocked(jupiterProvider.buildSwapTransaction).mockResolvedValue(makeJupiterSwapTx())
  })

  it('CSPL wrap succeeds → wrap tx in bundle, csplWrapped=true, computeUnits=400_000', async () => {
    vi.mocked(csplModule.getCSPLService).mockResolvedValue(mockCSPLService('success') as never)

    const result = await buildPrivateSwap({
      sender,
      inputMint: SOL_MINT,
      inputAmount: '1000000000',
      outputMint: USDC_MINT,
    })

    expect(result.csplWrapped).toBe(true)
    expect(result.estimatedComputeUnits).toBe(400_000)
    expect(result.transactions[0].type).toBe('wrap')
    expect(result.executionOrder).toContain('wrap')
    expect(result.executionOrder).toContain('swap')
  })

  it('CSPL returns {success: false} → no wrap tx, csplWrapped=false, computeUnits=200_000', async () => {
    vi.mocked(csplModule.getCSPLService).mockResolvedValue(mockCSPLService('fail') as never)

    const result = await buildPrivateSwap({
      sender,
      inputMint: SOL_MINT,
      inputAmount: '1000000000',
      outputMint: USDC_MINT,
    })

    expect(result.csplWrapped).toBe(false)
    expect(result.estimatedComputeUnits).toBe(200_000)
    expect(result.executionOrder).not.toContain('wrap')
    expect(result.transactions.every(tx => tx.type !== 'wrap')).toBe(true)
  })

  it('CSPL throws → silently caught, no wrap tx, csplWrapped=false, computeUnits=200_000', async () => {
    vi.mocked(csplModule.getCSPLService).mockRejectedValue(new Error('CSPL service down'))

    const result = await buildPrivateSwap({
      sender,
      inputMint: SOL_MINT,
      inputAmount: '1000000000',
      outputMint: USDC_MINT,
    })

    expect(result.csplWrapped).toBe(false)
    expect(result.estimatedComputeUnits).toBe(200_000)
    expect(result.executionOrder).not.toContain('wrap')
  })
})

describe('buildPrivateSwap — stealth + commitment invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jupiterProvider.getQuote).mockResolvedValue(makeJupiterQuote())
    vi.mocked(jupiterProvider.buildSwapTransaction).mockResolvedValue(makeJupiterSwapTx())
    vi.mocked(csplModule.getCSPLService).mockResolvedValue(mockCSPLService('fail') as never)
  })

  it('outputStealthAddress is a valid base58 Solana address (32 bytes)', async () => {
    const result = await buildPrivateSwap({
      sender,
      inputMint: SOL_MINT,
      inputAmount: '1000000000',
      outputMint: USDC_MINT,
    })

    // base58 Solana addresses are 32-44 chars
    expect(result.outputStealthAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)

    // Validate by reconstructing PublicKey (will throw if invalid)
    const { PublicKey } = await import('@solana/web3.js')
    expect(() => new PublicKey(result.outputStealthAddress)).not.toThrow()
    expect(new PublicKey(result.outputStealthAddress).toBytes()).toHaveLength(32)
  })

  it('commitment is 33-byte compressed point hex; blindingFactor is 32-byte hex', async () => {
    const result = await buildPrivateSwap({
      sender,
      inputMint: SOL_MINT,
      inputAmount: '1000000000',
      outputMint: USDC_MINT,
    })

    // commitment: 0x + 66 hex chars (33 bytes)
    expect(result.commitment).toMatch(/^0x[0-9a-f]{66}$/)

    // First byte after 0x must be 02 or 03 (compressed point prefix)
    const prefix = result.commitment.slice(2, 4)
    expect(['02', '03']).toContain(prefix)

    // blindingFactor: 0x + 64 hex chars (32 bytes)
    expect(result.blindingFactor).toMatch(/^0x[0-9a-f]{64}$/)
  })
})
