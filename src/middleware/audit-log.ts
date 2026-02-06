import { Request, Response, NextFunction } from 'express'
import { logger } from '../logger.js'

// Fields that contain sensitive cryptographic material — redact from logs
const SENSITIVE_KEYS = new Set([
  'spendingPrivateKey',
  'viewingPrivateKey',
  'spendingKey',
  'viewingKey',
  'blindingFactor',
  'blindingA',
  'blindingB',
  'sharedSecret',
  'key',
  'privateKey',
  'encryptedInputs',
  'plaintext',
  'ciphertexts',
  'inputAmount',
  'swapTransaction',
])

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body
  if (Array.isArray(body)) return body.map(sanitizeBody)

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key) && typeof value === 'string') {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeBody(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

function extractApiKeyTail(req: Request): string | undefined {
  const header = req.headers['x-api-key']
  if (typeof header === 'string' && header.length >= 8) {
    return `...${header.slice(-8)}`
  }
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ') && auth.length >= 15) {
    return `...${auth.slice(-8)}`
  }
  return undefined
}

export function auditLog(req: Request, res: Response, next: NextFunction) {
  const start = performance.now()

  const originalEnd = res.end.bind(res)

  // Override res.end to capture timing
  ;(res as any).end = function (...args: any[]) {
    const latencyMs = Math.round(performance.now() - start)

    const auditEntry = {
      audit: true,
      requestId: (req as any).requestId || req.headers['x-request-id'],
      method: req.method,
      path: req.path,
      status: res.statusCode,
      apiKey: extractApiKeyTail(req),
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      latencyMs,
      body: req.body && Object.keys(req.body).length > 0
        ? sanitizeBody(req.body)
        : undefined,
    }

    if (res.statusCode >= 500) {
      logger.error(auditEntry, 'audit')
    } else if (res.statusCode >= 400) {
      logger.warn(auditEntry, 'audit')
    } else {
      logger.info(auditEntry, 'audit')
    }

    return originalEnd(...args)
  }

  next()
}

// Export for testing
export { sanitizeBody }
