import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { validateRequest } from '../middleware/validation.js'
import { requireTier } from '../middleware/require-tier.js'
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  getApiKeyIdentifier,
} from '../services/session-provider.js'

const router = Router()
const proPlus = requireTier('pro', 'enterprise')

// ─── Constants ──────────────────────────────────────────────────────────────

const VALID_CHAINS = [
  'solana', 'ethereum', 'polygon', 'arbitrum', 'optimism', 'base',
  'near', 'aptos', 'sui',
  'cosmos', 'osmosis', 'injective', 'celestia', 'sei', 'dydx',
  'bitcoin', 'zcash',
]

const VALID_PRIVACY_LEVELS = ['standard', 'shielded', 'maximum']
const VALID_RPC_PROVIDERS = ['helius', 'quicknode', 'triton', 'generic']
const VALID_BACKENDS = ['sip-native', 'arcium', 'inco']

// ─── Schemas ────────────────────────────────────────────────────────────────

const hexString = z.string().regex(/^0x[0-9a-fA-F]+$/, '0x-prefixed hex string')

const sessionDefaultsSchema = z.object({
  chain: z.enum(VALID_CHAINS as [string, ...string[]]).optional(),
  privacyLevel: z.enum(VALID_PRIVACY_LEVELS as [string, ...string[]]).optional(),
  rpcProvider: z.enum(VALID_RPC_PROVIDERS as [string, ...string[]]).optional(),
  backend: z.enum(VALID_BACKENDS as [string, ...string[]]).optional(),
  defaultViewingKey: hexString.optional(),
})

const createSessionSchema = z.object({
  defaults: sessionDefaultsSchema,
  ttlSeconds: z.number().int().min(60).max(86400).optional(),
})

const updateSessionSchema = z.object({
  defaults: sessionDefaultsSchema,
})

const sessionIdPattern = z.string().regex(/^sess_[0-9a-f]{64}$/, 'Session ID (sess_ + 64 hex chars)')

// ─── POST /sessions ─────────────────────────────────────────────────────────

router.post(
  '/sessions',
  proPlus,
  validateRequest({ body: createSessionSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKeyId = getApiKeyIdentifier(req)
      const { defaults, ttlSeconds } = req.body
      const session = await createSession(apiKeyId, defaults, ttlSeconds)

      res.status(201).json({
        success: true,
        data: {
          sessionId: session.id,
          defaults: session.defaults,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

// ─── GET /sessions/:id ─────────────────────────────────────────────────────

router.get(
  '/sessions/:id',
  proPlus,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string
      const parsed = sessionIdPattern.safeParse(id)
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid session ID format. Expected sess_ + 64 hex chars.',
          },
        })
        return
      }

      const session = await getSession(id)
      if (!session) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: `Session not found: ${id}`,
          },
        })
        return
      }

      // Ownership check
      const apiKeyId = getApiKeyIdentifier(req)
      if (session.apiKeyId !== apiKeyId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: `Session not found: ${id}`,
          },
        })
        return
      }

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          defaults: session.defaults,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          lastAccessedAt: session.lastAccessedAt,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

// ─── PATCH /sessions/:id ───────────────────────────────────────────────────

router.patch(
  '/sessions/:id',
  proPlus,
  validateRequest({ body: updateSessionSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string
      const parsed = sessionIdPattern.safeParse(id)
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid session ID format. Expected sess_ + 64 hex chars.',
          },
        })
        return
      }

      // Check existence + ownership before update
      const existing = await getSession(id)
      if (!existing) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: `Session not found: ${id}`,
          },
        })
        return
      }

      const apiKeyId = getApiKeyIdentifier(req)
      if (existing.apiKeyId !== apiKeyId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: `Session not found: ${id}`,
          },
        })
        return
      }

      const session = await updateSession(id, req.body.defaults)
      if (!session) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: `Session not found: ${id}`,
          },
        })
        return
      }

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          defaults: session.defaults,
          expiresAt: session.expiresAt,
          lastAccessedAt: session.lastAccessedAt,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

// ─── DELETE /sessions/:id ──────────────────────────────────────────────────

router.delete(
  '/sessions/:id',
  proPlus,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string
      const parsed = sessionIdPattern.safeParse(id)
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid session ID format. Expected sess_ + 64 hex chars.',
          },
        })
        return
      }

      // Check ownership before delete
      const existing = await getSession(id)
      if (!existing) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: `Session not found: ${id}`,
          },
        })
        return
      }

      const apiKeyId = getApiKeyIdentifier(req)
      if (existing.apiKeyId !== apiKeyId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: `Session not found: ${id}`,
          },
        })
        return
      }

      await deleteSession(id)

      res.json({
        success: true,
        data: {
          sessionId: id,
          deleted: true,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

export default router
