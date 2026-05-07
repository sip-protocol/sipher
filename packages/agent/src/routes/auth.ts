import { Router, type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { ed25519 } from '@noble/curves/ed25519'
import { createStore } from '../state/ephemeral.js'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const NONCE_TTL_SECONDS = 5 * 60 // 5 minutes
// JWT lifetime. 24h default keeps users from re-signing every hour during
// normal browsing; 1h in tests preserves existing TTL-shape assertions.
// Operator can override via env (e.g. shorten to '4h' for higher security).
// Type-cast at module load: jwt.sign's expiresIn is `number | StringValue`
// (an `ms`-style template literal) rather than plain `string`, and the env
// var is plain `string | undefined`. Validation is operator-trust here —
// jwt.sign throws at runtime on malformed values.
const JWT_EXPIRY = (process.env.JWT_EXPIRY ?? (process.env.NODE_ENV === 'test' ? '1h' : '24h')) as jwt.SignOptions['expiresIn']

// Solana wallet base58 shape: 32-44 characters, Bitcoin/Solana base58 alphabet
// (digits 1-9 + uppercase A-Z minus I, O + lowercase a-z minus l).
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

// SIWS message domain allow-list. The first line of a SIWS-shaped signedMessage
// is `${domain} wants you to sign in...` — we require ${domain} to be one of
// these entries followed by a space or colon (so `localhost.attacker.com` does
// not match an allow-list entry of `localhost`).
const SIWS_ALLOWED_DOMAINS = ((): string[] => {
  const env = process.env.SIPHER_ALLOWED_DOMAINS
  if (env) return env.split(',').map((d) => d.trim()).filter(Boolean)
  return ['sipher.sip-protocol.org', 'localhost']
})()

function siwsMessageStartsWithAllowedDomain(messageText: string): boolean {
  return SIWS_ALLOWED_DOMAINS.some((d) => messageText.startsWith(`${d} `) || messageText.startsWith(`${d}:`))
}

function decodeBase64ToBytes(input: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input)) return null
  try {
    return new Uint8Array(Buffer.from(input, 'base64'))
  } catch {
    return null
  }
}

// AUTHORIZED_WALLETS allowlist — cached parse with env-mtime invalidation.
// Production: env never changes after boot → one parse, all subsequent
// requests hit the cache. Tests that mutate process.env.AUTHORIZED_WALLETS
// per-test still see the new value because the cache reparses on env-string
// drift (no test-helper export needed).
let _cachedAuthEnv: string | undefined
let _cachedAuthSet = new Set<string>()

function authorizedWalletsSet(): Set<string> {
  const cur = process.env.AUTHORIZED_WALLETS
  if (cur !== _cachedAuthEnv) {
    _cachedAuthEnv = cur
    _cachedAuthSet = new Set(
      (cur ?? '').split(',').map((w) => w.trim()).filter(Boolean)
    )
  }
  return _cachedAuthSet
}

console.log(`[agent] AUTHORIZED_WALLETS: ${authorizedWalletsSet().size} entries`)

// Pending nonces: nonce → { wallet, expires }. TTL = 5 min.
const pendingNonces = createStore<{ wallet: string; expires: number }>('pendingNonces', { maxSize: 10_000 })

// Per-IP rate limiter for /verify (prevents ed25519 CPU amplification).
const verifyAttempts = createStore<{ count: number; resetAt: number }>('verifyAttempts', { maxSize: 1_000 })
const VERIFY_RATE_LIMIT = 10  // per minute
const VERIFY_WINDOW_MS = 60_000
const VERIFY_WINDOW_SECONDS = VERIFY_WINDOW_MS / 1000

async function checkVerifyRateLimit(ip: string): Promise<boolean> {
  const now = Date.now()
  const entry = await verifyAttempts.get(ip)
  if (!entry || entry.resetAt < now) {
    await verifyAttempts.set(ip, { count: 1, resetAt: now + VERIFY_WINDOW_MS }, VERIFY_WINDOW_SECONDS)
    return true
  }
  const nextCount = entry.count + 1
  await verifyAttempts.set(ip, { count: nextCount, resetAt: entry.resetAt }, VERIFY_WINDOW_SECONDS)
  return nextCount <= VERIFY_RATE_LIMIT
}

// Per-IP rate limiter for /nonce (anonymous endpoint — without this, one
// attacker can fill pendingNonces and DoS legitimate sign-ins, even after
// the input-validation cap).
const nonceAttempts = createStore<{ count: number; firstAt: number }>('nonceAttempts', { maxSize: 1_000 })
const NONCE_RATE_LIMIT_MAX = 5
const NONCE_RATE_LIMIT_WINDOW_MS = 60_000
const NONCE_RATE_LIMIT_WINDOW_SECONDS = NONCE_RATE_LIMIT_WINDOW_MS / 1000

async function nonceRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = req.ip ?? 'unknown'
  const now = Date.now()
  const entry = await nonceAttempts.get(ip)
  if (!entry || now - entry.firstAt > NONCE_RATE_LIMIT_WINDOW_MS) {
    await nonceAttempts.set(ip, { count: 1, firstAt: now }, NONCE_RATE_LIMIT_WINDOW_SECONDS)
    next()
    return
  }
  if (entry.count >= NONCE_RATE_LIMIT_MAX) {
    res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many nonce requests, slow down' } })
    return
  }
  await nonceAttempts.set(ip, { count: entry.count + 1, firstAt: entry.firstAt }, NONCE_RATE_LIMIT_WINDOW_SECONDS)
  next()
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET must be set and at least 16 chars')
  }
  return secret
}

// Base58 alphabet (Bitcoin/Solana standard)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE58_MAP = new Map(BASE58_ALPHABET.split('').map((c, i) => [c, BigInt(i)]))

function decodeBase58(input: string): Uint8Array {
  if (input.length === 0) throw new Error('empty base58 string')
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
authRouter.post('/nonce', nonceRateLimit, async (req: Request, res: Response) => {
  const { wallet } = req.body as { wallet?: unknown }

  // Shape validation — reject non-strings, oversize input, non-base58 strings.
  // Without this, an attacker can: (a) fill pendingNonces with 64KB string keys,
  // (b) force /verify to amplify ed25519 work on garbage inputs.
  if (typeof wallet !== 'string') {
    res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'wallet must be a string' } })
    return
  }
  if (wallet.length > 64) {
    res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'wallet too long' } })
    return
  }
  if (!BASE58_REGEX.test(wallet)) {
    res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'wallet must be a valid base58 Solana pubkey (32-44 chars)' } })
    return
  }

  // The store enforces maxSize via FIFO eviction internally — no explicit
  // size check needed here; the legacy "too many pending nonces" 429 went
  // away with the per-IP rate limiter (B5) anyway.
  const nonce = crypto.randomBytes(32).toString('hex')
  await pendingNonces.set(nonce, { wallet, expires: Date.now() + NONCE_TTL_SECONDS * 1000 }, NONCE_TTL_SECONDS)

  res.json({ nonce, message: `sipher.sip-protocol.org wants you to sign in.\n\nNonce: ${nonce}` })
})

/**
 * POST /auth/verify
 * Verifies a signed nonce via ed25519 and returns a JWT.
 * The wallet must cryptographically prove ownership by signing the nonce message.
 */
authRouter.post('/verify', async (req: Request, res: Response) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
  if (!(await checkVerifyRateLimit(ip))) {
    res.status(429).json({ error: 'too many verify attempts — try again later' })
    return
  }

  const { wallet, nonce, signature, signedMessage } = req.body as {
    wallet?: string
    nonce?: string
    signature?: string
    /**
     * Optional base64-encoded raw bytes the wallet actually signed. Set when
     * the wallet supports the SIWS Wallet-Standard feature (one popup combines
     * connect + sign-in). When absent, the server falls back to reconstructing
     * the legacy `signMessage()`-style nonce string and verifying against that.
     */
    signedMessage?: string
  }

  if (!wallet || !nonce || !signature) {
    res.status(400).json({ error: 'wallet, nonce, and signature required' })
    return
  }

  const pending = await pendingNonces.get(nonce)

  if (!pending || pending.wallet !== wallet || pending.expires < Date.now()) {
    // Always clean up — prevents probing expired entries
    await pendingNonces.delete(nonce)
    res.status(401).json({ error: 'invalid or expired nonce' })
    return
  }

  // ── Cryptographic signature verification ──────────────────────────────
  try {
    const publicKeyBytes = decodePublicKey(wallet)
    if (publicKeyBytes.length !== 32) {
      await pendingNonces.delete(nonce)
      res.status(401).json({ error: 'invalid wallet address: expected 32-byte ed25519 public key' })
      return
    }

    const signatureBytes = decodeSignature(signature)
    if (signatureBytes.length !== 64) {
      await pendingNonces.delete(nonce)
      res.status(401).json({ error: 'invalid signature: expected 64-byte ed25519 signature' })
      return
    }

    let messageBytes: Uint8Array
    if (typeof signedMessage === 'string' && signedMessage.length > 0) {
      // SIWS path — verify the actual bytes the wallet signed (we cannot
      // reconstruct them, since the SIWS message format includes per-wallet
      // fields like Issued At, Domain, Statement, etc.). Bind the signed
      // bytes to OUR nonce + an allowed domain before trusting the signature.
      const decoded = decodeBase64ToBytes(signedMessage)
      if (!decoded) {
        await pendingNonces.delete(nonce)
        res.status(401).json({ error: 'invalid signedMessage encoding' })
        return
      }
      const messageText = new TextDecoder('utf-8', { fatal: false }).decode(decoded)
      if (!siwsMessageStartsWithAllowedDomain(messageText)) {
        await pendingNonces.delete(nonce)
        res.status(401).json({ error: 'signedMessage domain not in allow-list' })
        return
      }
      if (!messageText.includes(`Nonce: ${nonce}`)) {
        await pendingNonces.delete(nonce)
        res.status(401).json({ error: 'signedMessage does not bind to nonce' })
        return
      }
      messageBytes = decoded
    } else {
      // Legacy signMessage() path — reconstruct the nonce string the wallet
      // signed via its signMessage(bytes) primitive.
      const message = `sipher.sip-protocol.org wants you to sign in.\n\nNonce: ${nonce}`
      messageBytes = new TextEncoder().encode(message)
    }

    const valid = ed25519.verify(signatureBytes, messageBytes, publicKeyBytes)
    if (!valid) {
      await pendingNonces.delete(nonce)
      res.status(401).json({ error: 'signature verification failed' })
      return
    }
  } catch {
    await pendingNonces.delete(nonce)
    res.status(401).json({ error: 'signature verification failed' })
    return
  }

  // One-time use — consume before responding
  await pendingNonces.delete(nonce)

  const allowed = authorizedWalletsSet()
  const isAdmin = allowed.size > 0 && allowed.has(wallet)

  const token = jwt.sign({ wallet }, getSecret(), { expiresIn: JWT_EXPIRY, algorithm: 'HS256' })
  res.json({ token, expiresIn: JWT_EXPIRY, isAdmin })
})

/**
 * POST /auth/refresh
 * Issues a fresh JWT when the bearer token is valid and within the last 5min
 * of its lifetime. Token issued during refresh inherits the original wallet +
 * isAdmin claims.
 *
 * Status codes:
 *  - 200: new token issued
 *  - 401 UNAUTHENTICATED: missing or malformed Authorization header
 *  - 401 INVALID_TOKEN: token signature/structure invalid, or already expired
 *  - 425 TOO_EARLY: token still has > 5min remaining
 */
const REFRESH_WINDOW_SECONDS = 5 * 60

authRouter.post('/refresh', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Missing or malformed Authorization header' } })
    return
  }
  const token = authHeader.slice(7)

  let payload: jwt.JwtPayload & { wallet?: string; isAdmin?: boolean }
  try {
    payload = jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as jwt.JwtPayload & { wallet?: string; isAdmin?: boolean }
  } catch {
    res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Token invalid or expired' } })
    return
  }

  const now = Math.floor(Date.now() / 1000)
  const exp = payload.exp ?? 0
  if (exp - now > REFRESH_WINDOW_SECONDS) {
    res.status(425).json({ error: { code: 'TOO_EARLY', message: 'Refresh allowed within 5min of expiry' } })
    return
  }

  const wallet = payload.wallet
  if (typeof wallet !== 'string') {
    res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Token missing wallet claim' } })
    return
  }
  const isAdmin = payload.isAdmin === true

  const newToken = jwt.sign({ wallet, isAdmin }, getSecret(), { expiresIn: JWT_EXPIRY, algorithm: 'HS256' })
  res.json({ token: newToken, expiresIn: JWT_EXPIRY })
})

// ─── SSE Ticket Exchange ─────────────────────────────────────────────────────
// Short-lived one-time tickets for SSE connections (avoids JWT in URL)

const SSE_TICKET_TTL_SECONDS = 30
const sseTickets = createStore<{ wallet: string; expires: number }>('sseTickets', { maxSize: 10_000 })

/**
 * POST /auth/sse-ticket
 * Exchanges a valid JWT for a short-lived, one-time SSE connection ticket.
 * The ticket is a random string (not a JWT), safe to appear in URLs.
 */
authRouter.post('/sse-ticket', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

  if (!token) {
    res.status(401).json({ error: 'Bearer token required' })
    return
  }

  try {
    const decoded = jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as { wallet: string }
    const ticket = crypto.randomBytes(32).toString('hex')
    await sseTickets.set(
      ticket,
      { wallet: decoded.wallet, expires: Date.now() + SSE_TICKET_TTL_SECONDS * 1000 },
      SSE_TICKET_TTL_SECONDS,
    )
    res.json({ ticket, expiresIn: SSE_TICKET_TTL_SECONDS })
  } catch {
    res.status(401).json({ error: 'invalid or expired token' })
  }
})

/**
 * Validate and consume an SSE ticket. Returns the wallet if valid, null otherwise.
 * Tickets are one-time use — deleted after first validation.
 */
export async function consumeSseTicket(ticket: string): Promise<string | null> {
  const entry = await sseTickets.get(ticket)
  if (!entry || entry.expires < Date.now()) {
    await sseTickets.delete(ticket)
    return null
  }
  await sseTickets.delete(ticket) // one-time use
  return entry.wallet
}

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Express middleware that validates auth from (in priority order):
 *   1. ?ticket= query param (preferred for SSE — short-lived, one-time, no JWT in URL)
 *   2. ?token= query param (legacy SSE fallback — discouraged, exposes JWT in URL)
 *   3. Authorization: Bearer <token> header
 *
 * On success, attaches `wallet` to the request object and calls next().
 */
export async function verifyJwt(req: Request, res: Response, next: NextFunction): Promise<void> {
  // SSE ticket (preferred — no JWT in URL)
  const ticket = req.query.ticket as string | undefined
  if (ticket) {
    const wallet = await consumeSseTicket(ticket)
    if (!wallet) {
      res.status(401).json({ error: 'invalid or expired SSE ticket' })
      return
    }
    req.wallet = wallet
    next()
    return
  }

  // JWT from query param (legacy SSE) or Authorization header
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
    req.wallet = decoded.wallet
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
  const wallet = req.wallet
  if (!wallet) {
    res.status(500).json({ error: { code: 'INTERNAL', message: 'JWT middleware did not attach wallet' } })
    return
  }
  const allowed = authorizedWalletsSet()

  // If no wallets configured, deny all — fail closed
  if (allowed.size === 0) {
    res.status(403).json({ error: 'no authorized wallets configured' })
    return
  }

  if (!allowed.has(wallet)) {
    res.status(403).json({ error: 'wallet not authorized for admin operations' })
    return
  }

  next()
}

/** Clear in-memory auth state (nonces, rate-limit counters, SSE tickets). Tests only. */
export async function _resetAuthStateForTests(): Promise<void> {
  await pendingNonces._clear()
  await verifyAttempts._clear()
  await sseTickets._clear()
  await nonceAttempts._clear()
}
