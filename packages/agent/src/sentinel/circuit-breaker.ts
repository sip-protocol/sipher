import {
  insertPendingAction,
  getPendingAction,
  getAllPendingActionsWithStatus,
  cancelPendingAction,
  markPendingActionExecuting,
  markPendingActionExecuted,
  getDb,
  type PendingActionRow,
} from '../db.js'
import { guardianBus } from '../coordination/event-bus.js'
import { isKillSwitchActive } from '../routes/squad-api.js'
import { getSentinelConfig } from './config.js'

export type ActionExecutor = (
  payload: Record<string, unknown>,
) => Promise<Record<string, unknown>>

const executors: Map<string, ActionExecutor> = new Map()
const timers: Map<string, NodeJS.Timeout> = new Map()

const STALE_WINDOW_MS = 5 * 60_000

export function registerActionExecutor(actionType: string, exec: ActionExecutor): void {
  executors.set(actionType, exec)
}

export function clearAllTimers(): void {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
}

export interface ScheduleActionParams {
  actionType: string
  payload: Record<string, unknown>
  reasoning: string
  wallet: string
  delayMs: number
  decisionId?: string
}

export function scheduleCancellableAction(params: ScheduleActionParams): string {
  const id = insertPendingAction(params)
  const timer = setTimeout(() => {
    timers.delete(id)
    executePendingAction(id).catch((err) => {
      guardianBus.emit({
        source: 'sentinel',
        type: 'sentinel:execute-error',
        level: 'important',
        data: { actionId: id, error: err instanceof Error ? err.message : String(err) },
        wallet: params.wallet,
        timestamp: new Date().toISOString(),
      })
    })
  }, Math.max(0, params.delayMs))
  timer.unref()
  timers.set(id, timer)

  guardianBus.emit({
    source: 'sentinel',
    type: 'sentinel:pending-action',
    level: 'important',
    data: { actionId: id, actionType: params.actionType, delayMs: params.delayMs, reasoning: params.reasoning },
    wallet: params.wallet,
    timestamp: new Date().toISOString(),
  })
  return id
}

export function cancelCircuitBreakerAction(
  id: string,
  cancelledBy: string,
  reason: string,
): boolean {
  const row = getPendingAction(id)
  if (!row || row.status !== 'pending') return false
  cancelPendingAction(id, cancelledBy, reason)
  const t = timers.get(id)
  if (t) {
    clearTimeout(t)
    timers.delete(id)
  }
  guardianBus.emit({
    source: 'sentinel',
    type: 'sentinel:action-cancelled',
    level: 'important',
    data: { actionId: id, cancelledBy, reason, actionType: row.actionType },
    wallet: row.wallet,
    timestamp: new Date().toISOString(),
  })
  return true
}

export async function executePendingAction(id: string): Promise<void> {
  const row = getPendingAction(id)
  if (!row || row.status !== 'pending') return

  // Gate 1 — kill switch
  if (isKillSwitchActive()) {
    cancelCircuitBreakerAction(id, 'kill-switch', 'kill switch active at execute time')
    return
  }

  // Gate 2 — rate limit: count only already-executed refunds in the last hour
  // (pending rows represent scheduled actions that haven't fired yet and must
  //  not consume the hourly budget before they actually execute)
  const config = getSentinelConfig()
  const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString()
  const { count: executedCount } = getDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM sentinel_pending_actions
       WHERE wallet = ? AND action_type = 'refund'
         AND scheduled_at > ? AND status = 'executed'`,
    )
    .get(row.wallet, oneHourAgo) as { count: number }
  if (executedCount >= config.rateLimitFundPerHour) {
    cancelCircuitBreakerAction(id, 'rate-limit', `exceeded ${config.rateLimitFundPerHour}/hr cap`)
    guardianBus.emit({
      source: 'sentinel',
      type: 'sentinel:rate-limit-hit',
      level: 'important',
      data: { actionId: id, wallet: row.wallet, cap: config.rateLimitFundPerHour, executed: executedCount },
      wallet: row.wallet,
      timestamp: new Date().toISOString(),
    })
    return
  }

  // Gate 3 — mode check (advisory cannot execute fund-moving)
  if (config.mode === 'advisory' && row.actionType === 'refund') {
    cancelCircuitBreakerAction(id, 'mode-change', 'advisory mode blocks fund actions')
    return
  }

  const executor = executors.get(row.actionType)
  if (!executor) {
    cancelCircuitBreakerAction(id, 'sentinel', `no executor registered for ${row.actionType}`)
    return
  }

  markPendingActionExecuting(id)
  let result: Record<string, unknown>
  try {
    result = await executor(row.payload)
    markPendingActionExecuted(id, result)
    guardianBus.emit({
      source: 'sentinel',
      type: 'sentinel:action-taken',
      level: 'important',
      data: { actionId: id, actionType: row.actionType, result },
      wallet: row.wallet,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    markPendingActionExecuted(id, { success: false, error: message })
    guardianBus.emit({
      source: 'sentinel',
      type: 'sentinel:action-error',
      level: 'important',
      data: { actionId: id, error: message },
      wallet: row.wallet,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * On server startup, walk all pending actions and decide:
 *   - execute_at > now → reschedule timer
 *   - execute_at <= now, within STALE_WINDOW_MS → execute immediately
 *   - execute_at <= now, older than STALE_WINDOW_MS → cancel (server-restart-stale)
 */
export async function restorePendingActions(): Promise<void> {
  const rows: PendingActionRow[] = [
    ...getAllPendingActionsWithStatus('pending'),
    ...getAllPendingActionsWithStatus('executing'), // orphaned mid-execute
  ]
  const now = Date.now()

  for (const row of rows) {
    const executeAt = new Date(row.executeAt).getTime()
    const staleness = now - executeAt

    // Orphaned 'executing' — conservatively cancel as stale
    if (row.status === 'executing') {
      cancelPendingAction(row.id, 'server-restart-stale', 'orphaned during execution')
      continue
    }

    if (executeAt > now) {
      // Future — reschedule with remaining delay
      const remaining = executeAt - now
      const timer = setTimeout(() => {
        timers.delete(row.id)
        executePendingAction(row.id).catch(() => {})
      }, remaining)
      timer.unref()
      timers.set(row.id, timer)
      continue
    }

    if (staleness <= STALE_WINDOW_MS) {
      // Overdue but within tolerance — execute
      await executePendingAction(row.id)
    } else {
      cancelPendingAction(row.id, 'server-restart-stale', `execute_at ${staleness}ms ago`)
      guardianBus.emit({
        source: 'sentinel',
        type: 'sentinel:action-cancelled',
        level: 'important',
        data: { actionId: row.id, cancelledBy: 'server-restart-stale', staleness },
        wallet: row.wallet,
        timestamp: new Date().toISOString(),
      })
    }
  }
}
