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

describe('POST /v1/stealth/generate', () => {
  it('generates stealth meta-address with default label', async () => {
    const res = await request(app)
      .post('/v1/stealth/generate')
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.metaAddress).toBeDefined()
    expect(res.body.data.metaAddress.chain).toBe('solana')
    expect(res.body.data.metaAddress.spendingKey).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.body.data.metaAddress.viewingKey).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.body.data.spendingPrivateKey).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.body.data.viewingPrivateKey).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('generates stealth meta-address with custom label', async () => {
    const res = await request(app)
      .post('/v1/stealth/generate')
      .send({ label: 'Agent Wallet' })
    expect(res.status).toBe(200)
    expect(res.body.data.metaAddress.label).toBe('Agent Wallet')
  })

  it('generates unique keypairs each time', async () => {
    const res1 = await request(app).post('/v1/stealth/generate').send({})
    const res2 = await request(app).post('/v1/stealth/generate').send({})
    expect(res1.body.data.spendingPrivateKey).not.toBe(res2.body.data.spendingPrivateKey)
    expect(res1.body.data.viewingPrivateKey).not.toBe(res2.body.data.viewingPrivateKey)
  })
})

describe('POST /v1/stealth/derive', () => {
  it('derives stealth address from meta-address', async () => {
    // First generate a meta-address
    const genRes = await request(app).post('/v1/stealth/generate').send({})
    const { metaAddress } = genRes.body.data

    const res = await request(app)
      .post('/v1/stealth/derive')
      .send({ recipientMetaAddress: metaAddress })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.stealthAddress).toBeDefined()
    expect(res.body.data.stealthAddress.address).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.body.data.stealthAddress.ephemeralPublicKey).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.body.data.stealthAddress.viewTag).toBeTypeOf('number')
    expect(res.body.data.sharedSecret).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('rejects invalid meta-address', async () => {
    const res = await request(app)
      .post('/v1/stealth/derive')
      .send({
        recipientMetaAddress: {
          spendingKey: 'invalid',
          viewingKey: '0x1234',
          chain: 'solana',
        },
      })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects non-solana chain', async () => {
    const res = await request(app)
      .post('/v1/stealth/derive')
      .send({
        recipientMetaAddress: {
          spendingKey: '0x' + '0'.repeat(64),
          viewingKey: '0x' + '0'.repeat(64),
          chain: 'ethereum',
        },
      })
    expect(res.status).toBe(400)
  })

  it('derives different addresses each call (ephemeral key randomness)', async () => {
    const genRes = await request(app).post('/v1/stealth/generate').send({})
    const { metaAddress } = genRes.body.data

    const res1 = await request(app).post('/v1/stealth/derive').send({ recipientMetaAddress: metaAddress })
    const res2 = await request(app).post('/v1/stealth/derive').send({ recipientMetaAddress: metaAddress })

    expect(res1.body.data.stealthAddress.address).not.toBe(res2.body.data.stealthAddress.address)
  })
})

describe('POST /v1/stealth/check', () => {
  it('returns true for matching stealth address', async () => {
    // Generate meta-address
    const genRes = await request(app).post('/v1/stealth/generate').send({})
    const { metaAddress, spendingPrivateKey, viewingPrivateKey } = genRes.body.data

    // Derive stealth address
    const deriveRes = await request(app)
      .post('/v1/stealth/derive')
      .send({ recipientMetaAddress: metaAddress })
    const { stealthAddress } = deriveRes.body.data

    // Check ownership
    const checkRes = await request(app)
      .post('/v1/stealth/check')
      .send({
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey,
      })
    expect(checkRes.status).toBe(200)
    expect(checkRes.body.data.isOwner).toBe(true)
  })

  it('returns false for non-matching keys', async () => {
    // Generate two different meta-addresses
    const gen1 = await request(app).post('/v1/stealth/generate').send({})
    const gen2 = await request(app).post('/v1/stealth/generate').send({})

    // Derive stealth address from first
    const deriveRes = await request(app)
      .post('/v1/stealth/derive')
      .send({ recipientMetaAddress: gen1.body.data.metaAddress })

    // Check with second's keys
    const checkRes = await request(app)
      .post('/v1/stealth/check')
      .send({
        stealthAddress: deriveRes.body.data.stealthAddress,
        spendingPrivateKey: gen2.body.data.spendingPrivateKey,
        viewingPrivateKey: gen2.body.data.viewingPrivateKey,
      })
    expect(checkRes.status).toBe(200)
    expect(checkRes.body.data.isOwner).toBe(false)
  })

  it('validates input schemas', async () => {
    const res = await request(app)
      .post('/v1/stealth/check')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})
