import { Router, type Request, type Response } from 'express'
import {
  insertBlacklist, listBlacklist, softRemoveBlacklist,
  listPendingActions, listDecisions, dailyDecisionCostUsd,
} from '../db.js'
import { cancelCircuitBreakerAction } from '../sentinel/circuit-breaker.js'
import { getSentinelAssessor } from '../sentinel/preflight-gate.js'
import { getSentinelConfig } from '../sentinel/config.js'
import { resolvePending, rejectPending } from '../sentinel/pending.js'
import { sendSentinelError } from './sentinel-errors.js'

// Reference: docs/sentinel/rest-api.md

// ─── Public endpoints (verifyJwt only) ──────────────────────────────────────
export const sentinelPublicRouter: Router = Router()

/**
 * One-shot risk assessment for a proposed action.
 * @auth verifyJwt
 * @body { action, wallet, recipient?, amount?, token?, metadata? }
 * @returns 200 RiskReport | 400 ErrorEnvelope | 500 ErrorEnvelope | 503 ErrorEnvelope
 * @see docs/sentinel/rest-api.md#post-apisentinelassess
 * @see docs/sentinel/rest-api.md#error-envelope
 */
sentinelPublicRouter.post('/assess', async (req: Request, res: Response) => {
  const { action, wallet, recipient, amount, token, metadata } = req.body ?? {}
  if (typeof action !== 'string' || typeof wallet !== 'string') {
    sendSentinelError(res, 'VALIDATION_FAILED', 'action and wallet are required strings')
    return
  }
  const assessor = getSentinelAssessor()
  if (!assessor) {
    sendSentinelError(res, 'UNAVAILABLE', 'SENTINEL assessor not configured')
    return
  }
  try {
    const report = await assessor({ action, wallet, recipient, amount, token, metadata })
    res.json(report)
  } catch (e) {
    sendSentinelError(res, 'INTERNAL', e instanceof Error ? e.message : 'assess failed')
  }
})

/**
 * List active blacklist entries.
 * @auth verifyJwt
 * @query limit? number (default 50)
 * @returns 200 { entries: BlacklistEntry[] }
 * @see docs/sentinel/rest-api.md#get-apisentinelblacklist
 */
sentinelPublicRouter.get('/blacklist', (req: Request, res: Response) => {
  const limit = Number(String(req.query.limit ?? '50'))
  res.json({ entries: listBlacklist({ limit }) })
})

/**
 * List pending circuit-breaker actions (SQLite-backed).
 * @auth verifyJwt
 * @query wallet? string, status? string
 * @returns 200 { actions: PendingAction[] }
 * @see docs/sentinel/rest-api.md#get-apisentinelpending
 */
sentinelPublicRouter.get('/pending', (req: Request, res: Response) => {
  const wallet = (typeof req.query.wallet === 'string' ? req.query.wallet : undefined)
  const status = (typeof req.query.status === 'string' ? req.query.status : undefined)
  res.json({ actions: listPendingActions({ wallet, status }) })
})

/**
 * Return SENTINEL runtime configuration and daily spend.
 * @auth verifyJwt
 * @returns 200 { mode, preflightScope, model, dailyBudgetUsd, dailyCostUsd, blockOnError }
 * @see docs/sentinel/rest-api.md#get-apisentinelstatus
 */
sentinelPublicRouter.get('/status', (_req: Request, res: Response) => {
  const config = getSentinelConfig()
  res.json({
    mode: config.mode,
    preflightScope: config.preflightScope,
    model: config.model,
    dailyBudgetUsd: config.dailyBudgetUsd,
    dailyCostUsd: dailyDecisionCostUsd(),
    blockOnError: config.blockOnError,
  })
})

// ─── Admin endpoints (verifyJwt + requireOwner) ─────────────────────────────
export const sentinelAdminRouter: Router = Router()

/**
 * Add an address to the blacklist.
 * @auth verifyJwt + requireOwner
 * @body { address, reason, severity, expiresAt?, sourceEventId? }
 * @returns 200 { success: true, entryId } | 400 ErrorEnvelope
 * @see docs/sentinel/rest-api.md#post-apisentinelblacklist
 * @see docs/sentinel/rest-api.md#error-envelope
 */
sentinelAdminRouter.post('/blacklist', (req: Request, res: Response) => {
  const { address, reason, severity, expiresAt, sourceEventId } = req.body ?? {}
  if (!address || !reason || !severity) {
    sendSentinelError(res, 'VALIDATION_FAILED', 'address, reason, severity required')
    return
  }
  const wallet = (req as unknown as Record<string, unknown>).wallet as string | undefined
  const id = insertBlacklist({
    address, reason, severity,
    addedBy: wallet ? `admin:${wallet}` : 'admin',
    expiresAt, sourceEventId,
  })
  res.json({ success: true, entryId: id })
})

/**
 * Soft-remove a blacklist entry by id.
 * @auth verifyJwt + requireOwner
 * @param id blacklist entry id
 * @body { reason? string }
 * @returns 200 { success: true }
 * @see docs/sentinel/rest-api.md#delete-apisentinelblacklistid
 */
sentinelAdminRouter.delete('/blacklist/:id', (req: Request, res: Response) => {
  const w = (req as unknown as Record<string, unknown>).wallet
  const wallet = (typeof w === 'string' ? w : undefined)
  const reason = (req.body?.reason as string) ?? 'manual removal'
  const by = typeof wallet === 'string' ? `admin:${wallet}` : 'admin'
  const id = (typeof req.params.id === 'string' ? req.params.id : String(req.params.id))
  softRemoveBlacklist(id, by, reason)
  res.json({ success: true })
})

/**
 * Circuit-breaker cancel — mark a pending action cancelled in SQLite.
 * Operates on the durable circuit-breaker queue (distinct from the in-memory promise-gate routes).
 * @auth verifyJwt + requireOwner
 * @param id pending action id
 * @body { reason? string }
 * @returns 200 { success: true } | 404 ErrorEnvelope
 * @see docs/sentinel/rest-api.md#post-apisentinelcircuit-breakeridcancel
 * @see docs/sentinel/rest-api.md#error-envelope
 */
sentinelAdminRouter.post('/circuit-breaker/:id/cancel', (req: Request, res: Response) => {
  const reason = (req.body?.reason as string) ?? 'manual cancel'
  const w = (req as unknown as Record<string, unknown>).wallet
  const wallet = (typeof w === 'string' ? w : undefined)
  const by = typeof wallet === 'string' ? `user:${wallet}` : 'admin'
  const id = (typeof req.params.id === 'string' ? req.params.id : String(req.params.id))
  const ok = cancelCircuitBreakerAction(id, by, reason)
  if (!ok) {
    sendSentinelError(res, 'NOT_FOUND', 'pending action not found or already resolved')
    return
  }
  res.json({ success: true })
})

/**
 * List SENTINEL decision log entries.
 * @auth verifyJwt + requireOwner
 * @query limit? number (default 50), source? string
 * @returns 200 { decisions: Decision[] }
 * @see docs/sentinel/rest-api.md#get-apisentineldecisions
 */
sentinelAdminRouter.get('/decisions', (req: Request, res: Response) => {
  const limit = Number(String(req.query.limit ?? '50'))
  const source = (typeof req.query.source === 'string' ? req.query.source : undefined)
  res.json({ decisions: listDecisions({ limit, source }) })
})

// ─── Promise-gate endpoints (pause/resume for advisory mode) ────────────────
// These act on in-memory pending promises owned by sentinel/pending.ts.

/**
 * Promise-gate resolve — approve a paused advisory-mode action.
 * Promise-gate resolve — see also `/cancel/:flagId` reject.
 * @auth verifyJwt + requireOwner
 * @param flagId in-memory promise flag id
 * @returns 204 | 404 ErrorEnvelope
 * @see docs/sentinel/rest-api.md#post-apisentineloverrideflagid
 * @see docs/sentinel/rest-api.md#error-envelope
 */
sentinelAdminRouter.post('/override/:flagId', (req: Request, res: Response) => {
  const flagId = String(req.params.flagId)
  const ok = resolvePending(flagId)
  if (!ok) {
    sendSentinelError(res, 'NOT_FOUND', 'flag not found or expired')
    return
  }
  res.status(204).send()
})

/**
 * Promise-gate reject — deny a paused advisory-mode action.
 * Promise-gate reject — distinct from the circuit-breaker `/pending/:id/cancel`.
 * @auth verifyJwt + requireOwner
 * @param flagId in-memory promise flag id
 * @returns 204 | 404 ErrorEnvelope
 * @see docs/sentinel/rest-api.md#post-apisentinelcancelflagid
 * @see docs/sentinel/rest-api.md#error-envelope
 */
sentinelAdminRouter.post('/cancel/:flagId', (req: Request, res: Response) => {
  const flagId = String(req.params.flagId)
  const ok = rejectPending(flagId, 'cancelled_by_user')
  if (!ok) {
    sendSentinelError(res, 'NOT_FOUND', 'flag not found or expired')
    return
  }
  res.status(204).send()
})

// ─── Combined router (backwards compatibility) ──────────────────────────────
export const sentinelRouter: Router = Router()
sentinelRouter.use(sentinelPublicRouter)
sentinelRouter.use(sentinelAdminRouter)
