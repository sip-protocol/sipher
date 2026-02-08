import { Request, Response, NextFunction } from 'express'
import { timingSafeEqual } from 'crypto'
import { env } from '../config.js'
import {
  validateApiKey,
  isEndpointAllowed,
  initApiKeyService,
} from '../services/api-keys.js'
import type { ApiKeyTier } from '../types/api-key.js'

// Legacy API keys from env (backwards compatible)
const LEGACY_API_KEYS = env.API_KEYS.split(',').filter(Boolean)
const AUTH_ENABLED = env.API_KEYS.length > 0 || env.isProduction

const SKIP_PATHS = ['/', '/skill.md', '/v1/health', '/v1/ready', '/v1/errors', '/v1/openapi.json', '/v1/billing/webhook', '/v1/demo', '/demo']
const SKIP_PREFIXES = ['/docs']

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

function isLegacyApiKey(key: string): boolean {
  return LEGACY_API_KEYS.some(valid => safeCompare(key, valid))
}

function extractApiKey(req: Request): string | null {
  const header = req.headers['x-api-key']
  if (typeof header === 'string' && header) return header
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7)
    if (token) return token
  }
  return null
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  // Initialize key service
  initApiKeyService()

  // Skip auth for public paths
  if (SKIP_PATHS.includes(req.path)) return next()
  if (SKIP_PREFIXES.some(p => req.path.startsWith(p))) return next()

  // If no auth configured, allow all (dev mode)
  if (!AUTH_ENABLED && LEGACY_API_KEYS.length === 0) {
    req.apiKeyTier = 'enterprise' // Dev mode gets full access
    return next()
  }

  const apiKey = extractApiKey(req)

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'API key required. Provide via X-API-Key header or Authorization: Bearer <key>',
      },
    })
    return
  }

  // Try new tiered key system first
  const keyConfig = validateApiKey(apiKey)
  if (keyConfig) {
    // Check endpoint access for tier
    if (!isEndpointAllowed(keyConfig.tier, req.path)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'TIER_ACCESS_DENIED',
          message: `Endpoint ${req.path} not available on ${keyConfig.tier} tier. Upgrade to pro or enterprise.`,
        },
      })
      return
    }

    req.apiKey = keyConfig
    req.apiKeyTier = keyConfig.tier
    return next()
  }

  // Fallback to legacy API keys (treated as enterprise tier)
  if (isLegacyApiKey(apiKey)) {
    req.apiKeyTier = 'enterprise' as ApiKeyTier
    return next()
  }

  res.status(401).json({
    success: false,
    error: { code: 'INVALID_API_KEY', message: 'Invalid API key' },
  })
}

export function isAuthEnabled(): boolean {
  return AUTH_ENABLED || LEGACY_API_KEYS.length > 0
}

// Admin auth - requires admin key from env
const ADMIN_KEY = env.ADMIN_API_KEY

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  if (!ADMIN_KEY) {
    res.status(503).json({
      success: false,
      error: { code: 'ADMIN_DISABLED', message: 'Admin API not configured' },
    })
    return
  }

  const apiKey = extractApiKey(req)

  if (!apiKey || !safeCompare(apiKey, ADMIN_KEY)) {
    res.status(401).json({
      success: false,
      error: { code: 'ADMIN_UNAUTHORIZED', message: 'Admin API key required' },
    })
    return
  }

  next()
}
