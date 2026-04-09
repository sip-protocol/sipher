import { Router, type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { ed25519 } from '@noble/curves/ed25519'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const NONCE_TTL = 5 * 60 * 1000 // 5 minutes
const JWT_EXPIRY = '1h'

// In-memory store: nonce → { wallet, expires }
const pendingNonces = new Map<string, { wallet: string; expires: number }>()

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getSecret(): string {
  const secret = process.env.JWT_SECRET ?? process.env.SIPHER_ADMIN_PASSWORD
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET must be at least 16 chars')
  }
  return secret
}

// Base58 alphabet (Bitcoin/Solana standard)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE58_MAP = new Map(BASE58_ALPHABET.split('').map((c, i) => [c, BigInt(i)]))

function decodeBase58(input: string): Uint8Array {
  let num = 0n
  for (const char of input) {
    const val = BASE58_MAP.get(char)
    if (val === undefined) throw new Error(`invalid base58 character: ${char}`)
    num = num * 58n + val
  }

  // Convert bigint to bytes
  const hex = num.toString(16).padStart(2, '0')
  const rawBytes = new Uint8Array(hex.length / 2 + (hex.length % 2))
  const padded = hex.length % 2 ? '0' + hex : hex
  for (let i = 0; i < padded.length; i += 2) {
    rawBytes[i / 2] = parseInt(padded.slice(i, i + 2), 16)
  }

  // Preserve leading zero bytes (leading '1's in base58)
  let leadingZeros = 0
  for (const char of input) {
    if (char !== '1') break
    leadingZeros++
  }

  const result = new Uint8Array(leadingZeros + rawBytes.length)
  result.set(rawBytes, leadingZeros)
  return result
}

/**
 * Decode a signature from base58 or hex format to 64 bytes.
 */
function decodeSignature(sig: string): Uint8Array {
  // Hex-encoded signature (128 hex chars = 64 bytes)
  if (/^[0-9a-fA-F]{128}$/.test(sig)) {
    const bytes = new Uint8Array(64)
    for (let i = 0; i < 128; i += 2) {
      bytes[i / 2] = parseInt(sig.slice(i, i + 2), 16)
    }
    return bytes
  }
  // Base58-encoded signature (Solana wallet default)
  return decodeBase58(sig)
}

/**
 * Decode a Solana wallet address (base58) to 32-byte public key.
 */
function decodePublicKey(wallet: string): Uint8Array {
  return decodeBase58(wallet)
}

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────

export const authRouter = Router()

/**
 * POST /auth/nonce
 * Issues a one-time nonce tied to a wallet address.
 */
authRouter.post('/nonce', (req: Request, res: Response) => {
  const { wallet } = req.body as { wallet?: string }

  if (!wallet || typeof wallet !== 'string') {
    res.status(400).json({ error: 'wallet required' })
    return
  }

  const nonce = crypto.randomBytes(32).toString('hex')
  pendingNonces.set(nonce, { wallet, expires: Date.now() + NONCE_TTL })

  res.json({ nonce, message: `Sign this nonce to authenticate: ${nonce}` })
})

/**
 * POST /auth/verify
 * Verifies a signed nonce via ed25519 and returns a JWT.
 * The wallet must cryptographically prove ownership by signing the nonce message.
 */
authRouter.post('/verify', (req: Request, res: Response) => {
  const { wallet, nonce, signature } = req.body as {
    wallet?: string
    nonce?: string
    signature?: string
  }

  if (!wallet || !nonce || !signature) {
    res.status(400).json({ error: 'wallet, nonce, and signature required' })
    return
  }

  const pending = pendingNonces.get(nonce)

  if (!pending || pending.wallet !== wallet || pending.expires < Date.now()) {
    // Always clean up — prevents probing expired entries
    pendingNonces.delete(nonce)
    res.status(401).json({ error: 'invalid or expired nonce' })
    return
  }

  // ── Cryptographic signature verification ──────────────────────────────
  try {
    const publicKeyBytes = decodePublicKey(wallet)
    if (publicKeyBytes.length !== 32) {
      pendingNonces.delete(nonce)
      res.status(401).json({ error: 'invalid wallet address: expected 32-byte ed25519 public key' })
      return
    }

    const signatureBytes = decodeSignature(signature)
    if (signatureBytes.length !== 64) {
      pendingNonces.delete(nonce)
      res.status(401).json({ error: 'invalid signature: expected 64-byte ed25519 signature' })
      return
    }

    // The message the wallet signed (must match what /nonce returns)
    const message = `Sign this nonce to authenticate: ${nonce}`
    const messageBytes = new TextEncoder().encode(message)

    const valid = ed25519.verify(signatureBytes, messageBytes, publicKeyBytes)
    if (!valid) {
      pendingNonces.delete(nonce)
      res.status(401).json({ error: 'signature verification failed' })
      return
    }
  } catch {
    pendingNonces.delete(nonce)
    res.status(401).json({ error: 'signature verification failed' })
    return
  }

  // One-time use — consume before responding
  pendingNonces.delete(nonce)

  const token = jwt.sign({ wallet }, getSecret(), { expiresIn: JWT_EXPIRY, algorithm: 'HS256' })
  res.json({ token, expiresIn: JWT_EXPIRY })
})

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Express middleware that validates a JWT from:
 *   - ?token= query param (preferred for SSE — EventSource cannot set headers)
 *   - Authorization: Bearer <token> header
 *
 * On success, attaches `wallet` to the request object and calls next().
 */
export function verifyJwt(req: Request, res: Response, next: NextFunction): void {
  // Query param takes precedence (needed for SSE via EventSource)
  const authHeader = req.headers.authorization
  const token =
    (req.query.token as string | undefined) ??
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined)

  if (!token) {
    res.status(401).json({ error: 'authentication required' })
    return
  }

  try {
    const decoded = jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as { wallet: string }
    ;(req as unknown as Record<string, unknown>).wallet = decoded.wallet
    next()
  } catch {
    res.status(401).json({ error: 'invalid or expired token' })
  }
}

/**
 * Authorization middleware — checks that the JWT wallet is in the AUTHORIZED_WALLETS allowlist.
 * Must be placed AFTER verifyJwt in the middleware chain.
 */
export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  const wallet = (req as unknown as Record<string, unknown>).wallet as string
  const allowed = (process.env.AUTHORIZED_WALLETS ?? '').split(',').map(w => w.trim()).filter(Boolean)

  // If no wallets configured, deny all — fail closed
  if (allowed.length === 0) {
    res.status(403).json({ error: 'no authorized wallets configured' })
    return
  }

  if (!allowed.includes(wallet)) {
    res.status(403).json({ error: 'wallet not authorized for admin operations' })
    return
  }

  next()
}

// ─────────────────────────────────────────────────────────────────────────────
// Background cleanup — prevent unbounded nonce accumulation
// ─────────────────────────────────────────────────────────────────────────────

setInterval(() => {
  const now = Date.now()
  for (const [nonce, data] of pendingNonces) {
    if (data.expires < now) pendingNonces.delete(nonce)
  }
}, 5 * 60 * 1000).unref()
