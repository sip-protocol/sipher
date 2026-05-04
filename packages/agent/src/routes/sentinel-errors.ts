// packages/agent/src/routes/sentinel-errors.ts
// Reference: docs/sentinel/rest-api.md#error-envelope

import type { Response } from 'express'

export type SentinelErrorCode =
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'UNAVAILABLE'
  | 'INTERNAL'

const STATUS: Record<SentinelErrorCode, number> = {
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAVAILABLE: 503,
  INTERNAL: 500,
}

/**
 * Send a SENTINEL error envelope: { error: { code, message } }.
 * Status code derived from the SENTINEL code per the design doc.
 * @see docs/sentinel/rest-api.md#error-envelope
 */
export function sendSentinelError(
  res: Response,
  code: SentinelErrorCode,
  message: string,
): void {
  res.status(STATUS[code]).json({ error: { code, message } })
}
