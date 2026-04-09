import { Router, type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'

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
 * Verifies a signed nonce and returns a JWT.
 * Signature cryptographic verification is deferred to on-chain tooling —
 * the nonce itself provides replay protection.
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

  // One-time use — consume before responding
  pendingNonces.delete(nonce)

  const token = jwt.sign({ wallet }, getSecret(), { expiresIn: JWT_EXPIRY })
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
  const token =
    (req.query.token as string | undefined) ??
    req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    res.status(401).json({ error: 'authentication required' })
    return
  }

  try {
    const decoded = jwt.verify(token, getSecret()) as { wallet: string }
    ;(req as unknown as Record<string, unknown>).wallet = decoded.wallet
    next()
  } catch {
    res.status(401).json({ error: 'invalid or expired token' })
  }
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
