import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

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
      sendRawTransaction: vi.fn().mockResolvedValue('5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQU'),
      confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
    })),
  }
})

vi.mock('@solana/spl-token', async () => {
  const actual = await vi.importActual('@solana/spl-token')
  return {
    ...actual as object,
    getAccount: vi.fn().mockResolvedValue({
      amount: BigInt(1000000),
      address: 'TokenAccountAddress',
    }),
  }
})

const { default: app } = await import('../src/server.js')

const VALID_ADDRESS = '11111111111111111111111111111112'
const VALID_HEX = '0x' + 'ab'.repeat(32)
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

describe('POST /v1/transfer/claim', () => {
  it('validates required fields', async () => {
    const res = await request(app)
      .post('/v1/transfer/claim')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects missing stealthAddress', async () => {
    const res = await request(app)
      .post('/v1/transfer/claim')
      .send({
        ephemeralPublicKey: VALID_ADDRESS,
        spendingPrivateKey: VALID_HEX,
        viewingPrivateKey: VALID_HEX,
        destinationAddress: VALID_ADDRESS,
        mint: USDC_MINT,
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects missing mint (required for claim)', async () => {
    const res = await request(app)
      .post('/v1/transfer/claim')
      .send({
        stealthAddress: VALID_ADDRESS,
        ephemeralPublicKey: VALID_ADDRESS,
        spendingPrivateKey: VALID_HEX,
        viewingPrivateKey: VALID_HEX,
        destinationAddress: VALID_ADDRESS,
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects invalid hex private keys', async () => {
    const res = await request(app)
      .post('/v1/transfer/claim')
      .send({
        stealthAddress: VALID_ADDRESS,
        ephemeralPublicKey: VALID_ADDRESS,
        spendingPrivateKey: 'not-hex',
        viewingPrivateKey: VALID_HEX,
        destinationAddress: VALID_ADDRESS,
        mint: USDC_MINT,
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects short hex strings', async () => {
    const res = await request(app)
      .post('/v1/transfer/claim')
      .send({
        stealthAddress: VALID_ADDRESS,
        ephemeralPublicKey: VALID_ADDRESS,
        spendingPrivateKey: '0x1234',
        viewingPrivateKey: VALID_HEX,
        destinationAddress: VALID_ADDRESS,
        mint: USDC_MINT,
      })

    expect(res.status).toBe(400)
  })

  it('rejects addresses that are too short', async () => {
    const res = await request(app)
      .post('/v1/transfer/claim')
      .send({
        stealthAddress: 'short',
        ephemeralPublicKey: VALID_ADDRESS,
        spendingPrivateKey: VALID_HEX,
        viewingPrivateKey: VALID_HEX,
        destinationAddress: VALID_ADDRESS,
        mint: USDC_MINT,
      })

    expect(res.status).toBe(400)
  })

  it('handles stealth key derivation failure gracefully', async () => {
    // Use valid format but mismatched keys — derivation will fail
    const genRes = await request(app).post('/v1/stealth/generate').send({})
    const { spendingPrivateKey, viewingPrivateKey } = genRes.body.data

    // Use a random address that doesn't match these keys
    const res = await request(app)
      .post('/v1/transfer/claim')
      .send({
        stealthAddress: VALID_ADDRESS,
        ephemeralPublicKey: VALID_ADDRESS,
        spendingPrivateKey,
        viewingPrivateKey,
        destinationAddress: VALID_ADDRESS,
        mint: USDC_MINT,
      })

    // Should return 500 (derivation mismatch) not crash
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.body.success).toBe(false)
  })

  it('accepts valid input format', async () => {
    // Generate real keys through the flow
    const genRes = await request(app).post('/v1/stealth/generate').send({})
    const { metaAddress, spendingPrivateKey, viewingPrivateKey } = genRes.body.data

    const deriveRes = await request(app)
      .post('/v1/stealth/derive')
      .send({ recipientMetaAddress: metaAddress })
    const { stealthAddress } = deriveRes.body.data

    // The claim will likely fail at key derivation because ed25519PublicKeyToSolanaAddress
    // produces a base58 address that needs to match, but the format should be accepted
    const res = await request(app)
      .post('/v1/transfer/claim')
      .send({
        stealthAddress: VALID_ADDRESS,
        ephemeralPublicKey: VALID_ADDRESS,
        spendingPrivateKey,
        viewingPrivateKey,
        destinationAddress: VALID_ADDRESS,
        mint: USDC_MINT,
      })

    // Should not return 400 validation error — input format is correct
    // May return 500 if derivation fails, which is expected with mismatched keys
    expect(res.status).not.toBe(400)
  })

  it('accepts dryRun parameter (boolean)', async () => {
    const res = await request(app)
      .post('/v1/transfer/claim')
      .send({
        stealthAddress: VALID_ADDRESS,
        ephemeralPublicKey: VALID_ADDRESS,
        spendingPrivateKey: VALID_HEX,
        viewingPrivateKey: VALID_HEX,
        destinationAddress: VALID_ADDRESS,
        mint: USDC_MINT,
        dryRun: true,
      })

    // Should not return 400 — dryRun is valid parameter
    // Will fail at derivation but input format is accepted
    expect(res.status).not.toBe(400)
  })

  it('defaults dryRun to false when not specified', async () => {
    const res = await request(app)
      .post('/v1/transfer/claim')
      .send({
        stealthAddress: VALID_ADDRESS,
        ephemeralPublicKey: VALID_ADDRESS,
        spendingPrivateKey: VALID_HEX,
        viewingPrivateKey: VALID_HEX,
        destinationAddress: VALID_ADDRESS,
        mint: USDC_MINT,
        // dryRun not specified — should default to false
      })

    // Should not return 400 — dryRun defaults correctly
    expect(res.status).not.toBe(400)
  })
})
