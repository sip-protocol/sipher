import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation(() => ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    })),
  }
})

const { default: app } = await import('../src/server.js')

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const validOwner = 'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at'
const validRecipient = 'S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd'
const validMint = 'So11111111111111111111111111111111111111112'

// ─── Wrap ───────────────────────────────────────────────────────────────────

describe('POST /v1/cspl/wrap', () => {
  it('wraps SPL tokens into confidential balance', async () => {
    const res = await request(app)
      .post('/v1/cspl/wrap')
      .send({ mint: validMint, amount: '1000000000', owner: validOwner })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.signature).toBeDefined()
    expect(res.body.data.csplMint).toBeDefined()
    expect(res.body.data.token).toBeDefined()
  })

  it('returns encryptedBalance as hex string', async () => {
    const res = await request(app)
      .post('/v1/cspl/wrap')
      .send({ mint: validMint, amount: '500000000', owner: validOwner })
    expect(res.status).toBe(200)
    if (res.body.data.encryptedBalance) {
      expect(res.body.data.encryptedBalance).toMatch(/^0x[0-9a-fA-F]+$/)
    }
  })

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/v1/cspl/wrap')
      .send({ mint: validMint })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects zero amount', async () => {
    const res = await request(app)
      .post('/v1/cspl/wrap')
      .send({ mint: validMint, amount: '0', owner: validOwner })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('accepts explicit createAccount false', async () => {
    const res = await request(app)
      .post('/v1/cspl/wrap')
      .send({ mint: validMint, amount: '500000000', owner: validOwner, createAccount: false })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

// ─── Unwrap ─────────────────────────────────────────────────────────────────

describe('POST /v1/cspl/unwrap', () => {
  it('unwraps confidential tokens back to SPL (wrap first)', async () => {
    const wrapRes = await request(app)
      .post('/v1/cspl/wrap')
      .send({ mint: validMint, amount: '1000000000', owner: validOwner })
    expect(wrapRes.status).toBe(200)

    const csplMint = wrapRes.body.data.csplMint
    const encBal = wrapRes.body.data.encryptedBalance || '0x' + 'ab'.repeat(16)

    const res = await request(app)
      .post('/v1/cspl/unwrap')
      .send({ csplMint, encryptedAmount: encBal, owner: validOwner })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.signature).toBeDefined()
    expect(res.body.data.amount).toBeDefined()
  })

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/v1/cspl/unwrap')
      .send({ csplMint: 'C-wSOL' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects unregistered csplMint', async () => {
    const res = await request(app)
      .post('/v1/cspl/unwrap')
      .send({ csplMint: 'UNKNOWN-TOKEN', encryptedAmount: '0xdeadbeef', owner: validOwner })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('CSPL_OPERATION_FAILED')
  })
})

// ─── Transfer ───────────────────────────────────────────────────────────────

describe('POST /v1/cspl/transfer', () => {
  it('transfers confidential tokens (wrap first)', async () => {
    const wrapRes = await request(app)
      .post('/v1/cspl/wrap')
      .send({ mint: validMint, amount: '2000000000', owner: validOwner })
    expect(wrapRes.status).toBe(200)

    const csplMint = wrapRes.body.data.csplMint
    const encBal = wrapRes.body.data.encryptedBalance || '0x' + 'ab'.repeat(16)

    const res = await request(app)
      .post('/v1/cspl/transfer')
      .send({ csplMint, from: validOwner, to: validRecipient, encryptedAmount: encBal })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.signature).toBeDefined()
  })

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/v1/cspl/transfer')
      .send({ csplMint: 'C-USDC', from: validOwner })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects memo exceeding 256 chars', async () => {
    const res = await request(app)
      .post('/v1/cspl/transfer')
      .send({
        csplMint: 'C-USDC',
        from: validOwner,
        to: validRecipient,
        encryptedAmount: '0xdeadbeef',
        memo: 'x'.repeat(257),
      })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('accepts optional memo within limit', async () => {
    const wrapRes = await request(app)
      .post('/v1/cspl/wrap')
      .send({ mint: validMint, amount: '500000000', owner: validOwner })
    expect(wrapRes.status).toBe(200)

    const csplMint = wrapRes.body.data.csplMint
    const encBal = wrapRes.body.data.encryptedBalance || '0x' + 'ab'.repeat(16)

    const res = await request(app)
      .post('/v1/cspl/transfer')
      .send({
        csplMint,
        from: validOwner,
        to: validRecipient,
        encryptedAmount: encBal,
        memo: 'payment for services',
      })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

// ─── Round-trip ─────────────────────────────────────────────────────────────

describe('C-SPL round-trip', () => {
  it('wrap then transfer succeeds', async () => {
    const wrapRes = await request(app)
      .post('/v1/cspl/wrap')
      .send({ mint: validMint, amount: '3000000000', owner: validOwner })
    expect(wrapRes.status).toBe(200)
    expect(wrapRes.body.success).toBe(true)

    const csplMint = wrapRes.body.data.csplMint
    const encBal = wrapRes.body.data.encryptedBalance || '0x' + 'ab'.repeat(16)

    const transferRes = await request(app)
      .post('/v1/cspl/transfer')
      .send({ csplMint, from: validOwner, to: validRecipient, encryptedAmount: encBal })
    expect(transferRes.status).toBe(200)
    expect(transferRes.body.success).toBe(true)
    expect(transferRes.body.data.signature).toBeDefined()
  })

  it('wrap then unwrap succeeds', async () => {
    const wrapRes = await request(app)
      .post('/v1/cspl/wrap')
      .send({ mint: validMint, amount: '1500000000', owner: validOwner })
    expect(wrapRes.status).toBe(200)

    const csplMint = wrapRes.body.data.csplMint
    const encBal = wrapRes.body.data.encryptedBalance || '0x' + 'ab'.repeat(16)

    const unwrapRes = await request(app)
      .post('/v1/cspl/unwrap')
      .send({ csplMint, encryptedAmount: encBal, owner: validOwner })
    expect(unwrapRes.status).toBe(200)
    expect(unwrapRes.body.success).toBe(true)
    expect(unwrapRes.body.data.amount).toBeDefined()
  })
})
