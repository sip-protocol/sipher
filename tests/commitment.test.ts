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

describe('POST /v1/commitment/create', () => {
  it('creates commitment with random blinding', async () => {
    const res = await request(app)
      .post('/v1/commitment/create')
      .send({ value: '1000000000' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.commitment).toMatch(/^0x[0-9a-f]+$/)
    expect(res.body.data.blindingFactor).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('creates commitment with provided blinding factor', async () => {
    const blinding = '0x' + 'ab'.repeat(32)
    const res = await request(app)
      .post('/v1/commitment/create')
      .send({ value: '500', blindingFactor: blinding })
    expect(res.status).toBe(200)
    expect(res.body.data.blindingFactor).toBe(blinding)
  })

  it('creates commitment for zero value', async () => {
    const res = await request(app)
      .post('/v1/commitment/create')
      .send({ value: '0' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('rejects negative value', async () => {
    const res = await request(app)
      .post('/v1/commitment/create')
      .send({ value: '-100' })
    expect(res.status).toBe(400)
  })

  it('rejects non-numeric value', async () => {
    const res = await request(app)
      .post('/v1/commitment/create')
      .send({ value: 'abc' })
    expect(res.status).toBe(400)
  })

  it('creates deterministic commitments with same inputs', async () => {
    const blinding = '0x' + 'cd'.repeat(32)
    const res1 = await request(app)
      .post('/v1/commitment/create')
      .send({ value: '42', blindingFactor: blinding })
    const res2 = await request(app)
      .post('/v1/commitment/create')
      .send({ value: '42', blindingFactor: blinding })
    expect(res1.body.data.commitment).toBe(res2.body.data.commitment)
  })

  it('creates different commitments for different values', async () => {
    const blinding = '0x' + 'ef'.repeat(32)
    const res1 = await request(app)
      .post('/v1/commitment/create')
      .send({ value: '100', blindingFactor: blinding })
    const res2 = await request(app)
      .post('/v1/commitment/create')
      .send({ value: '200', blindingFactor: blinding })
    expect(res1.body.data.commitment).not.toBe(res2.body.data.commitment)
  })
})

describe('POST /v1/commitment/verify', () => {
  it('verifies valid commitment', async () => {
    // Create commitment first
    const createRes = await request(app)
      .post('/v1/commitment/create')
      .send({ value: '1000' })
    const { commitment, blindingFactor } = createRes.body.data

    // Verify it
    const verifyRes = await request(app)
      .post('/v1/commitment/verify')
      .send({ commitment, value: '1000', blindingFactor })
    expect(verifyRes.status).toBe(200)
    expect(verifyRes.body.data.valid).toBe(true)
  })

  it('rejects wrong value', async () => {
    const createRes = await request(app)
      .post('/v1/commitment/create')
      .send({ value: '1000' })
    const { commitment, blindingFactor } = createRes.body.data

    const verifyRes = await request(app)
      .post('/v1/commitment/verify')
      .send({ commitment, value: '999', blindingFactor })
    expect(verifyRes.body.data.valid).toBe(false)
  })

  it('rejects wrong blinding factor', async () => {
    const createRes = await request(app)
      .post('/v1/commitment/create')
      .send({ value: '1000' })
    const { commitment } = createRes.body.data
    const wrongBlinding = '0x' + '11'.repeat(32)

    const verifyRes = await request(app)
      .post('/v1/commitment/verify')
      .send({ commitment, value: '1000', blindingFactor: wrongBlinding })
    expect(verifyRes.body.data.valid).toBe(false)
  })

  it('validates request schema', async () => {
    const res = await request(app)
      .post('/v1/commitment/verify')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})
