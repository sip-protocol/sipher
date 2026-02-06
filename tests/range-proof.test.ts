import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { resetStarkProvider, decomposeToM31Limbs, reconstructFromM31Limbs, M31_PRIME, NUM_LIMBS } from '../src/services/stark-provider.js'

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

// ─── Fixtures ───────────────────────────────────────────────────────────────

const hex32 = '0x' + 'ab'.repeat(32)

const validInput = {
  value: '1000000000',
  threshold: '500000000',
  blindingFactor: hex32,
}

// ─── Generate ───────────────────────────────────────────────────────────────

describe('POST /v1/proofs/range/generate', () => {
  beforeEach(() => resetStarkProvider())

  it('generates range proof without commitment (auto-created)', async () => {
    const res = await request(app)
      .post('/v1/proofs/range/generate')
      .send(validInput)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.beta).toBe(true)
    expect(res.body.data.proof.type).toBe('range')
    expect(res.body.data.proof.proof).toMatch(/^0x[0-9a-fA-F]{64}$/)
    expect(res.body.data.proof.publicInputs).toHaveLength(2)
    expect(res.body.data.commitment).toMatch(/^0x/)
    expect(res.body.data.metadata.prover).toBe('mock-stark')
    expect(res.body.data.metadata.decomposition).toBe('m31-limbs')
    expect(res.body.data.metadata.limbCount).toBe(9)
  })

  it('generates range proof with existing commitment', async () => {
    // Create a commitment first
    const commitRes = await request(app)
      .post('/v1/commitment/create')
      .send({ value: '1000000000', blindingFactor: hex32 })
    expect(commitRes.status).toBe(200)
    const existingCommitment = commitRes.body.data.commitment

    const res = await request(app)
      .post('/v1/proofs/range/generate')
      .send({ ...validInput, commitment: existingCommitment })
    expect(res.status).toBe(200)
    expect(res.body.data.commitment).toBe(existingCommitment)
  })

  it('rejects value < threshold → 400 PROOF_GENERATION_FAILED', async () => {
    const res = await request(app)
      .post('/v1/proofs/range/generate')
      .send({ ...validInput, value: '100', threshold: '500' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('PROOF_GENERATION_FAILED')
  })

  it('rejects missing fields → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/v1/proofs/range/generate')
      .send({ value: '1000' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects bad hex blinding → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/v1/proofs/range/generate')
      .send({ ...validInput, blindingFactor: '0xZZZZ' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('includes beta warning in response', async () => {
    const res = await request(app)
      .post('/v1/proofs/range/generate')
      .send(validInput)
    expect(res.status).toBe(200)
    expect(res.body.warning).toContain('beta')
    expect(res.headers['x-beta']).toBe('true')
  })
})

// ─── Verify ─────────────────────────────────────────────────────────────────

describe('POST /v1/proofs/range/verify', () => {
  beforeEach(() => resetStarkProvider())

  it('round-trip: generate → verify → valid: true', async () => {
    const genRes = await request(app)
      .post('/v1/proofs/range/generate')
      .send(validInput)
    expect(genRes.status).toBe(200)

    const { proof } = genRes.body.data
    const res = await request(app)
      .post('/v1/proofs/range/verify')
      .send(proof)
    expect(res.status).toBe(200)
    expect(res.body.data.valid).toBe(true)
  })

  it('tampered proof → valid: false', async () => {
    const genRes = await request(app)
      .post('/v1/proofs/range/generate')
      .send(validInput)
    const { proof } = genRes.body.data

    const res = await request(app)
      .post('/v1/proofs/range/verify')
      .send({ ...proof, proof: '0xdeadbeef' + 'ab'.repeat(30) })
    expect(res.status).toBe(200)
    expect(res.body.data.valid).toBe(false)
  })

  it('rejects wrong type discriminator → 400', async () => {
    const genRes = await request(app)
      .post('/v1/proofs/range/generate')
      .send(validInput)
    const { proof } = genRes.body.data

    const res = await request(app)
      .post('/v1/proofs/range/verify')
      .send({ ...proof, type: 'funding' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects non-hex proof → 400', async () => {
    const res = await request(app)
      .post('/v1/proofs/range/verify')
      .send({ type: 'range', proof: 'not-hex', publicInputs: [] })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe('Range proof edge cases', () => {
  beforeEach(() => resetStarkProvider())

  it('zero value and threshold (0 >= 0)', async () => {
    const res = await request(app)
      .post('/v1/proofs/range/generate')
      .send({ value: '0', threshold: '0', blindingFactor: hex32 })
    expect(res.status).toBe(200)
    expect(res.body.data.proof.type).toBe('range')
  })

  it('equal value and threshold', async () => {
    const res = await request(app)
      .post('/v1/proofs/range/generate')
      .send({ value: '999', threshold: '999', blindingFactor: hex32 })
    expect(res.status).toBe(200)
    expect(res.body.data.proof.type).toBe('range')
  })

  it('large 256-bit value', async () => {
    const largeValue = (2n ** 255n).toString()
    const res = await request(app)
      .post('/v1/proofs/range/generate')
      .send({ value: largeValue, threshold: '0', blindingFactor: hex32 })
    expect(res.status).toBe(200)
    expect(res.body.data.metadata.limbCount).toBe(9)
  })
})

// ─── Idempotency ────────────────────────────────────────────────────────────

describe('Range proof idempotency', () => {
  beforeEach(() => resetStarkProvider())

  it('returns cached response with Idempotency-Replayed header', async () => {
    const key = '550e8400-e29b-41d4-a716-446655440000'
    const first = await request(app)
      .post('/v1/proofs/range/generate')
      .set('Idempotency-Key', key)
      .send(validInput)
    expect(first.status).toBe(200)

    const second = await request(app)
      .post('/v1/proofs/range/generate')
      .set('Idempotency-Key', key)
      .send(validInput)
    expect(second.status).toBe(200)
    expect(second.headers['idempotency-replayed']).toBe('true')
    expect(second.body.data.proof.proof).toBe(first.body.data.proof.proof)
  })

  it('rejects invalid idempotency key format → 400', async () => {
    const res = await request(app)
      .post('/v1/proofs/range/generate')
      .set('Idempotency-Key', 'not-a-uuid')
      .send(validInput)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_IDEMPOTENCY_KEY')
  })
})

// ─── M31 Limb Math (Unit) ───────────────────────────────────────────────────

describe('M31 limb decomposition', () => {
  it('decomposes and reconstructs small values', () => {
    const value = 42n
    const limbs = decomposeToM31Limbs(value)
    expect(limbs).toHaveLength(NUM_LIMBS)
    expect(reconstructFromM31Limbs(limbs)).toBe(value)
  })

  it('decomposes and reconstructs large 256-bit values', () => {
    const value = 2n ** 255n + 123456789n
    const limbs = decomposeToM31Limbs(value)
    expect(limbs).toHaveLength(NUM_LIMBS)
    expect(reconstructFromM31Limbs(limbs)).toBe(value)
    for (const limb of limbs) {
      expect(limb).toBeLessThan(M31_PRIME)
      expect(limb).toBeGreaterThanOrEqual(0n)
    }
  })

  it('handles zero', () => {
    const limbs = decomposeToM31Limbs(0n)
    expect(limbs.every(l => l === 0n)).toBe(true)
    expect(reconstructFromM31Limbs(limbs)).toBe(0n)
  })
})
