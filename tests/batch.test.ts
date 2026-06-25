import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation(function () { return ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
      getSignaturesForAddress: vi.fn().mockResolvedValue([]),
      getTransaction: vi.fn().mockResolvedValue(null),
    }) }),
  }
})

const { default: app } = await import('../src/server.js')

// ─── Stealth Batch ────────────────────────────────────────────────────────────

describe('POST /v1/stealth/generate/batch', () => {
  it('generates multiple stealth keypairs', async () => {
    const res = await request(app)
      .post('/v1/stealth/generate/batch')
      .send({ count: 3 })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.results).toHaveLength(3)
    expect(res.body.data.summary).toEqual({ total: 3, succeeded: 3, failed: 0 })

    for (const item of res.body.data.results) {
      expect(item.success).toBe(true)
      expect(item.data.metaAddress.chain).toBe('solana')
      expect(item.data.metaAddress.spendingKey).toMatch(/^0x[0-9a-f]{64}$/)
      expect(item.data.spendingPrivateKey).toMatch(/^0x[0-9a-f]{64}$/)
    }
  })

  it('generates unique keypairs per item', async () => {
    const res = await request(app)
      .post('/v1/stealth/generate/batch')
      .send({ count: 2 })
    const [a, b] = res.body.data.results
    expect(a.data.spendingPrivateKey).not.toBe(b.data.spendingPrivateKey)
  })

  it('applies label to all generated keypairs', async () => {
    const res = await request(app)
      .post('/v1/stealth/generate/batch')
      .send({ count: 2, label: 'Agent Fleet' })
    expect(res.body.data.results[0].data.metaAddress.label).toBe('Agent Fleet')
    expect(res.body.data.results[1].data.metaAddress.label).toBe('Agent Fleet')
  })

  it('rejects count exceeding 100', async () => {
    const res = await request(app)
      .post('/v1/stealth/generate/batch')
      .send({ count: 101 })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects count of 0', async () => {
    const res = await request(app)
      .post('/v1/stealth/generate/batch')
      .send({ count: 0 })
    expect(res.status).toBe(400)
  })

  it('rejects missing count', async () => {
    const res = await request(app)
      .post('/v1/stealth/generate/batch')
      .send({})
    expect(res.status).toBe(400)
  })
})

// ─── Commitment Batch ─────────────────────────────────────────────────────────

describe('POST /v1/commitment/create/batch', () => {
  it('creates multiple commitments', async () => {
    const res = await request(app)
      .post('/v1/commitment/create/batch')
      .send({
        items: [
          { value: '1000000' },
          { value: '2000000' },
          { value: '3000000' },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.results).toHaveLength(3)
    expect(res.body.data.summary).toEqual({ total: 3, succeeded: 3, failed: 0 })

    for (const item of res.body.data.results) {
      expect(item.success).toBe(true)
      expect(item.data.commitment).toMatch(/^0x/)
      expect(item.data.blindingFactor).toMatch(/^0x/)
    }
  })

  it('creates unique commitments for same values (random blinding)', async () => {
    const res = await request(app)
      .post('/v1/commitment/create/batch')
      .send({
        items: [{ value: '1000000' }, { value: '1000000' }],
      })
    expect(res.body.data.results[0].data.commitment).not.toBe(
      res.body.data.results[1].data.commitment
    )
  })

  it('rejects empty items array', async () => {
    const res = await request(app)
      .post('/v1/commitment/create/batch')
      .send({ items: [] })
    expect(res.status).toBe(400)
  })

  it('rejects items exceeding 100', async () => {
    const items = Array.from({ length: 101 }, (_, i) => ({ value: String(i + 1) }))
    const res = await request(app)
      .post('/v1/commitment/create/batch')
      .send({ items })
    expect(res.status).toBe(400)
  })

  it('includes per-item index in results', async () => {
    const res = await request(app)
      .post('/v1/commitment/create/batch')
      .send({
        items: [{ value: '100' }, { value: '200' }],
      })
    expect(res.body.data.results[0].index).toBe(0)
    expect(res.body.data.results[1].index).toBe(1)
  })
})

// ─── Scan Batch ───────────────────────────────────────────────────────────────

describe('POST /v1/scan/payments/batch', () => {
  it('scans for payments across multiple key pairs', async () => {
    const res = await request(app)
      .post('/v1/scan/payments/batch')
      .send({
        keyPairs: [
          {
            viewingPrivateKey: '0x' + '0'.repeat(64),
            spendingPublicKey: '0x' + '0'.repeat(64),
            label: 'Wallet A',
          },
          {
            viewingPrivateKey: '0x' + '1'.repeat(64),
            spendingPublicKey: '0x' + '1'.repeat(64),
            label: 'Wallet B',
          },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.results).toHaveLength(2)
    expect(res.body.data.results[0].label).toBe('Wallet A')
    expect(res.body.data.results[1].label).toBe('Wallet B')
    expect(res.body.data.summary.totalKeyPairs).toBe(2)
    expect(res.body.data.summary.totalPaymentsFound).toBe(0)
  })

  it('rejects empty keyPairs', async () => {
    const res = await request(app)
      .post('/v1/scan/payments/batch')
      .send({ keyPairs: [] })
    expect(res.status).toBe(400)
  })

  it('rejects keyPairs exceeding 100', async () => {
    const keyPairs = Array.from({ length: 101 }, () => ({
      viewingPrivateKey: '0x' + '0'.repeat(64),
      spendingPublicKey: '0x' + '0'.repeat(64),
    }))
    const res = await request(app)
      .post('/v1/scan/payments/batch')
      .send({ keyPairs })
    expect(res.status).toBe(400)
  })

  it('includes per-keypair success status', async () => {
    const res = await request(app)
      .post('/v1/scan/payments/batch')
      .send({
        keyPairs: [
          {
            viewingPrivateKey: '0x' + 'ab'.repeat(32),
            spendingPublicKey: '0x' + 'cd'.repeat(32),
          },
        ],
      })
    expect(res.body.data.results[0].success).toBe(true)
    expect(res.body.data.results[0].data.scanned).toBeTypeOf('number')
  })
})
