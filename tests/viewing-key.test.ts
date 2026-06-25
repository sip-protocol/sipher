import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation(function () { return ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    }) }),
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

describe('POST /v1/viewing-key/decrypt', () => {
  it('decrypts previously encrypted transaction data', async () => {
    const genRes = await request(app).post('/v1/viewing-key/generate').send({})
    const vk = genRes.body.data

    const txData = {
      sender: 'AliceSolanaAddr',
      recipient: 'BobStealthAddr',
      amount: '1000000000',
      timestamp: 1700000000,
    }

    const encRes = await request(app)
      .post('/v1/viewing-key/disclose')
      .send({ viewingKey: vk, transactionData: txData })

    const decRes = await request(app)
      .post('/v1/viewing-key/decrypt')
      .send({
        viewingKey: vk,
        encrypted: {
          ciphertext: encRes.body.data.ciphertext,
          nonce: encRes.body.data.nonce,
          viewingKeyHash: encRes.body.data.viewingKeyHash,
        },
      })

    expect(decRes.status).toBe(200)
    expect(decRes.body.success).toBe(true)
    expect(decRes.body.data.sender).toBe(txData.sender)
    expect(decRes.body.data.recipient).toBe(txData.recipient)
    expect(decRes.body.data.amount).toBe(txData.amount)
    expect(decRes.body.data.timestamp).toBe(txData.timestamp)
  })

  it('fails with wrong viewing key', async () => {
    const vk1Res = await request(app).post('/v1/viewing-key/generate').send({})
    const vk2Res = await request(app).post('/v1/viewing-key/generate').send({})
    const vk1 = vk1Res.body.data
    const vk2 = vk2Res.body.data

    const encRes = await request(app)
      .post('/v1/viewing-key/disclose')
      .send({
        viewingKey: vk1,
        transactionData: {
          sender: 'Alice',
          recipient: 'Bob',
          amount: '100',
          timestamp: 1700000000,
        },
      })

    const decRes = await request(app)
      .post('/v1/viewing-key/decrypt')
      .send({
        viewingKey: vk2,
        encrypted: {
          ciphertext: encRes.body.data.ciphertext,
          nonce: encRes.body.data.nonce,
          viewingKeyHash: encRes.body.data.viewingKeyHash,
        },
      })

    // Should fail (500) because wrong key can't decrypt
    expect(decRes.status).toBeGreaterThanOrEqual(400)
    expect(decRes.body.success).toBe(false)
  })

  it('validates schema', async () => {
    const res = await request(app)
      .post('/v1/viewing-key/decrypt')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects invalid ciphertext format', async () => {
    const genRes = await request(app).post('/v1/viewing-key/generate').send({})
    const vk = genRes.body.data

    const res = await request(app)
      .post('/v1/viewing-key/decrypt')
      .send({
        viewingKey: vk,
        encrypted: {
          ciphertext: 'not-hex',
          nonce: '0x' + 'ab'.repeat(12),
          viewingKeyHash: vk.hash,
        },
      })
    expect(res.status).toBe(400)
  })
})
