import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import supertest from 'supertest'
import jwt from 'jsonwebtoken'
import { ed25519 } from '@noble/curves/ed25519'

const JWT_SECRET = 'test-jwt-secret-at-least-16-chars'

// Base58 alphabet (Bitcoin/Solana standard)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function encodeBase58(bytes: Uint8Array): string {
  let num = 0n
  for (const b of bytes) num = num * 256n + BigInt(b)
  let str = ''
  while (num > 0n) {
    str = BASE58_ALPHABET[Number(num % 58n)] + str
    num = num / 58n
  }
  // Preserve leading zero bytes
  for (const b of bytes) {
    if (b !== 0) break
    str = '1' + str
  }
  return str || '1'
}

/**
 * Generate a test wallet (ed25519 keypair) with base58-encoded public key.
 * Returns { privateKey, publicKey, wallet } where wallet is the base58 address.
 */
function generateTestWallet() {
  const privateKey = ed25519.utils.randomPrivateKey()
  const publicKey = ed25519.getPublicKey(privateKey)
  return { privateKey, publicKey, wallet: encodeBase58(publicKey) }
}

/**
 * Sign a message string with the test wallet's private key, return base58 signature.
 */
function signMessage(message: string, privateKey: Uint8Array): string {
  const msgBytes = new TextEncoder().encode(message)
  const sig = ed25519.sign(msgBytes, privateKey)
  return encodeBase58(sig)
}

const { authRouter, verifyJwt, _resetAuthStateForTests } = await import('../../src/routes/auth.js')

beforeEach(() => {
  process.env.JWT_SECRET = JWT_SECRET
  _resetAuthStateForTests()
})

afterEach(() => {
  delete process.env.JWT_SECRET
})

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/auth', authRouter)
  // Protected test endpoint
  app.get('/protected', verifyJwt, (req, res) => {
    res.json({ wallet: (req as unknown as Record<string, unknown>).wallet })
  })
  return app
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/nonce
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /auth/nonce', () => {
  it('returns nonce and message for valid wallet', async () => {
    const app = createApp()
    const res = await supertest(app)
      .post('/auth/nonce')
      .send({ wallet: 'wallet123abc' })
    expect(res.status).toBe(200)
    expect(res.body.nonce).toBeDefined()
    expect(typeof res.body.nonce).toBe('string')
    expect(res.body.nonce).toHaveLength(64) // 32 bytes hex
    expect(res.body.message).toContain(res.body.nonce)
  })

  it('rejects missing wallet', async () => {
    const app = createApp()
    const res = await supertest(app)
      .post('/auth/nonce')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/wallet/i)
  })

  it('rejects non-string wallet', async () => {
    const app = createApp()
    const res = await supertest(app)
      .post('/auth/nonce')
      .send({ wallet: 12345 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/wallet/i)
  })

  it('generates unique nonces per request', async () => {
    const app = createApp()
    const [r1, r2] = await Promise.all([
      supertest(app).post('/auth/nonce').send({ wallet: 'wallet123' }),
      supertest(app).post('/auth/nonce').send({ wallet: 'wallet123' }),
    ])
    expect(r1.body.nonce).not.toBe(r2.body.nonce)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/verify
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /auth/verify', () => {
  it('returns JWT token for valid wallet signature', async () => {
    const app = createApp()
    const { privateKey, wallet } = generateTestWallet()

    // Get a nonce
    const nonceRes = await supertest(app)
      .post('/auth/nonce')
      .send({ wallet })
    expect(nonceRes.status).toBe(200)
    const { nonce, message } = nonceRes.body

    // Sign the nonce message with the real private key
    const signature = signMessage(message, privateKey)

    const verifyRes = await supertest(app)
      .post('/auth/verify')
      .send({ wallet, nonce, signature })
    expect(verifyRes.status).toBe(200)
    expect(verifyRes.body.token).toBeDefined()
    expect(verifyRes.body.expiresIn).toBe('1h')

    // Token must be a valid JWT with correct wallet claim
    const decoded = jwt.verify(verifyRes.body.token, JWT_SECRET) as { wallet: string }
    expect(decoded.wallet).toBe(wallet)
  })

  it('accepts hex-encoded signatures', async () => {
    const app = createApp()
    const { privateKey, wallet } = generateTestWallet()

    const nonceRes = await supertest(app)
      .post('/auth/nonce')
      .send({ wallet })
    const { nonce, message } = nonceRes.body

    // Sign and convert to hex instead of base58
    const msgBytes = new TextEncoder().encode(message)
    const sigBytes = ed25519.sign(msgBytes, privateKey)
    const hexSig = Array.from(sigBytes).map(b => b.toString(16).padStart(2, '0')).join('')

    const verifyRes = await supertest(app)
      .post('/auth/verify')
      .send({ wallet, nonce, signature: hexSig })
    expect(verifyRes.status).toBe(200)
    expect(verifyRes.body.token).toBeDefined()
  })

  it('rejects an invalid signature (wrong key)', async () => {
    const app = createApp()
    const { wallet } = generateTestWallet()
    const attacker = generateTestWallet()

    const nonceRes = await supertest(app)
      .post('/auth/nonce')
      .send({ wallet })
    const { nonce, message } = nonceRes.body

    // Attacker signs with their own key but claims victim's wallet
    const badSig = signMessage(message, attacker.privateKey)

    const res = await supertest(app)
      .post('/auth/verify')
      .send({ wallet, nonce, signature: badSig })
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/signature verification failed/i)
  })

  it('rejects a garbage signature string', async () => {
    const app = createApp()
    const { wallet } = generateTestWallet()

    const nonceRes = await supertest(app)
      .post('/auth/nonce')
      .send({ wallet })
    const { nonce } = nonceRes.body

    const res = await supertest(app)
      .post('/auth/verify')
      .send({ wallet, nonce, signature: 'not-a-real-signature!!!' })
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/signature verification failed/i)
  })

  it('rejects missing wallet', async () => {
    const app = createApp()
    const res = await supertest(app)
      .post('/auth/verify')
      .send({ nonce: 'abc', signature: 'sig' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it('rejects missing nonce', async () => {
    const app = createApp()
    const res = await supertest(app)
      .post('/auth/verify')
      .send({ wallet: 'w1', signature: 'sig' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it('rejects missing signature', async () => {
    const app = createApp()
    const res = await supertest(app)
      .post('/auth/verify')
      .send({ wallet: 'w1', nonce: 'n1' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it('rejects invalid (unknown) nonce', async () => {
    const app = createApp()
    const { wallet } = generateTestWallet()
    const res = await supertest(app)
      .post('/auth/verify')
      .send({ wallet, nonce: 'nonexistent-nonce', signature: 'sig' })
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/invalid|expired/i)
  })

  it('rejects nonce issued for a different wallet', async () => {
    const app = createApp()
    const walletA = generateTestWallet()
    const walletB = generateTestWallet()

    // Issue nonce for wallet A
    const nonceRes = await supertest(app)
      .post('/auth/nonce')
      .send({ wallet: walletA.wallet })
    const { nonce } = nonceRes.body

    // Try to claim with wallet B
    const res = await supertest(app)
      .post('/auth/verify')
      .send({ wallet: walletB.wallet, nonce, signature: 'sig' })
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/invalid|expired/i)
  })

  it('rejects nonce reuse (one-time use)', async () => {
    const app = createApp()
    const { privateKey, wallet } = generateTestWallet()

    const nonceRes = await supertest(app)
      .post('/auth/nonce')
      .send({ wallet })
    const { nonce, message } = nonceRes.body

    const signature = signMessage(message, privateKey)

    // First use — succeeds
    const first = await supertest(app)
      .post('/auth/verify')
      .send({ wallet, nonce, signature })
    expect(first.status).toBe(200)

    // Second use — must fail (nonce consumed)
    const res = await supertest(app)
      .post('/auth/verify')
      .send({ wallet, nonce, signature })
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// verifyJwt middleware
// ─────────────────────────────────────────────────────────────────────────────

describe('verifyJwt middleware', () => {
  it('rejects requests with no token', async () => {
    const app = createApp()
    const res = await supertest(app).get('/protected')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/authentication required/i)
  })

  it('accepts valid JWT in Authorization header', async () => {
    const app = createApp()
    const token = jwt.sign({ wallet: 'walletXYZ' }, JWT_SECRET, { expiresIn: '1h' })
    const res = await supertest(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.wallet).toBe('walletXYZ')
  })

  it('accepts valid JWT as query param', async () => {
    const app = createApp()
    const token = jwt.sign({ wallet: 'walletQuery' }, JWT_SECRET, { expiresIn: '1h' })
    const res = await supertest(app)
      .get(`/protected?token=${token}`)
    expect(res.status).toBe(200)
    expect(res.body.wallet).toBe('walletQuery')
  })

  it('rejects expired JWT', async () => {
    const app = createApp()
    const token = jwt.sign({ wallet: 'walletOld' }, JWT_SECRET, { expiresIn: '-1s' })
    const res = await supertest(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/invalid|expired/i)
  })

  it('rejects JWT signed with wrong secret', async () => {
    const app = createApp()
    const token = jwt.sign({ wallet: 'walletEvil' }, 'wrong-secret-that-is-long-enough')
    const res = await supertest(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/invalid|expired/i)
  })

  it('rejects malformed token string', async () => {
    const app = createApp()
    const res = await supertest(app)
      .get('/protected')
      .set('Authorization', 'Bearer not.a.jwt')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/invalid|expired/i)
  })

  it('query param token takes precedence over Authorization header', async () => {
    const app = createApp()
    const goodToken = jwt.sign({ wallet: 'queryWallet' }, JWT_SECRET, { expiresIn: '1h' })
    const badToken = jwt.sign({ wallet: 'headerWallet' }, 'wrong-secret-1234567890')
    const res = await supertest(app)
      .get(`/protected?token=${goodToken}`)
      .set('Authorization', `Bearer ${badToken}`)
    expect(res.status).toBe(200)
    expect(res.body.wallet).toBe('queryWallet')
  })
})
