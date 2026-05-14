import { Router, type Request, type Response } from 'express'
import {
  getPendingSigning,
  resolvePendingSigning,
  rejectPendingSigning,
} from '../sentinel/pending-signing.js'
import { sendSentinelError } from './sentinel-errors.js'

export const toolSigningRouter = Router()

/**
 * POST /api/tool-signing/:flagId/confirm
 * Body: { signature: string }
 * Resolves the pending signing promise with the on-chain tx signature.
 * Wallet binding: JWT wallet must equal the pending entry's wallet.
 */
toolSigningRouter.post('/:flagId/confirm', (req: Request, res: Response) => {
  const flagId = req.params.flagId as string
  const entry = getPendingSigning(flagId)
  if (!entry) {
    sendSentinelError(res, 'NOT_FOUND', 'pending signing flag not found or expired')
    return
  }

  const wallet = req.wallet
  if (!wallet) {
    sendSentinelError(res, 'INTERNAL', 'JWT middleware did not attach wallet')
    return
  }
  if (entry.wallet !== wallet) {
    sendSentinelError(res, 'FORBIDDEN', 'flag belongs to a different wallet')
    return
  }

  const body = req.body as { signature?: unknown }
  const signature = body?.signature
  if (typeof signature !== 'string' || signature.length === 0) {
    sendSentinelError(res, 'VALIDATION_FAILED', 'signature must be a non-empty string')
    return
  }

  resolvePendingSigning(flagId, signature)
  res.status(200).json({ status: 'accepted' })
})

/**
 * POST /api/tool-signing/:flagId/reject
 * Body: { reason?: string }
 * Rejects the pending signing promise. Default reason: 'cancelled_by_user'.
 * Wallet binding: JWT wallet must equal the pending entry's wallet.
 */
toolSigningRouter.post('/:flagId/reject', (req: Request, res: Response) => {
  const flagId = req.params.flagId as string
  const entry = getPendingSigning(flagId)
  if (!entry) {
    sendSentinelError(res, 'NOT_FOUND', 'pending signing flag not found or expired')
    return
  }

  const wallet = req.wallet
  if (!wallet) {
    sendSentinelError(res, 'INTERNAL', 'JWT middleware did not attach wallet')
    return
  }
  if (entry.wallet !== wallet) {
    sendSentinelError(res, 'FORBIDDEN', 'flag belongs to a different wallet')
    return
  }

  const body = (req.body ?? {}) as { reason?: unknown }
  const reason = typeof body.reason === 'string' && body.reason.length > 0
    ? body.reason
    : 'cancelled_by_user'

  rejectPendingSigning(flagId, reason)
  res.status(200).json({ status: 'rejected' })
})
