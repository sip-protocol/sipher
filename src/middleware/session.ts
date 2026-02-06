import { Request, Response, NextFunction, RequestHandler } from 'express'
import { getSession, getApiKeyIdentifier } from '../services/session-provider.js'
import type { SessionDefaults } from '../services/session-provider.js'

// ─── Express augmentation ───────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      sessionId?: string
      sessionDefaults?: SessionDefaults
    }
  }
}

// ─── Middleware ──────────────────────────────────────────────────────────────

export const sessionMiddleware: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const sessionId = req.headers['x-session-id']

  if (typeof sessionId !== 'string' || !sessionId) {
    return next()
  }

  // Validate format: sess_ + 64 hex chars
  if (!/^sess_[0-9a-f]{64}$/.test(sessionId)) {
    return next() // Silent skip on invalid format
  }

  const apiKeyId = getApiKeyIdentifier(req)

  getSession(sessionId)
    .then((session) => {
      if (!session) return next()

      // Verify ownership — session must belong to same API key
      if (session.apiKeyId !== apiKeyId) return next()

      // Set session context on request
      req.sessionId = session.id
      req.sessionDefaults = session.defaults

      // Shallow merge: session defaults into req.body (request-level wins)
      if (req.body && typeof req.body === 'object' && session.defaults) {
        for (const [key, value] of Object.entries(session.defaults)) {
          if (value !== undefined && !(key in req.body)) {
            req.body[key] = value
          }
        }
      }

      next()
    })
    .catch(() => {
      // Never block requests on session errors
      next()
    })
}
