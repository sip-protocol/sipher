import type { Request, Response, NextFunction, RequestHandler } from 'express'

// Matches any Vercel preview URL for the sipher project:
//   https://<branch-slug>-sipher.vercel.app
// Branch slugs are lowercase alphanumeric + hyphens, e.g. "feat-redesign-tokens".
const VERCEL_PREVIEW_PATTERN = /^https:\/\/[a-z0-9-]+-sipher\.vercel\.app$/

/**
 * Builds a CORS middleware from a comma-separated origins env string.
 *
 * Two allow paths:
 *   1. Exact match against the explicit allowlist (production + local)
 *   2. Wildcard match against *-sipher.vercel.app preview deployments
 *
 * Returns null when corsOriginsEnv is empty so callers can skip .use() entirely
 * (preserves same-origin behaviour when CORS_ORIGINS is unset).
 */
export function buildCorsMiddleware(corsOriginsEnv: string): RequestHandler | null {
  const allowedOrigins = corsOriginsEnv.split(',').map((s) => s.trim()).filter(Boolean)
  if (allowedOrigins.length === 0) return null

  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin

    if (origin) {
      const allowed =
        allowedOrigins.includes(origin) || VERCEL_PREVIEW_PATTERN.test(origin)

      if (allowed) {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Access-Control-Allow-Credentials', 'true')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      }
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }

    next()
  }
}
