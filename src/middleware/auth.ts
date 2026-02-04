import { Request, Response, NextFunction } from 'express'
import { timingSafeEqual } from 'crypto'
import { env } from '../config.js'

const API_KEYS = env.API_KEYS.split(',').filter(Boolean)
const AUTH_ENABLED = env.API_KEYS.length > 0 && (env.isProduction || env.API_KEYS !== '')
const SKIP_PATHS = ['/', '/skill.md', '/v1/health', '/v1/ready', '/v1/errors']

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

function isValidApiKey(key: string): boolean {
  return API_KEYS.some(valid => safeCompare(key, valid))
}

function extractApiKey(req: Request): string | null {
  const header = req.headers['x-api-key']
  if (typeof header === 'string' && header) return header
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return null
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  if (!AUTH_ENABLED || API_KEYS.length === 0) return next()
  if (SKIP_PATHS.includes(req.path)) return next()

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

  if (!isValidApiKey(apiKey)) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_API_KEY', message: 'Invalid API key' },
    })
    return
  }

  next()
}

export function isAuthEnabled(): boolean {
  return AUTH_ENABLED && API_KEYS.length > 0
}
