import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import {
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '@sip-protocol/sdk'

const { mockGetSignaturesForAddress, mockGetTransaction } = vi.hoisted(() => ({
  mockGetSignaturesForAddress: vi.fn(),
  mockGetTransaction: vi.fn(),
}))

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation(() => ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
      getSignaturesForAddress: mockGetSignaturesForAddress,
      getTransaction: mockGetTransaction,
    })),
  }
})

const { default: app } = await import('../src/server.js')

const VALID_HEX = '0x' + 'ab'.repeat(32)

beforeEach(() => {
  mockGetSignaturesForAddress.mockReset().mockResolvedValue([])
  mockGetTransaction.mockReset().mockResolvedValue(null)
})

describe('POST /v1/scan/payments', () => {
  it('returns empty payments array when no announcements found', async () => {
    const res = await request(app)
      .post('/v1/scan/payments')
      .send({
        viewingPrivateKey: VALID_HEX,
        spendingPublicKey: VALID_HEX,
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.payments).toEqual([])
    expect(res.body.data.scanned).toBe(0)
  })

  it('uses default limit of 100', async () => {
    const res = await request(app)
      .post('/v1/scan/payments')
      .send({
        viewingPrivateKey: VALID_HEX,
        spendingPublicKey: VALID_HEX,
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('accepts custom limit', async () => {
    const res = await request(app)
      .post('/v1/scan/payments')
      .send({
        viewingPrivateKey: VALID_HEX,
        spendingPublicKey: VALID_HEX,
        limit: 50,
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('accepts fromSlot parameter', async () => {
    const res = await request(app)
      .post('/v1/scan/payments')
      .send({
        viewingPrivateKey: VALID_HEX,
        spendingPublicKey: VALID_HEX,
        fromSlot: 300000000,
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('accepts toSlot parameter', async () => {
    const res = await request(app)
      .post('/v1/scan/payments')
      .send({
        viewingPrivateKey: VALID_HEX,
        spendingPublicKey: VALID_HEX,
        fromSlot: 300000000,
        toSlot: 300001000,
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('rejects missing viewingPrivateKey', async () => {
    const res = await request(app)
      .post('/v1/scan/payments')
      .send({
        spendingPublicKey: VALID_HEX,
      })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects missing spendingPublicKey', async () => {
    const res = await request(app)
      .post('/v1/scan/payments')
      .send({
        viewingPrivateKey: VALID_HEX,
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects invalid hex keys', async () => {
    const res = await request(app)
      .post('/v1/scan/payments')
      .send({
        viewingPrivateKey: 'not-hex',
        spendingPublicKey: VALID_HEX,
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects empty body', async () => {
    const res = await request(app)
      .post('/v1/scan/payments')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('rejects limit exceeding maximum (1000)', async () => {
    const res = await request(app)
      .post('/v1/scan/payments')
      .send({
        viewingPrivateKey: VALID_HEX,
        spendingPublicKey: VALID_HEX,
        limit: 1001,
      })

    expect(res.status).toBe(400)
  })

  it('rejects limit of zero', async () => {
    const res = await request(app)
      .post('/v1/scan/payments')
      .send({
        viewingPrivateKey: VALID_HEX,
        spendingPublicKey: VALID_HEX,
        limit: 0,
      })

    expect(res.status).toBe(400)
  })

  it('rejects negative fromSlot', async () => {
    const res = await request(app)
      .post('/v1/scan/payments')
      .send({
        viewingPrivateKey: VALID_HEX,
        spendingPublicKey: VALID_HEX,
        fromSlot: -1,
      })

    expect(res.status).toBe(400)
  })

  it('finds a matching announcement (canonical view-only round-trip)', async () => {
    // A sender derived this stealth address + announcement for our meta-address.
    const meta = generateEd25519StealthMetaAddress('solana')
    const stealth = generateEd25519StealthAddress(meta.metaAddress)
    const ephB58 = ed25519PublicKeyToSolanaAddress(stealth.stealthAddress.ephemeralPublicKey)
    const stealthB58 = ed25519PublicKeyToSolanaAddress(stealth.stealthAddress.address)
    const viewTagHex = stealth.stealthAddress.viewTag.toString(16)

    mockGetSignaturesForAddress.mockResolvedValueOnce([
      { signature: 'pos-sig', slot: 300000001, blockTime: 1_700_000_000 },
    ])
    mockGetTransaction.mockResolvedValueOnce({
      meta: { logMessages: [`Program log: SIP:${ephB58}:${viewTagHex}:${stealthB58}`] },
    })

    // Scan with ONLY the viewing private key + spending PUBLIC key (view-only).
    const res = await request(app)
      .post('/v1/scan/payments')
      .send({
        viewingPrivateKey: meta.viewingPrivateKey,
        spendingPublicKey: meta.metaAddress.spendingKey,
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.payments).toHaveLength(1)
    expect(res.body.data.payments[0].stealthAddress).toBe(stealthB58)
    expect(res.body.data.payments[0].ephemeralPublicKey).toBe(ephB58)
    expect(res.body.data.payments[0].txSignature).toBe('pos-sig')
  })
})
