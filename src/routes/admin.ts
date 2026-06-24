import { Router } from 'express'
import { z } from 'zod'
import { validateRequest, adminAuth } from '../middleware/index.js'
import {
  createApiKey,
  listApiKeys,
  getApiKeyById,
  revokeApiKey,
  getUsage,
  getTierLimits,
} from '../services/api-keys.js'
import type { ApiKeyTier } from '../types/api-key.js'

const router = Router()

// All admin routes require admin auth
router.use(adminAuth)

// Schema for creating a key
const createKeySchema = {
  body: z.object({
    tier: z.enum(['free', 'pro', 'enterprise']),
    name: z.string().min(1).max(100),
    expiresAt: z.string().datetime().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
}

// GET /v1/admin/keys - List all API keys
router.get('/keys', (_req, res) => {
  const keys = listApiKeys()
  res.json({
    success: true,
    data: {
      keys,
      total: keys.length,
    },
  })
})

// POST /v1/admin/keys - Create a new API key
router.post('/keys', validateRequest(createKeySchema), (req, res) => {
  const { tier, name, expiresAt, metadata } = req.body as {
    tier: ApiKeyTier
    name: string
    expiresAt?: string
    metadata?: Record<string, unknown>
  }

  const key = createApiKey(tier, name, { expiresAt, metadata })

  res.status(201).json({
    success: true,
    data: {
      id: key.id,
      key: key.key, // Only shown once on creation
      tier: key.tier,
      name: key.name,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      limits: getTierLimits(tier),
      notice: 'Store this key securely — it will only be shown once.',
    },
  })
})

// GET /v1/admin/keys/:id - Get key details
router.get('/keys/:id', (req, res) => {
  const key = getApiKeyById(req.params.id)

  if (!key) {
    res.status(404).json({
      success: false,
      error: { code: 'KEY_NOT_FOUND', message: 'API key not found' },
    })
    return
  }

  const usage = getUsage(key.id)

  res.json({
    success: true,
    data: {
      id: key.id,
      key: key.key.slice(0, 12) + '...' + key.key.slice(-4), // Masked
      tier: key.tier,
      name: key.name,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      revokedAt: key.revokedAt,
      limits: getTierLimits(key.tier),
      usage: usage ? {
        requestCount: usage.count,
        windowStart: new Date(usage.windowStart).toISOString(),
      } : null,
    },
  })
})

// DELETE /v1/admin/keys/:id - Revoke a key
router.delete('/keys/:id', (req, res) => {
  const success = revokeApiKey(req.params.id)

  if (!success) {
    res.status(404).json({
      success: false,
      error: { code: 'KEY_NOT_FOUND', message: 'API key not found' },
    })
    return
  }

  res.json({
    success: true,
    data: { revoked: true },
  })
})

// GET /v1/admin/tiers - List available tiers and limits
router.get('/tiers', (_req, res) => {
  const tiers: ApiKeyTier[] = ['free', 'pro', 'enterprise']
  const tiersInfo = tiers.map(tier => ({
    tier,
    limits: getTierLimits(tier),
  }))

  res.json({
    success: true,
    data: { tiers: tiersInfo },
  })
})

export default router
