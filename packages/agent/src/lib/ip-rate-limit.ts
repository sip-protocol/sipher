import type { Request, RequestHandler, Response, NextFunction } from 'express'
import { createStore } from '../state/ephemeral.js'

interface BucketState { count: number; resetAt: number }

const ipRateLimitStore = createStore<BucketState>('ipRateLimit', { maxSize: 10_000 })

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  cap: number
}

/**
 * Per-(IP, key) sliding-window counter. Same IP can hit different keys
 * (e.g., 'demo' and 'chat') with independent budgets.
 */
export async function checkAndIncrement(
  ip: string,
  key: string,
  cap: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now()
  const bucketKey = `${ip}:${key}`
  const existing = await ipRateLimitStore.get(bucketKey)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs
    await ipRateLimitStore.set(bucketKey, { count: 1, resetAt }, Math.ceil(windowMs / 1000))
    return { allowed: true, remaining: cap - 1, resetAt, cap }
  }

  if (existing.count >= cap) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt, cap }
  }

  const next: BucketState = { count: existing.count + 1, resetAt: existing.resetAt }
  const ttlSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
  await ipRateLimitStore.set(bucketKey, next, ttlSeconds)
  return { allowed: true, remaining: cap - next.count, resetAt: existing.resetAt, cap }
}

/**
 * Express middleware. Sets X-RateLimit-* headers; returns 429 + envelope on exceeded.
 * Reads `req.ip` (Express trust-proxy is configured upstream at index.ts:146-148).
 */
export function ipRateLimitMiddleware(key: string, cap: number, windowMs: number): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip ?? 'unknown'
    const result = await checkAndIncrement(ip, key, cap, windowMs)
    res.setHeader('X-RateLimit-Limit', String(cap))
    res.setHeader('X-RateLimit-Remaining', String(result.remaining))
    res.setHeader('X-RateLimit-Reset', String(Math.floor(result.resetAt / 1000)))

    if (!result.allowed) {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: `Rate limit ${cap}/${Math.round(windowMs / 1000)}s exceeded`,
          resetAt: result.resetAt,
        },
      })
      return
    }
    next()
  }
}

export async function _resetForTests(): Promise<void> {
  await ipRateLimitStore._clear()
}
