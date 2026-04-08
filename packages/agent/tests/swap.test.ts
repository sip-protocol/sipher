import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeSwap, swapTool } from '../src/tools/swap.js'

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const VALID_WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'
const VALID_SPENDING_KEY = 'cd'.repeat(32)
const VALID_VIEWING_KEY = 'ab'.repeat(32)
const STEALTH_META = `sip:solana:0x${VALID_SPENDING_KEY}:0x${VALID_VIEWING_KEY}`

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

/** Fake Jupiter quote response */
const MOCK_QUOTE = {
  inputMint: SOL_MINT,
  outputMint: USDC_MINT,
  inAmount: '2000000000',
  outAmount: '300000000',
  otherAmountThreshold: '297000000',
  swapMode: 'ExactIn',
  slippageBps: 50,
  priceImpactPct: '0.01',
  routePlan: [
    {
      swapInfo: {
        ammKey: 'RaydiumCLMM123456789abcdef',
        label: 'Raydium CLMM',
        inputMint: SOL_MINT,
        outputMint: USDC_MINT,
        inAmount: '2000000000',
        outAmount: '300000000',
        feeAmount: '1000',
        feeMint: SOL_MINT,
      },
      percent: 100,
    },
  ],
}

/** Fake Jupiter swap TX response */
const MOCK_SWAP_RESPONSE = {
  swapTransaction: 'AQAAAAAAAAAAAAAAAAAAAAAAAAAA==',
  lastValidBlockHeight: 200,
  prioritizationFeeLamports: 5000,
  computeUnitLimit: 200000,
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock fetch globally — Jupiter API calls go through native fetch
// ─────────────────────────────────────────────────────────────────────────────

const mockFetch = vi.fn()

vi.stubGlobal('fetch', mockFetch)

// Mock @solana/spl-token for ATA derivation
vi.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddress: vi.fn().mockResolvedValue({
    toBase58: () => '8ZMzqa1eDJJm7Q3VnDAkFgAr8Rqo5TKS1ean3FDEjWS7',
  }),
  TOKEN_PROGRAM_ID: { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
}))

// Mock @sip-protocol/sdk for stealth address generation
vi.mock('@sip-protocol/sdk', () => ({
  generateEd25519StealthAddress: vi.fn().mockReturnValue({
    stealthAddress: {
      address: '0x' + 'aa'.repeat(32),
      ephemeralPublicKey: '0x' + 'bb'.repeat(32),
    },
  }),
  ed25519PublicKeyToSolanaAddress: vi.fn().mockReturnValue(
    'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'
  ),
}))

function setupFetchMocks() {
  mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
    // Quote endpoint (GET)
    if (typeof url === 'string' && url.includes('/quote')) {
      return {
        ok: true,
        json: async () => MOCK_QUOTE,
        text: async () => JSON.stringify(MOCK_QUOTE),
      }
    }
    // Swap endpoint (POST)
    if (opts?.method === 'POST') {
      return {
        ok: true,
        json: async () => MOCK_SWAP_RESPONSE,
        text: async () => JSON.stringify(MOCK_SWAP_RESPONSE),
      }
    }
    return { ok: false, status: 404, text: async () => 'Not found' }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('swapTool definition', () => {
  it('has correct Anthropic tool shape', () => {
    expect(swapTool.name).toBe('swap')
    expect(swapTool.description).toBeTruthy()
    expect(swapTool.input_schema.type).toBe('object')
    expect(swapTool.input_schema.properties).toBeDefined()
  })

  it('requires amount, fromToken, toToken', () => {
    const schema = swapTool.input_schema as { required?: string[] }
    expect(schema.required).toEqual(['amount', 'fromToken', 'toToken'])
  })

  it('includes wallet as optional property', () => {
    const props = swapTool.input_schema.properties as Record<string, unknown>
    expect(props).toHaveProperty('wallet')
  })
})

describe('executeSwap — validation', () => {
  it('rejects zero amount', async () => {
    await expect(
      executeSwap({ amount: 0, fromToken: 'SOL', toToken: 'USDC' })
    ).rejects.toThrow('Swap amount must be greater than zero')
  })

  it('rejects negative amount', async () => {
    await expect(
      executeSwap({ amount: -5, fromToken: 'SOL', toToken: 'USDC' })
    ).rejects.toThrow('Swap amount must be greater than zero')
  })

  it('rejects empty fromToken', async () => {
    await expect(
      executeSwap({ amount: 1, fromToken: '', toToken: 'USDC' })
    ).rejects.toThrow('Source token (fromToken) is required')
  })

  it('rejects empty toToken', async () => {
    await expect(
      executeSwap({ amount: 1, fromToken: 'SOL', toToken: '' })
    ).rejects.toThrow('Destination token (toToken) is required')
  })

  it('rejects same token swap', async () => {
    await expect(
      executeSwap({ amount: 1, fromToken: 'SOL', toToken: 'sol' })
    ).rejects.toThrow('Source and destination tokens must be different')
  })

  it('rejects invalid wallet address', async () => {
    setupFetchMocks()
    await expect(
      executeSwap({ amount: 1, fromToken: 'SOL', toToken: 'USDC', wallet: 'not-valid' })
    ).rejects.toThrow('Invalid wallet address')
  })

  it('clamps slippage below minimum to 1', async () => {
    setupFetchMocks()
    const result = await executeSwap({ amount: 1, fromToken: 'SOL', toToken: 'USDC', slippageBps: 0 })
    expect(result.slippageBps).toBe(1)
  })

  it('clamps slippage above maximum to 1000', async () => {
    setupFetchMocks()
    const result = await executeSwap({ amount: 1, fromToken: 'SOL', toToken: 'USDC', slippageBps: 5000 })
    expect(result.slippageBps).toBe(1000)
  })
})

describe('executeSwap — preview (no wallet)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    setupFetchMocks()
  })

  it('returns preview status without wallet', async () => {
    const result = await executeSwap({ amount: 2, fromToken: 'SOL', toToken: 'USDC' })
    expect(result.status).toBe('preview')
    expect(result.serializedTx).toBeNull()
    expect(result.message).toContain('Connect wallet')
  })

  it('includes quote data from Jupiter', async () => {
    const result = await executeSwap({ amount: 2, fromToken: 'SOL', toToken: 'USDC' })
    expect(result.quote.estimatedOutput).toBe('300')
    expect(result.quote.priceImpact).toBe('0.01')
    expect(result.quote.route).toEqual(['Raydium CLMM'])
  })

  it('normalizes tokens to uppercase', async () => {
    const result = await executeSwap({ amount: 1, fromToken: 'sol', toToken: 'usdc' })
    expect(result.fromToken).toBe('SOL')
    expect(result.toToken).toBe('USDC')
  })

  it('defaults slippage to 50 bps', async () => {
    const result = await executeSwap({ amount: 1, fromToken: 'SOL', toToken: 'USDC' })
    expect(result.slippageBps).toBe(50)
  })

  it('passes recipient through without stealth routing', async () => {
    const result = await executeSwap({
      amount: 1,
      fromToken: 'SOL',
      toToken: 'USDC',
      recipient: VALID_WALLET,
    })
    expect(result.recipient).toBe(VALID_WALLET)
    expect(result.privacy.stealthRouted).toBe(false)
  })

  it('calls Jupiter quote endpoint with correct params', async () => {
    await executeSwap({ amount: 2, fromToken: 'SOL', toToken: 'USDC', slippageBps: 100 })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callUrl = mockFetch.mock.calls[0][0] as string
    expect(callUrl).toContain('/quote')
    expect(callUrl).toContain(`inputMint=${SOL_MINT}`)
    expect(callUrl).toContain(`outputMint=${USDC_MINT}`)
    expect(callUrl).toContain('amount=2000000000')
    expect(callUrl).toContain('slippageBps=100')
  })
})

describe('executeSwap — full TX build (with wallet)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    setupFetchMocks()
  })

  it('returns awaiting_signature with serialized TX', async () => {
    const result = await executeSwap({
      amount: 2,
      fromToken: 'SOL',
      toToken: 'USDC',
      wallet: VALID_WALLET,
    })
    expect(result.status).toBe('awaiting_signature')
    expect(result.serializedTx).toBe(MOCK_SWAP_RESPONSE.swapTransaction)
    expect(result.message).toContain('Awaiting wallet signature')
  })

  it('includes quote data in full TX response', async () => {
    const result = await executeSwap({
      amount: 2,
      fromToken: 'SOL',
      toToken: 'USDC',
      wallet: VALID_WALLET,
    })
    expect(result.quote.estimatedOutput).toBe('300')
    expect(result.quote.priceImpact).toBe('0.01')
    expect(result.quote.route).toEqual(['Raydium CLMM'])
  })

  it('calls both quote and swap endpoints', async () => {
    await executeSwap({
      amount: 1,
      fromToken: 'SOL',
      toToken: 'USDC',
      wallet: VALID_WALLET,
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    const quoteUrl = mockFetch.mock.calls[0][0] as string
    expect(quoteUrl).toContain('/quote')
    const swapCall = mockFetch.mock.calls[1]
    expect(swapCall[1]).toHaveProperty('method', 'POST')
  })

  it('sends wallet pubkey in swap POST body', async () => {
    await executeSwap({
      amount: 1,
      fromToken: 'SOL',
      toToken: 'USDC',
      wallet: VALID_WALLET,
    })

    const swapBody = JSON.parse(mockFetch.mock.calls[1][1].body as string)
    expect(swapBody.userPublicKey).toBe(VALID_WALLET)
    expect(swapBody.quoteResponse).toEqual(MOCK_QUOTE)
  })
})

describe('executeSwap — stealth output routing', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    setupFetchMocks()
  })

  it('routes output to stealth ATA when recipient is meta-address', async () => {
    const result = await executeSwap({
      amount: 1,
      fromToken: 'SOL',
      toToken: 'USDC',
      wallet: VALID_WALLET,
      recipient: STEALTH_META,
    })

    expect(result.privacy.stealthRouted).toBe(true)
    expect(result.privacy.stealthAddress).toBeTruthy()
    expect(result.message).toContain('stealth address')
  })

  it('passes destinationTokenAccount in swap POST body', async () => {
    await executeSwap({
      amount: 1,
      fromToken: 'SOL',
      toToken: 'USDC',
      wallet: VALID_WALLET,
      recipient: STEALTH_META,
    })

    const swapBody = JSON.parse(mockFetch.mock.calls[1][1].body as string)
    expect(swapBody.destinationTokenAccount).toBe('8ZMzqa1eDJJm7Q3VnDAkFgAr8Rqo5TKS1ean3FDEjWS7')
  })

  it('rejects malformed stealth meta-address', async () => {
    setupFetchMocks()
    await expect(
      executeSwap({
        amount: 1,
        fromToken: 'SOL',
        toToken: 'USDC',
        wallet: VALID_WALLET,
        recipient: 'sip:solana:badkey',
      })
    ).rejects.toThrow('Invalid stealth meta-address')
  })

  it('rejects meta-address without 0x prefix', async () => {
    const noPrefix = `sip:solana:${VALID_SPENDING_KEY}:${VALID_VIEWING_KEY}`
    setupFetchMocks()
    await expect(
      executeSwap({
        amount: 1,
        fromToken: 'SOL',
        toToken: 'USDC',
        wallet: VALID_WALLET,
        recipient: noPrefix,
      })
    ).rejects.toThrow('0x-prefixed hex strings')
  })
})

describe('executeSwap — Jupiter API error handling', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('throws on Jupiter quote failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Token not tradable',
    })

    await expect(
      executeSwap({ amount: 1, fromToken: 'SOL', toToken: 'USDC' })
    ).rejects.toThrow('Jupiter quote failed (400): Token not tradable')
  })

  it('throws on Jupiter swap TX build failure', async () => {
    // First call (quote) succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_QUOTE,
      text: async () => JSON.stringify(MOCK_QUOTE),
    })
    // Second call (swap) fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal server error',
    })

    await expect(
      executeSwap({ amount: 1, fromToken: 'SOL', toToken: 'USDC', wallet: VALID_WALLET })
    ).rejects.toThrow('Jupiter swap TX build failed (500): Internal server error')
  })

  it('handles network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(
      executeSwap({ amount: 1, fromToken: 'SOL', toToken: 'USDC' })
    ).rejects.toThrow('Failed to fetch')
  })
})
