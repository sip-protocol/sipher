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

describe('Multi-Chain Stealth Addresses', () => {
  // ─── Solana (ed25519) ────────────────────────────────────────────────────────

  describe('Solana (ed25519)', () => {
    it('POST /stealth/generate with chain=solana returns ed25519 keys', async () => {
      const res = await request(app)
        .post('/v1/stealth/generate')
        .send({ chain: 'solana', label: 'Test Solana' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.metaAddress.chain).toBe('solana')
      expect(res.body.data.curve).toBe('ed25519')
      // ed25519 keys are 32 bytes = 64 hex chars
      expect(res.body.data.metaAddress.spendingKey).toMatch(/^0x[0-9a-fA-F]{64}$/)
      expect(res.body.data.metaAddress.viewingKey).toMatch(/^0x[0-9a-fA-F]{64}$/)
    })

    it('POST /stealth/generate defaults to solana', async () => {
      const res = await request(app)
        .post('/v1/stealth/generate')
        .send({})

      expect(res.status).toBe(200)
      expect(res.body.data.metaAddress.chain).toBe('solana')
      expect(res.body.data.curve).toBe('ed25519')
    })
  })

  // ─── NEAR (ed25519) ──────────────────────────────────────────────────────────

  describe('NEAR (ed25519)', () => {
    it('POST /stealth/generate with chain=near returns ed25519 keys', async () => {
      const res = await request(app)
        .post('/v1/stealth/generate')
        .send({ chain: 'near', label: 'Test NEAR' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.metaAddress.chain).toBe('near')
      expect(res.body.data.curve).toBe('ed25519')
      // ed25519 keys are 32 bytes = 64 hex chars
      expect(res.body.data.metaAddress.spendingKey).toMatch(/^0x[0-9a-fA-F]{64}$/)
      expect(res.body.data.metaAddress.viewingKey).toMatch(/^0x[0-9a-fA-F]{64}$/)
    })

    it('POST /stealth/derive with NEAR meta-address', async () => {
      // First generate a NEAR meta-address
      const genRes = await request(app)
        .post('/v1/stealth/generate')
        .send({ chain: 'near' })

      expect(genRes.status).toBe(200)
      const metaAddress = genRes.body.data.metaAddress

      // Then derive a stealth address
      const deriveRes = await request(app)
        .post('/v1/stealth/derive')
        .send({ recipientMetaAddress: metaAddress })

      expect(deriveRes.status).toBe(200)
      expect(deriveRes.body.success).toBe(true)
      expect(deriveRes.body.data.chain).toBe('near')
      expect(deriveRes.body.data.curve).toBe('ed25519')
      expect(deriveRes.body.data.stealthAddress.address).toMatch(/^0x[0-9a-fA-F]{64}$/)
    })

    it('POST /stealth/check with NEAR keys', async () => {
      // Generate NEAR meta-address
      const genRes = await request(app)
        .post('/v1/stealth/generate')
        .send({ chain: 'near' })

      const { metaAddress, viewingPrivateKey } = genRes.body.data

      // Derive stealth address
      const deriveRes = await request(app)
        .post('/v1/stealth/derive')
        .send({ recipientMetaAddress: metaAddress })

      const stealthAddress = deriveRes.body.data.stealthAddress

      // Check ownership (canonical view-only: viewing private + spending PUBLIC key)
      const checkRes = await request(app)
        .post('/v1/stealth/check')
        .send({
          stealthAddress,
          viewingPrivateKey,
          spendingPublicKey: metaAddress.spendingKey,
          chain: 'near',
        })

      expect(checkRes.status).toBe(200)
      expect(checkRes.body.data.isOwner).toBe(true)
      expect(checkRes.body.data.curve).toBe('ed25519')
    })
  })

  // ─── Ethereum (secp256k1) ────────────────────────────────────────────────────

  describe('Ethereum (secp256k1)', () => {
    it('POST /stealth/generate with chain=ethereum returns secp256k1 keys', async () => {
      const res = await request(app)
        .post('/v1/stealth/generate')
        .send({ chain: 'ethereum', label: 'Test Ethereum' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.metaAddress.chain).toBe('ethereum')
      expect(res.body.data.curve).toBe('secp256k1')
      // secp256k1 compressed keys are 33 bytes = 66 hex chars
      expect(res.body.data.metaAddress.spendingKey).toMatch(/^0x[0-9a-fA-F]{66}$/)
      expect(res.body.data.metaAddress.viewingKey).toMatch(/^0x[0-9a-fA-F]{66}$/)
    })

    it('POST /stealth/derive with Ethereum meta-address', async () => {
      const genRes = await request(app)
        .post('/v1/stealth/generate')
        .send({ chain: 'ethereum' })

      expect(genRes.status).toBe(200)
      const metaAddress = genRes.body.data.metaAddress

      const deriveRes = await request(app)
        .post('/v1/stealth/derive')
        .send({ recipientMetaAddress: metaAddress })

      expect(deriveRes.status).toBe(200)
      expect(deriveRes.body.success).toBe(true)
      expect(deriveRes.body.data.chain).toBe('ethereum')
      expect(deriveRes.body.data.curve).toBe('secp256k1')
      // Derived stealth address is also 33-byte compressed
      expect(deriveRes.body.data.stealthAddress.address).toMatch(/^0x[0-9a-fA-F]{66}$/)
    })

    it('POST /stealth/check with Ethereum keys', async () => {
      const genRes = await request(app)
        .post('/v1/stealth/generate')
        .send({ chain: 'ethereum' })

      const { metaAddress, viewingPrivateKey } = genRes.body.data

      const deriveRes = await request(app)
        .post('/v1/stealth/derive')
        .send({ recipientMetaAddress: metaAddress })

      const stealthAddress = deriveRes.body.data.stealthAddress

      const checkRes = await request(app)
        .post('/v1/stealth/check')
        .send({
          stealthAddress,
          viewingPrivateKey,
          spendingPublicKey: metaAddress.spendingKey,
          chain: 'ethereum',
        })

      expect(checkRes.status).toBe(200)
      expect(checkRes.body.data.isOwner).toBe(true)
      expect(checkRes.body.data.curve).toBe('secp256k1')
    })
  })

  // ─── Other EVM Chains (secp256k1) ────────────────────────────────────────────

  describe('Other EVM Chains (secp256k1)', () => {
    // Note: 'bsc' not yet supported by SDK (not in VALID_CHAIN_IDS)
    const evmChains = ['polygon', 'arbitrum', 'optimism', 'base']

    evmChains.forEach(chain => {
      it(`POST /stealth/generate with chain=${chain} returns secp256k1 keys`, async () => {
        const res = await request(app)
          .post('/v1/stealth/generate')
          .send({ chain })

        expect(res.status).toBe(200)
        expect(res.body.data.metaAddress.chain).toBe(chain)
        expect(res.body.data.curve).toBe('secp256k1')
        expect(res.body.data.metaAddress.spendingKey).toMatch(/^0x[0-9a-fA-F]{66}$/)
      })
    })
  })

  // ─── Cosmos Chains (secp256k1) ───────────────────────────────────────────────

  describe('Cosmos Chains (secp256k1)', () => {
    const cosmosChains = ['cosmos', 'osmosis', 'injective', 'celestia']

    cosmosChains.forEach(chain => {
      it(`POST /stealth/generate with chain=${chain} returns secp256k1 keys`, async () => {
        const res = await request(app)
          .post('/v1/stealth/generate')
          .send({ chain })

        expect(res.status).toBe(200)
        expect(res.body.data.metaAddress.chain).toBe(chain)
        expect(res.body.data.curve).toBe('secp256k1')
        expect(res.body.data.metaAddress.spendingKey).toMatch(/^0x[0-9a-fA-F]{66}$/)
      })
    })
  })

  // ─── Move Chains (ed25519) ───────────────────────────────────────────────────

  describe('Move Chains (ed25519)', () => {
    const moveChains = ['aptos', 'sui']

    moveChains.forEach(chain => {
      it(`POST /stealth/generate with chain=${chain} returns ed25519 keys`, async () => {
        const res = await request(app)
          .post('/v1/stealth/generate')
          .send({ chain })

        expect(res.status).toBe(200)
        expect(res.body.data.metaAddress.chain).toBe(chain)
        expect(res.body.data.curve).toBe('ed25519')
        expect(res.body.data.metaAddress.spendingKey).toMatch(/^0x[0-9a-fA-F]{64}$/)
      })
    })
  })

  // ─── Bitcoin-like (secp256k1) ────────────────────────────────────────────────

  describe('Bitcoin-like (secp256k1)', () => {
    const bitcoinChains = ['bitcoin', 'zcash']

    bitcoinChains.forEach(chain => {
      it(`POST /stealth/generate with chain=${chain} returns secp256k1 keys`, async () => {
        const res = await request(app)
          .post('/v1/stealth/generate')
          .send({ chain })

        expect(res.status).toBe(200)
        expect(res.body.data.metaAddress.chain).toBe(chain)
        expect(res.body.data.curve).toBe('secp256k1')
        expect(res.body.data.metaAddress.spendingKey).toMatch(/^0x[0-9a-fA-F]{66}$/)
      })
    })
  })

  // ─── Batch Operations ────────────────────────────────────────────────────────

  describe('Batch Generation', () => {
    it('POST /stealth/generate/batch with chain=ethereum', async () => {
      const res = await request(app)
        .post('/v1/stealth/generate/batch')
        .send({ chain: 'ethereum', count: 3 })

      expect(res.status).toBe(200)
      expect(res.body.data.summary.total).toBe(3)
      expect(res.body.data.summary.succeeded).toBe(3)
      expect(res.body.data.chain).toBe('ethereum')
      expect(res.body.data.curve).toBe('secp256k1')

      // Verify each result has secp256k1 keys
      res.body.data.results.forEach((r: any) => {
        expect(r.success).toBe(true)
        expect(r.data.metaAddress.spendingKey).toMatch(/^0x[0-9a-fA-F]{66}$/)
      })
    })

    it('POST /stealth/generate/batch with chain=near', async () => {
      const res = await request(app)
        .post('/v1/stealth/generate/batch')
        .send({ chain: 'near', count: 3 })

      expect(res.status).toBe(200)
      expect(res.body.data.chain).toBe('near')
      expect(res.body.data.curve).toBe('ed25519')

      res.body.data.results.forEach((r: any) => {
        expect(r.success).toBe(true)
        expect(r.data.metaAddress.spendingKey).toMatch(/^0x[0-9a-fA-F]{64}$/)
      })
    })
  })

  // ─── Error Cases ─────────────────────────────────────────────────────────────

  describe('Error Cases', () => {
    it('rejects invalid chain', async () => {
      const res = await request(app)
        .post('/v1/stealth/generate')
        .send({ chain: 'invalid_chain' })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('rejects ed25519 keys for secp256k1 chain in derive', async () => {
      // Generate Solana (ed25519) keys
      const genRes = await request(app)
        .post('/v1/stealth/generate')
        .send({ chain: 'solana' })

      const metaAddress = genRes.body.data.metaAddress

      // Try to derive with ethereum chain but ed25519 keys (wrong key length)
      const fakeEthMeta = {
        ...metaAddress,
        chain: 'ethereum', // Changed chain but keys are still 64 hex chars
      }

      const deriveRes = await request(app)
        .post('/v1/stealth/derive')
        .send({ recipientMetaAddress: fakeEthMeta })

      // SDK should reject mismatched key length
      expect(deriveRes.status).toBe(400)
    })
  })
})
