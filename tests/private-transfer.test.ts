import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { Keypair } from '@solana/web3.js'

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

const { default: app } = await import('../src/server.js')

// ─── Helpers ────────────────────────────────────────────────────────────────

async function generateMetaAddress(chain = 'solana') {
  const res = await request(app).post('/v1/stealth/generate').send({ chain })
  return res.body.data
}

const VALID_SOLANA_SENDER = Keypair.generate().publicKey.toBase58()

// ─── Solana Transfers ───────────────────────────────────────────────────────

describe('POST /v1/transfer/private — Solana', () => {
  it('builds private SOL transfer', async () => {
    const { metaAddress } = await generateMetaAddress('solana')

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: VALID_SOLANA_SENDER,
        recipientMetaAddress: metaAddress,
        amount: '1000000000',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.chain).toBe('solana')
    expect(res.body.data.curve).toBe('ed25519')
    expect(res.body.data.chainData.type).toBe('solana')
    expect(res.body.data.chainData.transaction).toBeTypeOf('string')
    expect(() => Buffer.from(res.body.data.chainData.transaction, 'base64')).not.toThrow()
  })

  it('builds private SPL transfer with token', async () => {
    const { metaAddress } = await generateMetaAddress('solana')
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: VALID_SOLANA_SENDER,
        recipientMetaAddress: metaAddress,
        amount: '1000000',
        token: USDC_MINT,
      })

    expect(res.status).toBe(200)
    expect(res.body.data.chainData.type).toBe('solana')
    expect(res.body.data.chainData.mint).toBe(USDC_MINT)
  })

  it('returns common privacy fields', async () => {
    const { metaAddress } = await generateMetaAddress('solana')

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: VALID_SOLANA_SENDER,
        recipientMetaAddress: metaAddress,
        amount: '500000000',
      })

    expect(res.body.data.stealthAddress).toBeTypeOf('string')
    expect(res.body.data.ephemeralPublicKey).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.body.data.viewTag).toBeGreaterThanOrEqual(0)
    expect(res.body.data.viewTag).toBeLessThanOrEqual(255)
    expect(res.body.data.commitment).toBeDefined()
    expect(res.body.data.blindingFactor).toBeDefined()
    expect(res.body.data.viewingKeyHash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.body.data.sharedSecret).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('generates unique stealth addresses per request', async () => {
    const { metaAddress } = await generateMetaAddress('solana')

    const res1 = await request(app)
      .post('/v1/transfer/private')
      .send({ sender: VALID_SOLANA_SENDER, recipientMetaAddress: metaAddress, amount: '1000000000' })
    const res2 = await request(app)
      .post('/v1/transfer/private')
      .send({ sender: VALID_SOLANA_SENDER, recipientMetaAddress: metaAddress, amount: '1000000000' })

    expect(res1.body.data.stealthAddress).not.toBe(res2.body.data.stealthAddress)
  })

  it('returns base64 encoded transaction', async () => {
    const { metaAddress } = await generateMetaAddress('solana')

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({ sender: VALID_SOLANA_SENDER, recipientMetaAddress: metaAddress, amount: '1000000000' })

    const txBuffer = Buffer.from(res.body.data.chainData.transaction, 'base64')
    expect(txBuffer.length).toBeGreaterThan(0)
  })
})

// ─── EVM Transfers ──────────────────────────────────────────────────────────

describe('POST /v1/transfer/private — EVM', () => {
  it('builds native ETH transfer', async () => {
    const { metaAddress } = await generateMetaAddress('ethereum')

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD70',
        recipientMetaAddress: metaAddress,
        amount: '1000000000000000000',
      })

    expect(res.status).toBe(200)
    expect(res.body.data.chain).toBe('ethereum')
    expect(res.body.data.curve).toBe('secp256k1')
    expect(res.body.data.chainData.type).toBe('evm')
    expect(res.body.data.chainData.chainId).toBe(1)
    expect(res.body.data.chainData.data).toBe('0x')
    expect(res.body.data.chainData.value).toBe('1000000000000000000')
  })

  it('builds ERC20 transfer with token contract', async () => {
    const { metaAddress } = await generateMetaAddress('ethereum')
    const USDC_ETH = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD70',
        recipientMetaAddress: metaAddress,
        amount: '1000000',
        token: USDC_ETH,
      })

    expect(res.status).toBe(200)
    expect(res.body.data.chainData.to).toBe(USDC_ETH)
    expect(res.body.data.chainData.value).toBe('0')
    expect(res.body.data.chainData.data).toMatch(/^0xa9059cbb/)
    expect(res.body.data.chainData.tokenContract).toBe(USDC_ETH)
  })

  it('returns correct chainId for polygon', async () => {
    const { metaAddress } = await generateMetaAddress('polygon')

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD70',
        recipientMetaAddress: metaAddress,
        amount: '1000000000000000000',
      })

    expect(res.body.data.chainData.chainId).toBe(137)
  })

  it('returns correct chainId for arbitrum', async () => {
    const { metaAddress } = await generateMetaAddress('arbitrum')

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD70',
        recipientMetaAddress: metaAddress,
        amount: '1000000000000000000',
      })

    expect(res.body.data.chainData.chainId).toBe(42161)
  })

  it('returns correct chainId for optimism', async () => {
    const { metaAddress } = await generateMetaAddress('optimism')

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD70',
        recipientMetaAddress: metaAddress,
        amount: '1000000000000000000',
      })

    expect(res.body.data.chainData.chainId).toBe(10)
  })

  it('returns correct chainId for base', async () => {
    const { metaAddress } = await generateMetaAddress('base')

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD70',
        recipientMetaAddress: metaAddress,
        amount: '1000000000000000000',
      })

    expect(res.body.data.chainData.chainId).toBe(8453)
  })

  it('returns 0x-prefixed stealth address for EVM', async () => {
    const { metaAddress } = await generateMetaAddress('ethereum')

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD70',
        recipientMetaAddress: metaAddress,
        amount: '1000000000000000000',
      })

    expect(res.body.data.stealthAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })
})

// ─── NEAR Transfers ─────────────────────────────────────────────────────────

describe('POST /v1/transfer/private — NEAR', () => {
  it('builds native NEAR transfer', async () => {
    const { metaAddress } = await generateMetaAddress('near')

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: 'alice.near',
        recipientMetaAddress: metaAddress,
        amount: '1000000000000000000000000',
      })

    expect(res.status).toBe(200)
    expect(res.body.data.chain).toBe('near')
    expect(res.body.data.curve).toBe('ed25519')
    expect(res.body.data.chainData.type).toBe('near')
    expect(res.body.data.chainData.actions).toHaveLength(1)
    expect(res.body.data.chainData.actions[0].type).toBe('Transfer')
    expect(res.body.data.chainData.actions[0].amount).toBe('1000000000000000000000000')
  })

  it('builds NEP-141 token transfer', async () => {
    const { metaAddress } = await generateMetaAddress('near')
    const USDC_NEAR = 'usdc.near'

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: 'alice.near',
        recipientMetaAddress: metaAddress,
        amount: '1000000',
        token: USDC_NEAR,
      })

    expect(res.status).toBe(200)
    expect(res.body.data.chainData.receiverId).toBe(USDC_NEAR)
    expect(res.body.data.chainData.actions[0].type).toBe('FunctionCall')
    expect(res.body.data.chainData.actions[0].methodName).toBe('ft_transfer')
    expect(res.body.data.chainData.tokenContract).toBe(USDC_NEAR)
  })

  it('returns implicit account (64-char hex) as stealth address', async () => {
    const { metaAddress } = await generateMetaAddress('near')

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: 'alice.near',
        recipientMetaAddress: metaAddress,
        amount: '1000000000000000000000000',
      })

    // NEAR implicit accounts are 64-char lowercase hex
    expect(res.body.data.stealthAddress).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns ed25519 curve for NEAR', async () => {
    const { metaAddress } = await generateMetaAddress('near')

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: 'alice.near',
        recipientMetaAddress: metaAddress,
        amount: '1000000000000000000000000',
      })

    expect(res.body.data.curve).toBe('ed25519')
  })
})

// ─── Unsupported Chains ─────────────────────────────────────────────────────

describe('POST /v1/transfer/private — Unsupported Chains', () => {
  it('returns 422 for cosmos', async () => {
    const { metaAddress } = await generateMetaAddress('cosmos')

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: 'cosmos1...',
        recipientMetaAddress: metaAddress,
        amount: '1000000',
      })

    expect(res.status).toBe(422)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('CHAIN_TRANSFER_UNSUPPORTED')
    expect(res.body.error.supportedChains).toBeInstanceOf(Array)
    expect(res.body.error.supportedChains).toContain('solana')
    expect(res.body.error.supportedChains).toContain('ethereum')
    expect(res.body.error.supportedChains).toContain('near')
  })

  it('returns 422 for bitcoin', async () => {
    const { metaAddress } = await generateMetaAddress('bitcoin')

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: 'bc1q...',
        recipientMetaAddress: metaAddress,
        amount: '100000000',
      })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('CHAIN_TRANSFER_UNSUPPORTED')
  })

  it('includes supportedChains in 422 response', async () => {
    const { metaAddress } = await generateMetaAddress('aptos')

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: '0x1',
        recipientMetaAddress: metaAddress,
        amount: '100000000',
      })

    expect(res.status).toBe(422)
    expect(res.body.error.supportedChains).toHaveLength(7)
  })
})

// ─── Validation ─────────────────────────────────────────────────────────────

describe('POST /v1/transfer/private — Validation', () => {
  it('rejects missing sender', async () => {
    const { metaAddress } = await generateMetaAddress('solana')

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({ recipientMetaAddress: metaAddress, amount: '1000000000' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects missing recipientMetaAddress', async () => {
    const res = await request(app)
      .post('/v1/transfer/private')
      .send({ sender: VALID_SOLANA_SENDER, amount: '1000000000' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects invalid amount (zero)', async () => {
    const { metaAddress } = await generateMetaAddress('solana')

    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: VALID_SOLANA_SENDER,
        recipientMetaAddress: metaAddress,
        amount: '0',
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects invalid hex keys', async () => {
    const res = await request(app)
      .post('/v1/transfer/private')
      .send({
        sender: VALID_SOLANA_SENDER,
        recipientMetaAddress: {
          spendingKey: 'not-hex',
          viewingKey: '0x1234',
          chain: 'solana',
        },
        amount: '1000000000',
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects empty body', async () => {
    const res = await request(app)
      .post('/v1/transfer/private')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})

// ─── Idempotency ────────────────────────────────────────────────────────────

describe('POST /v1/transfer/private — Idempotency', () => {
  it('returns cached response with Idempotency-Replayed header', async () => {
    const { metaAddress } = await generateMetaAddress('ethereum')
    const idempotencyKey = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

    const res1 = await request(app)
      .post('/v1/transfer/private')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        sender: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD70',
        recipientMetaAddress: metaAddress,
        amount: '1000000000000000000',
      })

    expect(res1.status).toBe(200)

    const res2 = await request(app)
      .post('/v1/transfer/private')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        sender: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD70',
        recipientMetaAddress: metaAddress,
        amount: '1000000000000000000',
      })

    expect(res2.status).toBe(200)
    expect(res2.headers['idempotency-replayed']).toBe('true')
    expect(res2.body.data.stealthAddress).toBe(res1.body.data.stealthAddress)
  })
})
