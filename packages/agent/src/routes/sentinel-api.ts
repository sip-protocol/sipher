import { Router, type Request, type Response } from 'express'
import {
  insertBlacklist, listBlacklist, softRemoveBlacklist,
  listPendingActions, listDecisions, dailyDecisionCostUsd,
} from '../db.js'
import { cancelCircuitBreakerAction } from '../sentinel/circuit-breaker.js'
import { getSentinelAssessor } from '../sentinel/preflight-gate.js'
import { getSentinelConfig } from '../sentinel/config.js'

export const sentinelRouter: Router = Router()

sentinelRouter.post('/assess', async (req: Request, res: Response) => {
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

sentinelRouter.get('/blacklist', (req: Request, res: Response) => {
  const limit = Number(req.query.limit ?? '50')
  res.json({ entries: listBlacklist({ limit }) })
})

sentinelRouter.post('/blacklist', (req: Request, res: Response) => {
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

sentinelRouter.delete('/blacklist/:id', (req: Request, res: Response) => {
  const wallet = (req as unknown as Record<string, unknown>).wallet as string | undefined
  const reason = (req.body?.reason as string) ?? 'manual removal'
  softRemoveBlacklist(req.params.id, wallet ? `admin:${wallet}` : 'admin', reason)
  res.json({ success: true })
})

sentinelRouter.get('/pending', (req: Request, res: Response) => {
  const wallet = req.query.wallet as string | undefined
  const status = req.query.status as string | undefined
  res.json({ actions: listPendingActions({ wallet, status }) })
})

sentinelRouter.post('/pending/:id/cancel', (req: Request, res: Response) => {
  const reason = (req.body?.reason as string) ?? 'manual cancel'
  const wallet = (req as unknown as Record<string, unknown>).wallet as string | undefined
  const ok = cancelCircuitBreakerAction(req.params.id, wallet ? `user:${wallet}` : 'admin', reason)
  res.json({ success: ok })
})

sentinelRouter.get('/decisions', (req: Request, res: Response) => {
  const limit = Number(req.query.limit ?? '50')
  const source = req.query.source as string | undefined
  res.json({ decisions: listDecisions({ limit, source }) })
})

sentinelRouter.get('/status', (_req: Request, res: Response) => {
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
