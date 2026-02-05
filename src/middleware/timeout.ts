import type { Request, Response, NextFunction } from 'express'

/**
 * Per-endpoint timeout configuration (milliseconds)
 * Heavy operations get longer timeouts
 */
export const ENDPOINT_TIMEOUTS: Record<string, number> = {
  // Fast operations (15s)
  '/v1/health': 5_000,
  '/v1/ready': 5_000,
  '/v1/stealth/generate': 15_000,
  '/v1/stealth/derive': 15_000,
  '/v1/stealth/check': 15_000,
  '/v1/commitment/create': 15_000,
  '/v1/commitment/verify': 15_000,
  '/v1/commitment/add': 15_000,
  '/v1/commitment/subtract': 15_000,
  '/v1/viewing-key/generate': 15_000,
  '/v1/viewing-key/derive': 15_000,
  '/v1/rpc/providers': 15_000,

  // Medium operations (30s) - batch or RPC-dependent
  '/v1/stealth/generate/batch': 30_000,
  '/v1/commitment/create/batch': 30_000,
  '/v1/viewing-key/verify-hierarchy': 30_000,
  '/v1/viewing-key/disclose': 30_000,
  '/v1/viewing-key/decrypt': 30_000,

  // Heavy operations (45s) - blockchain queries
  '/v1/scan/payments': 45_000,
  '/v1/scan/payments/batch': 45_000,
  '/v1/privacy/score': 45_000,

  // Proof generation (60s) - ZK circuits
  '/v1/proofs/funding/generate': 60_000,
  '/v1/proofs/funding/verify': 30_000,
  '/v1/proofs/validity/generate': 60_000,
  '/v1/proofs/validity/verify': 30_000,
  '/v1/proofs/fulfillment/generate': 60_000,
  '/v1/proofs/fulfillment/verify': 30_000,

  // Blockchain transactions (90s) - includes confirmation wait
  '/v1/transfer/shield': 60_000,
  '/v1/transfer/claim': 90_000,

  // C-SPL operations (60s)
  '/v1/cspl/wrap': 60_000,
  '/v1/cspl/unwrap': 60_000,
  '/v1/cspl/transfer': 60_000,
}

const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Request timeout middleware
 * Returns 408 if request exceeds configured timeout
 */
export function timeoutMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip for non-API routes
  if (!req.path.startsWith('/v1')) {
    next()
    return
  }

  const timeoutMs = ENDPOINT_TIMEOUTS[req.path] ?? DEFAULT_TIMEOUT_MS

  // Create abort controller for downstream cancellation
  const controller = new AbortController()
  ;(req as Request & { abortSignal?: AbortSignal }).abortSignal = controller.signal

  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      controller.abort()
      res.status(408).json({
        success: false,
        error: {
          code: 'REQUEST_TIMEOUT',
          message: `Request exceeded ${timeoutMs / 1000}s timeout`,
          retryable: true,
        },
      })
    }
  }, timeoutMs)

  // Clean up on response finish
  res.on('finish', () => clearTimeout(timeoutId))
  res.on('close', () => {
    clearTimeout(timeoutId)
    controller.abort()
  })

  next()
}

/**
 * Get abort signal from request (for use in route handlers)
 */
export function getAbortSignal(req: Request): AbortSignal | undefined {
  return (req as Request & { abortSignal?: AbortSignal }).abortSignal
}
