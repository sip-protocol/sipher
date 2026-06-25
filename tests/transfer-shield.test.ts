import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { Keypair, PublicKey } from '@solana/web3.js'

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  const { PublicKey: RealPublicKey } = actual as { PublicKey: typeof PublicKey }
  const configPda = new RealPublicKey('BVawZkppFewygA5nxdrLma4ThKx8Th7bW4KTCkcWTZwZ')

  // Build a mock config account: 51 bytes with total_transfers (u64 LE) at offset 43
  const configData = Buffer.alloc(51)
  // total_transfers = 42 as u64 LE
  configData[43] = 42

  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation(function () { return ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
      getLatestBlockhash: vi.fn().mockResolvedValue({
        blockhash: '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM',
        lastValidBlockHeight: 300000100,
      }),
      getAccountInfo: vi.fn().mockImplementation((pubkey: PublicKey) => {
        if (pubkey.equals(configPda)) {
          return Promise.resolve({
            data: configData,
            executable: false,
            lamports: 1_000_000,
            owner: new RealPublicKey('S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at'),
          })
        }
        return Promise.resolve(null)
      }),
    }) }),
  }
})

const { default: app } = await import('../src/server.js')

// Helper: generate a valid meta-address via the stealth/generate endpoint
async function generateMetaAddress() {
  const res = await request(app).post('/v1/stealth/generate').send({})
  return res.body.data
}

// Use a real keypair so the pubkey is on the ed25519 curve (required by SPL getAssociatedTokenAddress)
const VALID_SENDER = Keypair.generate().publicKey.toBase58()

describe('POST /v1/transfer/shield', () => {
  it('builds shielded SOL transfer via Anchor program', async () => {
    const { metaAddress } = await generateMetaAddress()

    const res = await request(app)
      .post('/v1/transfer/shield')
      .send({
        sender: VALID_SENDER,
        recipientMetaAddress: metaAddress,
        amount: '1000000000',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.transaction).toBeDefined()
    expect(res.body.data.transaction).toBeTypeOf('string')
    // base64 encoded transaction
    expect(() => Buffer.from(res.body.data.transaction, 'base64')).not.toThrow()
    expect(res.body.data.stealthAddress).toBeTypeOf('string')
    expect(res.body.data.stealthAddress.length).toBeGreaterThanOrEqual(32)
    expect(res.body.data.ephemeralPublicKey).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.body.data.viewTag).toBeTypeOf('number')
    expect(res.body.data.viewTag).toBeGreaterThanOrEqual(0)
    expect(res.body.data.viewTag).toBeLessThanOrEqual(255)
    expect(res.body.data.commitment).toBeDefined()
    expect(res.body.data.blindingFactor).toBeDefined()
    expect(res.body.data.viewingKeyHash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.body.data.sharedSecret).toMatch(/^0x[0-9a-f]{64}$/)
    // Anchor-specific fields
    expect(res.body.data.programId).toBe('S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at')
    expect(res.body.data.instructionType).toBe('anchor')
    expect(res.body.data.noteId).toBeTypeOf('string')
    expect(res.body.data.encryptedAmount).toMatch(/^0x[0-9a-f]{16}$/)
  })

  it('builds shielded SPL transfer with mint parameter (SystemProgram path)', async () => {
    const { metaAddress } = await generateMetaAddress()
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

    const res = await request(app)
      .post('/v1/transfer/shield')
      .send({
        sender: VALID_SENDER,
        recipientMetaAddress: metaAddress,
        amount: '1000000',
        mint: USDC_MINT,
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.transaction).toBeDefined()
    expect(res.body.data.stealthAddress).toBeDefined()
    expect(res.body.data.instructionType).toBe('system')
    expect(res.body.data.noteId).toBeNull()
  })

  it('generates different stealth addresses for same recipient', async () => {
    const { metaAddress } = await generateMetaAddress()

    const res1 = await request(app)
      .post('/v1/transfer/shield')
      .send({ sender: VALID_SENDER, recipientMetaAddress: metaAddress, amount: '1000000000' })
    const res2 = await request(app)
      .post('/v1/transfer/shield')
      .send({ sender: VALID_SENDER, recipientMetaAddress: metaAddress, amount: '1000000000' })

    expect(res1.body.data.stealthAddress).not.toBe(res2.body.data.stealthAddress)
    expect(res1.body.data.ephemeralPublicKey).not.toBe(res2.body.data.ephemeralPublicKey)
  })

  it('computes correct viewing key hash', async () => {
    const { metaAddress } = await generateMetaAddress()

    const res = await request(app)
      .post('/v1/transfer/shield')
      .send({ sender: VALID_SENDER, recipientMetaAddress: metaAddress, amount: '500000000' })

    expect(res.status).toBe(200)
    expect(res.body.data.viewingKeyHash).toMatch(/^0x[0-9a-f]{64}$/)
    // same meta-address should produce same viewing key hash
    const res2 = await request(app)
      .post('/v1/transfer/shield')
      .send({ sender: VALID_SENDER, recipientMetaAddress: metaAddress, amount: '500000000' })
    expect(res2.body.data.viewingKeyHash).toBe(res.body.data.viewingKeyHash)
  })

  it('rejects missing sender', async () => {
    const { metaAddress } = await generateMetaAddress()

    const res = await request(app)
      .post('/v1/transfer/shield')
      .send({ recipientMetaAddress: metaAddress, amount: '1000000000' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects missing recipientMetaAddress', async () => {
    const res = await request(app)
      .post('/v1/transfer/shield')
      .send({ sender: VALID_SENDER, amount: '1000000000' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects invalid amount format (zero)', async () => {
    const { metaAddress } = await generateMetaAddress()

    const res = await request(app)
      .post('/v1/transfer/shield')
      .send({ sender: VALID_SENDER, recipientMetaAddress: metaAddress, amount: '0' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects invalid amount format (negative)', async () => {
    const { metaAddress } = await generateMetaAddress()

    const res = await request(app)
      .post('/v1/transfer/shield')
      .send({ sender: VALID_SENDER, recipientMetaAddress: metaAddress, amount: '-100' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects invalid amount format (decimal)', async () => {
    const { metaAddress } = await generateMetaAddress()

    const res = await request(app)
      .post('/v1/transfer/shield')
      .send({ sender: VALID_SENDER, recipientMetaAddress: metaAddress, amount: '1.5' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects invalid hex keys in meta-address', async () => {
    const res = await request(app)
      .post('/v1/transfer/shield')
      .send({
        sender: VALID_SENDER,
        recipientMetaAddress: {
          spendingKey: 'not-hex',
          viewingKey: '0x1234',
          chain: 'solana',
        },
        amount: '1000000000',
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects non-solana chain', async () => {
    const res = await request(app)
      .post('/v1/transfer/shield')
      .send({
        sender: VALID_SENDER,
        recipientMetaAddress: {
          spendingKey: '0x' + '0'.repeat(64),
          viewingKey: '0x' + '0'.repeat(64),
          chain: 'ethereum',
        },
        amount: '1000000000',
      })

    expect(res.status).toBe(400)
  })

  it('rejects empty body', async () => {
    const res = await request(app)
      .post('/v1/transfer/shield')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  // ─── Anchor-specific tests ────────────────────────────────────────────────

  it('anchor response includes valid transfer record PDA', async () => {
    const { metaAddress } = await generateMetaAddress()

    const res = await request(app)
      .post('/v1/transfer/shield')
      .send({
        sender: VALID_SENDER,
        recipientMetaAddress: metaAddress,
        amount: '1000000000',
      })

    expect(res.status).toBe(200)
    expect(res.body.data.noteId).toBeTypeOf('string')
    // Base58 PDA should be 32-44 characters
    expect(res.body.data.noteId.length).toBeGreaterThanOrEqual(32)
    expect(res.body.data.noteId.length).toBeLessThanOrEqual(44)
    // Should be a valid base58 string (no 0, O, I, l)
    expect(res.body.data.noteId).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/)
  })

  it('SPL transfers use SystemProgram path', async () => {
    const { metaAddress } = await generateMetaAddress()
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

    const res = await request(app)
      .post('/v1/transfer/shield')
      .send({
        sender: VALID_SENDER,
        recipientMetaAddress: metaAddress,
        amount: '1000000',
        mint: USDC_MINT,
      })

    expect(res.status).toBe(200)
    expect(res.body.data.instructionType).toBe('system')
    expect(res.body.data.noteId).toBeNull()
    expect(res.body.data.encryptedAmount).toBeUndefined()
  })
})
