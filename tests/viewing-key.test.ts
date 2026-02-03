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

describe('POST /v1/viewing-key/generate', () => {
  it('generates viewing key with default path', async () => {
    const res = await request(app)
      .post('/v1/viewing-key/generate')
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.key).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.body.data.path).toBe('m/0')
    expect(res.body.data.hash).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('generates viewing key with custom path', async () => {
    const res = await request(app)
      .post('/v1/viewing-key/generate')
      .send({ path: 'm/1/audit' })
    expect(res.status).toBe(200)
    expect(res.body.data.path).toBe('m/1/audit')
  })

  it('generates unique keys each time', async () => {
    const res1 = await request(app).post('/v1/viewing-key/generate').send({})
    const res2 = await request(app).post('/v1/viewing-key/generate').send({})
    expect(res1.body.data.key).not.toBe(res2.body.data.key)
  })
})

describe('POST /v1/viewing-key/disclose', () => {
  it('encrypts transaction data for viewing', async () => {
    // Generate a viewing key first
    const genRes = await request(app)
      .post('/v1/viewing-key/generate')
      .send({})
    const vk = genRes.body.data

    const res = await request(app)
      .post('/v1/viewing-key/disclose')
      .send({
        viewingKey: vk,
        transactionData: {
          sender: 'sender-address',
          recipient: 'recipient-stealth-address',
          amount: '1000000000',
          timestamp: Date.now(),
        },
      })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.ciphertext).toMatch(/^0x[0-9a-f]+$/)
    expect(res.body.data.nonce).toMatch(/^0x[0-9a-f]+$/)
    expect(res.body.data.viewingKeyHash).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('produces different ciphertext for same data (random nonce)', async () => {
    const genRes = await request(app).post('/v1/viewing-key/generate').send({})
    const vk = genRes.body.data

    const payload = {
      viewingKey: vk,
      transactionData: {
        sender: 'addr1',
        recipient: 'addr2',
        amount: '100',
        timestamp: 1700000000,
      },
    }

    const res1 = await request(app).post('/v1/viewing-key/disclose').send(payload)
    const res2 = await request(app).post('/v1/viewing-key/disclose').send(payload)
    expect(res1.body.data.ciphertext).not.toBe(res2.body.data.ciphertext)
    expect(res1.body.data.nonce).not.toBe(res2.body.data.nonce)
  })

  it('validates schema', async () => {
    const res = await request(app)
      .post('/v1/viewing-key/disclose')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})
