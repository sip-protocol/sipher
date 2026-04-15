import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('circuit breaker', () => {
  beforeEach(() => {
    process.env.DB_PATH = ':memory:'
    vi.resetModules()  // ensure each test gets fresh module instances
  })
  afterEach(() => { delete process.env.DB_PATH; vi.useRealTimers() })

  async function freshDb() {
    const { closeDb, getDb } = await import('../../src/db.js')
    closeDb()
    getDb()
  }

  it('scheduleCancellableAction inserts a pending row + returns id', async () => {
    await freshDb()
    const cb = await import('../../src/sentinel/circuit-breaker.js')
    const { getPendingAction } = await import('../../src/db.js')
    const id = cb.scheduleCancellableAction({
      actionType: 'refund',
      payload: { pda: 'p1', amount: 2 },
      reasoning: 'auto refund large amount',
      wallet: 'w1',
      delayMs: 5000,
    })
    const row = getPendingAction(id)
    expect(row).not.toBeNull()
    expect(row!.status).toBe('pending')
    expect(row!.payload).toEqual({ pda: 'p1', amount: 2 })
    cb.clearAllTimers()
  })

  it('scheduleCancellableAction emits sentinel:pending-action event', async () => {
    await freshDb()
    const { guardianBus } = await import('../../src/coordination/event-bus.js')
    const cb = await import('../../src/sentinel/circuit-breaker.js')
    let captured: unknown = null
    const handler = (e: unknown) => { captured = e }
    guardianBus.on('sentinel:pending-action', handler)
    cb.scheduleCancellableAction({
      actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 1000,
    })
    expect(captured).toMatchObject({ source: 'sentinel', type: 'sentinel:pending-action' })
    guardianBus.off('sentinel:pending-action', handler)
    cb.clearAllTimers()
  })

  it('executePendingAction runs registered executor + marks executed', async () => {
    await freshDb()
    const cb = await import('../../src/sentinel/circuit-breaker.js')
    const { getPendingAction } = await import('../../src/db.js')
    let called: Record<string, unknown> | null = null
    cb.registerActionExecutor('refund', async (payload) => {
      called = payload
      return { success: true, txId: 'sig1' }
    })
    const id = cb.scheduleCancellableAction({
      actionType: 'refund', payload: { pda: 'p1' }, reasoning: 'r', wallet: 'w1', delayMs: 0,
    })
    await cb.executePendingAction(id)
    expect(called).toEqual({ pda: 'p1' })
    expect(getPendingAction(id)!.status).toBe('executed')
    cb.clearAllTimers()
  })

  it('cancelling before execute prevents run', async () => {
    await freshDb()
    const cb = await import('../../src/sentinel/circuit-breaker.js')
    const { getPendingAction } = await import('../../src/db.js')
    cb.registerActionExecutor('refund', async () => {
      throw new Error('should not be called')
    })
    const id = cb.scheduleCancellableAction({
      actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 60000,
    })
    const ok = cb.cancelCircuitBreakerAction(id, 'user:w1', 'user aborted')
    expect(ok).toBe(true)
    expect(getPendingAction(id)!.status).toBe('cancelled')
    // Trying to execute a cancelled one is a no-op
    await cb.executePendingAction(id)
    expect(getPendingAction(id)!.status).toBe('cancelled')
    cb.clearAllTimers()
  })

  it('kill switch active at execute time cancels', async () => {
    await freshDb()
    vi.doMock('../../src/routes/squad-api.js', () => ({ isKillSwitchActive: () => true }))
    const cb = await import('../../src/sentinel/circuit-breaker.js')
    const { getPendingAction } = await import('../../src/db.js')
    cb.registerActionExecutor('refund', async () => ({ success: true }))
    const id = cb.scheduleCancellableAction({
      actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 0,
    })
    await cb.executePendingAction(id)
    const row = getPendingAction(id)!
    expect(row.status).toBe('cancelled')
    expect(row.cancelledBy).toBe('kill-switch')
    cb.clearAllTimers()
    vi.doUnmock('../../src/routes/squad-api.js')
  })

  it('rate-limit exceeded at execute cancels', async () => {
    await freshDb()
    process.env.SENTINEL_RATE_LIMIT_FUND_PER_HOUR = '1'
    const cb = await import('../../src/sentinel/circuit-breaker.js')
    const { getPendingAction } = await import('../../src/db.js')
    cb.registerActionExecutor('refund', async () => ({ success: true }))
    // Two scheduled actions for same wallet; cap=1 means first executes, second gets cancelled
    const id1 = cb.scheduleCancellableAction({
      actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 0,
    })
    const id2 = cb.scheduleCancellableAction({
      actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 0,
    })
    await cb.executePendingAction(id1)
    await cb.executePendingAction(id2)
    expect(getPendingAction(id1)!.status).toBe('executed')
    const row2 = getPendingAction(id2)!
    expect(row2.status).toBe('cancelled')
    expect(row2.cancelledBy).toBe('rate-limit')
    delete process.env.SENTINEL_RATE_LIMIT_FUND_PER_HOUR
    cb.clearAllTimers()
  })

  it('restorePendingActions: reschedules future actions, executes overdue within stale window', async () => {
    await freshDb()
    const cb = await import('../../src/sentinel/circuit-breaker.js')
    const { insertPendingAction, getDb, getPendingAction } = await import('../../src/db.js')
    cb.registerActionExecutor('refund', async () => ({ success: true }))

    // Future: should be rescheduled
    const futureId = insertPendingAction({
      actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 60_000,
    })
    // Overdue within 5min window: should execute
    const overdueId = insertPendingAction({
      actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 0,
    })
    getDb().prepare(`UPDATE sentinel_pending_actions SET execute_at = ? WHERE id = ?`)
      .run(new Date(Date.now() - 2 * 60_000).toISOString(), overdueId)
    // Stale > 5min: should cancel
    const staleId = insertPendingAction({
      actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 0,
    })
    getDb().prepare(`UPDATE sentinel_pending_actions SET execute_at = ? WHERE id = ?`)
      .run(new Date(Date.now() - 30 * 60_000).toISOString(), staleId)

    await cb.restorePendingActions()

    expect(getPendingAction(overdueId)!.status).toBe('executed')
    expect(getPendingAction(staleId)!.status).toBe('cancelled')
    expect(getPendingAction(staleId)!.cancelledBy).toBe('server-restart-stale')
    // future still pending
    expect(getPendingAction(futureId)!.status).toBe('pending')

    cb.clearAllTimers()
  })
})
