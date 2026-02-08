import { Request, Response, NextFunction } from 'express'
import { checkQuota, trackUsage } from '../services/usage-provider.js'
import { ErrorCode } from '../errors/codes.js'
import { logger } from '../logger.js'
import type { OperationCategory } from '../types/api-key.js'

// ─── Path → Category Mapping ────────────────────────────────────────────────

const PATH_CATEGORIES: [string, OperationCategory][] = [
  ['/v1/stealth/', 'stealth'],
  ['/v1/commitment/', 'commitment'],
  ['/v1/transfer/', 'transfer'],
  ['/v1/scan/', 'scan'],
  ['/v1/viewing-key/', 'viewing_key'],
  ['/v1/proofs/', 'proof'],
  ['/v1/privacy/', 'privacy'],
  ['/v1/arcium/', 'compute'],
  ['/v1/inco/', 'compute'],
  ['/v1/swap/', 'swap'],
  ['/v1/governance/', 'governance'],
  ['/v1/compliance/', 'compliance'],
  ['/v1/sessions', 'session'],
  ['/v1/jito/', 'jito'],
  ['/v1/backends', 'compute'],
  ['/v1/cspl/', 'transfer'],
]

const SKIP_PREFIXES = [
  '/v1/health',
  '/v1/ready',
  '/v1/errors',
  '/v1/openapi.json',
  '/v1/rpc/',
  '/v1/billing/',
  '/v1/admin/',
  '/v1/demo',
]

const SKIP_EXACT = ['/', '/skill.md', '/docs']

export function classifyPath(path: string): OperationCategory | null {
  for (const prefix of SKIP_PREFIXES) {
    if (path.startsWith(prefix)) return null
  }
  for (const exact of SKIP_EXACT) {
    if (path === exact || path.startsWith(exact + '/')) return null
  }

  for (const [prefix, category] of PATH_CATEGORIES) {
    if (path.startsWith(prefix) || path === prefix.slice(0, -1)) {
      return category
    }
  }

  return null
}

// ─── Middleware ──────────────────────────────────────────────────────────────

export function meteringMiddleware(req: Request, res: Response, next: NextFunction) {
  const category = classifyPath(req.path)

  // Skip metering for non-categorized paths
  if (!category) return next()

  const tier = req.apiKeyTier
  if (!tier) return next() // No auth = no quota tracking

  const apiKeyId = req.apiKey?.id ?? req.headers['x-api-key'] as string ?? 'unknown'

  // Check quota before processing
  checkQuota(apiKeyId, category, tier)
    .then(({ allowed, current, limit, resetAt }) => {
      if (!allowed) {
        res.status(429).json({
          success: false,
          error: {
            code: ErrorCode.DAILY_QUOTA_EXCEEDED,
            message: `Daily quota exceeded. Used ${current}/${limit} operations. Resets at ${resetAt}.`,
            details: { category, current, limit, resetAt, tier },
          },
        })
        return
      }

      // Track usage after successful response
      res.on('finish', () => {
        if (res.statusCode < 400) {
          trackUsage(apiKeyId, category).catch((err) => {
            logger.warn({ err, apiKeyId, category }, 'Failed to track usage')
          })
        }
      })

      next()
    })
    .catch((err) => {
      logger.error({ err }, 'Quota check failed — rejecting request (fail-closed)')
      res.status(503).json({
        success: false,
        error: {
          code: ErrorCode.SERVICE_UNAVAILABLE,
          message: 'Usage quota service temporarily unavailable. Please retry.',
        },
      })
    })
}
