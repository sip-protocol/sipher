import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { Keypair } from '@solana/web3.js'
import { resetJupiterProvider } from '../src/services/jupiter-provider.js'

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation(() => ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
      getLatestBlockhash: vi.fn().mockResolvedValue({
        blockhash: '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM',
        lastValidBlockHeight: 300000100,
      }),
      getAccountInfo: vi.fn().mockResolvedValue(null),
    })),
  }
})

// Mock Jupiter API responses
vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, options?: any) => {
  const urlStr = url.toString()

  // Jupiter Quote API
  if (urlStr.includes('/swap/v1/quote')) {
    const params = new URL(urlStr).searchParams
    const inAmount = params.get('amount') ?? '1000000000'
    // Simulate ~150 USDC per SOL ratio for SOL→USDC, inverse for USDC→SOL
    const inputMint = params.get('inputMint') ?? ''
    const isSolInput = inputMint === 'So11111111111111111111111111111111111111112'
    const outAmount = isSolInput
      ? String(Math.floor(Number(inAmount) * 150 / 1000)) // SOL→USDC: scale down decimals
      : String(Math.floor(Number(inAmount) * 1000 / 150)) // USDC→SOL: scale up decimals
    const slippage = Number(params.get('slippageBps') ?? 50)
    const minOut = String(Math.floor(Number(outAmount) * (10000 - slippage) / 10000))

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        inputMint: params.get('inputMint'),
        outputMint: params.get('outputMint'),
        inAmount,
        outAmount,
        otherAmountThreshold: minOut,
        swapMode: 'ExactIn',
        slippageBps: slippage,
        priceImpactPct: '0.01',
        routePlan: [],
      }),
    })
  }

  // Jupiter Swap API
  if (urlStr.includes('/swap/v1/swap') && options?.method === 'POST') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        swapTransaction: Buffer.from('mock-swap-transaction-' + Date.now()).toString('base64'),
        lastValidBlockHeight: 300000100,
        prioritizationFeeLamports: 5000,
        computeUnitLimit: 200000,
      }),
    })
  }

  return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: 'Not found' }) })
}))

const { default: app } = await import('../src/server.js')

// ─── Fixtures ───────────────────────────────────────────────────────────────

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const VALID_SENDER = Keypair.generate().publicKey.toBase58()

async function generateMetaAddress() {
  const res = await request(app).post('/v1/stealth/generate').send({ chain: 'solana' })
  return res.body.data.metaAddress
}

function validSwapPayload(overrides: Record<string, unknown> = {}) {
  return {
    sender: VALID_SENDER,
    inputMint: SOL_MINT,
    inputAmount: '1000000000',
    outputMint: USDC_MINT,
    ...overrides,
  }
}

// ─── Happy Path ─────────────────────────────────────────────────────────────

describe('POST /v1/swap/private — Happy Path', () => {
  beforeEach(() => {
    resetJupiterProvider()
    vi.mocked(fetch).mockClear()
  })

  it('builds private swap with provided meta-address → 200', async () => {
    const metaAddress = await generateMetaAddress()

    const res = await request(app)
      .post('/v1/swap/private')
      .send(validSwapPayload({ recipientMetaAddress: metaAddress }))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.outputStealthAddress).toBeTypeOf('string')
    expect(res.body.data.ephemeralPublicKey).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.body.data.viewTag).toBeTypeOf('number')
    expect(res.body.data.commitment).toBeTypeOf('string')
    expect(res.body.data.blindingFactor).toBeTypeOf('string')
  })

  it('builds private swap with ephemeral stealth (no meta-address) → 200', async () => {
    const res = await request(app)
      .post('/v1/swap/private')
      .send(validSwapPayload())

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.outputStealthAddress).toBeTypeOf('string')
    expect(res.body.data.ephemeralPublicKey).toMatch(/^0x/)
  })

  it('returns correct slippage-adjusted output → 200', async () => {
    const res = await request(app)
      .post('/v1/swap/private')
      .send(validSwapPayload({ slippageBps: 100 }))

    expect(res.status).toBe(200)
    const { outputAmount, outputAmountMin, slippageBps } = res.body.data
    expect(slippageBps).toBe(100)
    // outAmountMin should be <= outAmount (slippage deducted)
    expect(BigInt(outputAmountMin)).toBeLessThanOrEqual(BigInt(outputAmount))
  })

  it('includes swap tx in transaction bundle → 200', async () => {
    const res = await request(app)
      .post('/v1/swap/private')
      .send(validSwapPayload())

    expect(res.status).toBe(200)
    const txs = res.body.data.transactions
    expect(txs.length).toBeGreaterThanOrEqual(1)
    const swapTx = txs.find((t: any) => t.type === 'swap')
    expect(swapTx).toBeDefined()
    expect(swapTx.transaction).toBeTypeOf('string')
    expect(swapTx.description).toContain('Jupiter swap')
  })

  it('generates unique stealth address per swap → 200', async () => {
    const res1 = await request(app)
      .post('/v1/swap/private')
      .send(validSwapPayload())

    const res2 = await request(app)
      .post('/v1/swap/private')
      .send(validSwapPayload())

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    // Ephemeral stealth addresses should differ across calls
    expect(res1.body.data.outputStealthAddress).not.toBe(res2.body.data.outputStealthAddress)
  })
})

// ─── Swap Details ───────────────────────────────────────────────────────────

describe('POST /v1/swap/private — Swap Details', () => {
  beforeEach(() => {
    resetJupiterProvider()
    vi.mocked(fetch).mockClear()
  })

  it('returns Jupiter quote with jup_ prefix → 200', async () => {
    const res = await request(app)
      .post('/v1/swap/private')
      .send(validSwapPayload())

    expect(res.status).toBe(200)
    expect(res.body.data.quoteId).toMatch(/^jup_/)
    expect(res.body.data.priceImpactPct).toBeTypeOf('string')
  })

  it('returns transaction bundle with execution order → 200', async () => {
    const res = await request(app)
      .post('/v1/swap/private')
      .send(validSwapPayload())

    expect(res.status).toBe(200)
    expect(res.body.data.executionOrder).toContain('swap')
    expect(res.body.data.estimatedComputeUnits).toBeTypeOf('number')
  })

  it('includes all privacy fields in response → 200', async () => {
    const res = await request(app)
      .post('/v1/swap/private')
      .send(validSwapPayload())

    expect(res.status).toBe(200)
    const d = res.body.data
    expect(d.outputStealthAddress).toBeDefined()
    expect(d.ephemeralPublicKey).toBeDefined()
    expect(d.viewTag).toBeDefined()
    expect(d.commitment).toBeDefined()
    expect(d.blindingFactor).toBeDefined()
    expect(d.viewingKeyHash).toBeDefined()
    expect(d.sharedSecret).toBeDefined()
  })
})

// ─── Validation ─────────────────────────────────────────────────────────────

describe('POST /v1/swap/private — Validation', () => {
  it('rejects same input/output mint → 400', async () => {
    const res = await request(app)
      .post('/v1/swap/private')
      .send(validSwapPayload({ outputMint: SOL_MINT }))

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('SWAP_UNSUPPORTED_TOKEN')
    expect(res.body.error.message).toContain('different')
  })

  it('rejects invalid amount (zero) → 400', async () => {
    const res = await request(app)
      .post('/v1/swap/private')
      .send(validSwapPayload({ inputAmount: '0' }))

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects missing sender → 400', async () => {
    const payload = validSwapPayload()
    delete (payload as any).sender
    const res = await request(app)
      .post('/v1/swap/private')
      .send(payload)

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects invalid slippage (>10000 bps) → 400', async () => {
    const res = await request(app)
      .post('/v1/swap/private')
      .send(validSwapPayload({ slippageBps: 10001 }))

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── Idempotency ────────────────────────────────────────────────────────────

describe('POST /v1/swap/private — Idempotency', () => {
  beforeEach(() => {
    resetJupiterProvider()
    vi.mocked(fetch).mockClear()
  })

  it('returns cached response with Idempotency-Replayed header', async () => {
    const key = crypto.randomUUID()

    const res1 = await request(app)
      .post('/v1/swap/private')
      .set('Idempotency-Key', key)
      .send(validSwapPayload())

    const res2 = await request(app)
      .post('/v1/swap/private')
      .set('Idempotency-Key', key)
      .send(validSwapPayload())

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    expect(res2.headers['idempotency-replayed']).toBe('true')
    expect(res2.body.data.quoteId).toBe(res1.body.data.quoteId)
  })

  it('different key → different response', async () => {
    const res1 = await request(app)
      .post('/v1/swap/private')
      .set('Idempotency-Key', crypto.randomUUID())
      .send(validSwapPayload())

    const res2 = await request(app)
      .post('/v1/swap/private')
      .set('Idempotency-Key', crypto.randomUUID())
      .send(validSwapPayload())

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    // Different idempotency keys should produce different quote IDs
    expect(res1.body.data.quoteId).not.toBe(res2.body.data.quoteId)
  })
})

// ─── Beta ───────────────────────────────────────────────────────────────────

describe('POST /v1/swap/private — Beta', () => {
  it('includes beta: true and X-Beta header', async () => {
    const res = await request(app)
      .post('/v1/swap/private')
      .send(validSwapPayload())

    expect(res.status).toBe(200)
    expect(res.body.beta).toBe(true)
    expect(res.body.warning).toContain('beta')
    expect(res.headers['x-beta']).toBe('true')
  })
})

// ─── Error Handling ─────────────────────────────────────────────────────────

describe('POST /v1/swap/private — Error Handling', () => {
  it('rejects negative amount → 400', async () => {
    const res = await request(app)
      .post('/v1/swap/private')
      .send(validSwapPayload({ inputAmount: '-100' }))

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── E2E Flow ───────────────────────────────────────────────────────────────

describe('POST /v1/swap/private — E2E Flow', () => {
  beforeEach(() => {
    resetJupiterProvider()
    vi.mocked(fetch).mockClear()
  })

  it('SOL → USDC full private swap flow', async () => {
    const metaAddress = await generateMetaAddress()

    const res = await request(app)
      .post('/v1/swap/private')
      .send({
        sender: VALID_SENDER,
        inputMint: SOL_MINT,
        inputAmount: '1000000000', // 1 SOL
        outputMint: USDC_MINT,
        slippageBps: 50,
        recipientMetaAddress: metaAddress,
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const d = res.body.data
    // Privacy artifacts
    expect(d.outputStealthAddress).toBeTypeOf('string')
    expect(d.commitment).toBeTypeOf('string')
    expect(d.viewingKeyHash).toMatch(/^0x[0-9a-f]{64}$/)

    // Swap details
    expect(d.inputMint).toBe(SOL_MINT)
    expect(d.outputMint).toBe(USDC_MINT)
    expect(d.inputAmount).toBe('1000000000')
    expect(BigInt(d.outputAmount)).toBeGreaterThan(0n)
    expect(d.quoteId).toMatch(/^jup_/)
    expect(d.slippageBps).toBe(50)

    // Transaction bundle
    expect(d.transactions.length).toBeGreaterThanOrEqual(1)
    expect(d.executionOrder).toContain('swap')
  })

  it('USDC → SOL full private swap flow', async () => {
    const res = await request(app)
      .post('/v1/swap/private')
      .send({
        sender: VALID_SENDER,
        inputMint: USDC_MINT,
        inputAmount: '1000000', // 1 USDC
        outputMint: SOL_MINT,
        slippageBps: 100,
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const d = res.body.data
    expect(d.inputMint).toBe(USDC_MINT)
    expect(d.outputMint).toBe(SOL_MINT)
    expect(d.slippageBps).toBe(100)
    expect(BigInt(d.outputAmountMin)).toBeLessThanOrEqual(BigInt(d.outputAmount))
    expect(d.transactions.some((t: any) => t.type === 'swap')).toBe(true)
  })
})
