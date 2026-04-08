import {
  getPendingOps,
  updateScheduledOp,
  logAudit,
} from './db.js'

const MISS_WINDOW_MS = 5 * 60 * 1000

export type OpExecutor = (action: string, params: Record<string, unknown>) => Promise<unknown>

export interface CrankTickResult {
  executed: number
  expired: number
  missed: number
  failed: number
}

export async function crankTick(executor: OpExecutor): Promise<CrankTickResult> {
  const now = Date.now()
  const ops = getPendingOps(now)
  const result: CrankTickResult = { executed: 0, expired: 0, missed: 0, failed: 0 }

  for (const op of ops) {
    if (op.expires_at < now) {
      updateScheduledOp(op.id, { status: 'expired' })
      result.expired++
      continue
    }

    if (op.next_exec < now - MISS_WINDOW_MS) {
      updateScheduledOp(op.id, { status: 'missed' })
      result.missed++
      continue
    }

    try {
      updateScheduledOp(op.id, { status: 'executing' })
      await executor(op.action, op.params)

      const newExecCount = op.exec_count + 1
      logAudit(op.session_id, op.action, op.params, 'prepared')

      if (newExecCount >= op.max_exec) {
        updateScheduledOp(op.id, { status: 'completed', exec_count: newExecCount })
      } else {
        const intervalMs = (op.params.intervalMs as number) ?? 60_000
        const nextExec = now + intervalMs
        updateScheduledOp(op.id, { status: 'pending', exec_count: newExecCount, next_exec: nextExec })
      }

      result.executed++
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logAudit(op.session_id, op.action, { ...op.params, error: msg }, 'failed')
      updateScheduledOp(op.id, { status: 'pending' })
      result.failed++
    }
  }

  return result
}

export function startCrank(executor: OpExecutor): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const result = await crankTick(executor)
      const total = result.executed + result.expired + result.missed + result.failed
      if (total > 0) {
        console.log(`[crank] tick: ${result.executed} exec, ${result.expired} expired, ${result.missed} missed, ${result.failed} failed`)
      }
    } catch (error) {
      console.error('[crank] tick error:', error)
    }
  }, 60_000)
}

export function stopCrank(timer: NodeJS.Timeout): void {
  clearInterval(timer)
}
