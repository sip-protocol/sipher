import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { clearIdempotencyCache } from '../src/middleware/idempotency.js'

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation(function () { return ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
      getLatestBlockhash: vi.fn().mockResolvedValue({
        blockhash: 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N',
        lastValidBlockHeight: 300000100,
      }),
    }) }),
  }
})

const { default: app } = await import('../src/server.js')

describe('Idempotency middleware', () => {
  beforeEach(() => {
    clearIdempotencyCache()
  })

  it('first request processes normally', async () => {
    const key = crypto.randomUUID()
    const res = await request(app)
      .post('/v1/commitment/create')
      .set('Idempotency-Key', key)
      .send({ value: '100' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.headers['idempotency-replayed']).toBeUndefined()
  })

  it('duplicate request returns cached response', async () => {
    const key = crypto.randomUUID()

    const first = await request(app)
      .post('/v1/commitment/create')
      .set('Idempotency-Key', key)
      .send({ value: '200' })

    expect(first.status).toBe(200)
    expect(first.body.data.commitment).toBeDefined()

    const second = await request(app)
      .post('/v1/commitment/create')
      .set('Idempotency-Key', key)
      .send({ value: '200' })

    expect(second.status).toBe(200)
    expect(second.headers['idempotency-replayed']).toBe('true')
    expect(second.body.data.commitment).toBe(first.body.data.commitment)
    expect(second.body.data.blindingFactor).toBe(first.body.data.blindingFactor)
  })

  it('different keys return different responses', async () => {
    const key1 = crypto.randomUUID()
    const key2 = crypto.randomUUID()

    const first = await request(app)
      .post('/v1/commitment/create')
      .set('Idempotency-Key', key1)
      .send({ value: '300' })

    const second = await request(app)
      .post('/v1/commitment/create')
      .set('Idempotency-Key', key2)
      .send({ value: '300' })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(first.headers['idempotency-replayed']).toBeUndefined()
    expect(second.headers['idempotency-replayed']).toBeUndefined()
    // Different blinding factors = different commitments
    expect(first.body.data.blindingFactor).not.toBe(second.body.data.blindingFactor)
  })

  it('request without idempotency key proceeds normally', async () => {
    const res = await request(app)
      .post('/v1/commitment/create')
      .send({ value: '400' })

    expect(res.status).toBe(200)
    expect(res.headers['idempotency-replayed']).toBeUndefined()
  })

  it('rejects invalid idempotency key format', async () => {
    const res = await request(app)
      .post('/v1/commitment/create')
      .set('Idempotency-Key', 'not-a-uuid')
      .send({ value: '500' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_IDEMPOTENCY_KEY')
  })

  it('caches error responses too', async () => {
    const key = crypto.randomUUID()

    const first = await request(app)
      .post('/v1/commitment/create')
      .set('Idempotency-Key', key)
      .send({}) // missing value

    expect(first.status).toBe(400)

    const second = await request(app)
      .post('/v1/commitment/create')
      .set('Idempotency-Key', key)
      .send({})

    expect(second.status).toBe(400)
    expect(second.headers['idempotency-replayed']).toBe('true')
  })

  it('idempotency works on /v1/viewing-key/disclose', async () => {
    const key = crypto.randomUUID()
    // Using generate first to get a valid viewing key
    const genRes = await request(app)
      .post('/v1/viewing-key/generate')
      .send({ path: 'm/0' })

    const viewingKey = genRes.body.data

    const body = {
      viewingKey,
      transactionData: {
        sender: 'Alice',
        recipient: 'Bob',
        amount: '1000',
        timestamp: 1700000000,
      },
    }

    const first = await request(app)
      .post('/v1/viewing-key/disclose')
      .set('Idempotency-Key', key)
      .send(body)

    expect(first.status).toBe(200)

    const second = await request(app)
      .post('/v1/viewing-key/disclose')
      .set('Idempotency-Key', key)
      .send(body)

    expect(second.status).toBe(200)
    expect(second.headers['idempotency-replayed']).toBe('true')
    expect(second.body.data.ciphertext).toBe(first.body.data.ciphertext)
  })
})
