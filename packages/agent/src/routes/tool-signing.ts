import { Router, type Request, type Response } from 'express'
import { createConnection } from '@sipher/sdk'
import {
  getPendingSigning,
  resolvePendingSigning,
  rejectPendingSigning,
} from '../sentinel/pending-signing.js'
import { verifySignature, type VerifyResult } from '../sentinel/verify-signature.js'
import { loadNetworkConfig } from '../config/network.js'
import { sendSentinelError } from './sentinel-errors.js'

export const toolSigningRouter = Router()

type VerifyMode = 'strict' | 'advisory' | 'off'

function loadVerifyMode(): VerifyMode {
  const raw = (process.env.SIPHER_SIG_VERIFY ?? 'strict').toLowerCase()
  if (raw === 'strict' || raw === 'advisory' || raw === 'off') return raw
  return 'strict'
}

/**
 * POST /api/tool-signing/:flagId/confirm
 * Body: { signature: string }
 * Resolves the pending signing promise with the on-chain tx signature.
 * Wallet binding: JWT wallet must equal the pending entry's wallet.
 *
 * Server-side verification (Spec 3 — PR #279):
 *   SIPHER_SIG_VERIFY=strict (default) — verify via Solana RPC; reject pending
 *     on failure and return 4xx VALIDATION_FAILED. RPC unavailable → 503.
 *   SIPHER_SIG_VERIFY=advisory — verify and log on failure, but still resolve.
 *     Used for soak-testing the verifier without blocking the UX.
 *   SIPHER_SIG_VERIFY=off — skip verification entirely (legacy behavior).
 */
toolSigningRouter.post('/:flagId/confirm', async (req: Request, res: Response) => {
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

  const mode = loadVerifyMode()
  let verifyResult: VerifyResult | null = null
  if (mode !== 'off') {
    try {
      const net = loadNetworkConfig()
      const connection = createConnection(net.clusterName, net.rpcUrl)
      verifyResult = await verifySignature(signature, entry, { connection })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      verifyResult = { ok: false, reason: 'rpc_error', detail }
    }

    if (!verifyResult.ok) {
      if (mode === 'strict') {
        if (verifyResult.reason === 'rpc_error' || verifyResult.reason === 'timeout') {
          // RPC blip — let the client retry rather than killing the pending entry.
          res.setHeader('Retry-After', '2')
          sendSentinelError(
            res,
            'UNAVAILABLE',
            `signature verification unavailable (${verifyResult.reason})`,
          )
          return
        }
        if (verifyResult.reason === 'confirmed_with_err') {
          // Tx landed on-chain but the program rejected it. Surface that
          // explicitly so the LLM tells the user the program rejected the
          // transaction, not that it was cancelled. See issue #300.
          const detail = verifyResult.detail ?? 'unknown program error'
          rejectPendingSigning(flagId, `program_error: ${detail}`)
          sendSentinelError(
            res,
            'VALIDATION_FAILED',
            `transaction was confirmed on-chain but the program returned an error: ${detail}`,
          )
          return
        }
        rejectPendingSigning(flagId, `verification_failed: ${verifyResult.reason}`)
        sendSentinelError(
          res,
          'VALIDATION_FAILED',
          `signature verification failed: ${verifyResult.reason}${verifyResult.detail ? ` (${verifyResult.detail})` : ''}`,
        )
        return
      }
      console.warn(
        `[signing] verify failed (advisory mode): flagId=${flagId} reason=${verifyResult.reason}${verifyResult.detail ? ` detail=${verifyResult.detail}` : ''}`,
      )
    }
  }

  resolvePendingSigning(flagId, signature)
  res.status(200).json({
    status: 'accepted',
    verified: mode === 'strict' && verifyResult?.ok === true,
  })
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
