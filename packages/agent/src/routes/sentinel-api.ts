import { Router, type Request, type Response } from 'express'
import {
  insertBlacklist, listBlacklist, softRemoveBlacklist,
  listPendingActions, listDecisions, dailyDecisionCostUsd,
} from '../db.js'
import { cancelCircuitBreakerAction } from '../sentinel/circuit-breaker.js'
import { getSentinelAssessor } from '../sentinel/preflight-gate.js'
import { getSentinelConfig } from '../sentinel/config.js'
import { resolvePending, rejectPending } from '../sentinel/pending.js'

// ─── Public endpoints (verifyJwt only) ──────────────────────────────────────
export const sentinelPublicRouter: Router = Router()

sentinelPublicRouter.post('/assess', async (req: Request, res: Response) => {
  const { action, wallet, recipient, amount, token, metadata } = req.body ?? {}
  if (typeof action !== 'string' || typeof wallet !== 'string') {
    res.status(400).json({ error: 'action and wallet are required strings' })
    return
  }
  const assessor = getSentinelAssessor()
  if (!assessor) {
    res.status(503).json({ error: 'SENTINEL assessor not configured' })
    return
  }
  try {
    const report = await assessor({ action, wallet, recipient, amount, token, metadata })
    res.json(report)
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'assess failed' })
  }
})

sentinelPublicRouter.get('/blacklist', (req: Request, res: Response) => {
  const limit = Number(String(req.query.limit ?? '50'))
  res.json({ entries: listBlacklist({ limit }) })
})

sentinelPublicRouter.get('/pending', (req: Request, res: Response) => {
  const wallet = (typeof req.query.wallet === 'string' ? req.query.wallet : undefined)
  const status = (typeof req.query.status === 'string' ? req.query.status : undefined)
  res.json({ actions: listPendingActions({ wallet, status }) })
})

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

sentinelAdminRouter.post('/blacklist', (req: Request, res: Response) => {
  const { address, reason, severity, expiresAt, sourceEventId } = req.body ?? {}
  if (!address || !reason || !severity) {
    res.status(400).json({ error: 'address, reason, severity required' })
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

sentinelAdminRouter.delete('/blacklist/:id', (req: Request, res: Response) => {
  const w = (req as unknown as Record<string, unknown>).wallet
  const wallet = (typeof w === 'string' ? w : undefined)
  const reason = (req.body?.reason as string) ?? 'manual removal'
  const by = typeof wallet === 'string' ? `admin:${wallet}` : 'admin'
  const id = (typeof req.params.id === 'string' ? req.params.id : String(req.params.id))
  softRemoveBlacklist(id, by, reason)
  res.json({ success: true })
})

sentinelAdminRouter.post('/pending/:id/cancel', (req: Request, res: Response) => {
  const reason = (req.body?.reason as string) ?? 'manual cancel'
  const w = (req as unknown as Record<string, unknown>).wallet
  const wallet = (typeof w === 'string' ? w : undefined)
  const by = typeof wallet === 'string' ? `user:${wallet}` : 'admin'
  const id = (typeof req.params.id === 'string' ? req.params.id : String(req.params.id))
  const ok = cancelCircuitBreakerAction(id, by, reason)
  res.json({ success: ok })
})

sentinelAdminRouter.get('/decisions', (req: Request, res: Response) => {
  const limit = Number(String(req.query.limit ?? '50'))
  const source = (typeof req.query.source === 'string' ? req.query.source : undefined)
  res.json({ decisions: listDecisions({ limit, source }) })
})

sentinelAdminRouter.post('/override/:flagId', (req: Request, res: Response) => {
  const flagId = String(req.params.flagId)
  const ok = resolvePending(flagId)
  if (!ok) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'flag not found or expired' } })
    return
  }
  res.status(204).send()
})

sentinelAdminRouter.post('/cancel/:flagId', (req: Request, res: Response) => {
  const flagId = String(req.params.flagId)
  const ok = rejectPending(flagId, 'cancelled_by_user')
  if (!ok) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'flag not found or expired' } })
    return
  }
  res.status(204).send()
})

// ─── Combined router (backwards compatibility) ──────────────────────────────
export const sentinelRouter: Router = Router()
sentinelRouter.use(sentinelPublicRouter)
sentinelRouter.use(sentinelAdminRouter)
