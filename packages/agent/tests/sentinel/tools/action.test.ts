import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('SENTINEL action tools', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.DB_PATH = ':memory:'
  })
  afterEach(() => { delete process.env.DB_PATH; vi.restoreAllMocks() })

  async function freshDb() {
    const { closeDb, getDb } = await import('../../../src/db.js')
    closeDb()
    getDb()
  }

  describe('addToBlacklist', () => {
    it('inserts a blacklist row immediately', async () => {
      await freshDb()
      const { executeAddToBlacklist } = await import('../../../src/sentinel/tools/add-to-blacklist.js')
      const { getActiveBlacklistEntry } = await import('../../../src/db.js')
      const r = await executeAddToBlacklist({ address: 'bad', reason: 'scam', severity: 'block' })
      expect(r.success).toBe(true)
      expect(getActiveBlacklistEntry('bad')).not.toBeNull()
    })

    it('rate-limit cap refuses further writes', async () => {
      await freshDb()
      process.env.SENTINEL_RATE_LIMIT_BLACKLIST_PER_HOUR = '2'
      const { executeAddToBlacklist } = await import('../../../src/sentinel/tools/add-to-blacklist.js')
      await executeAddToBlacklist({ address: 'a1', reason: 'r', severity: 'warn' })
      await executeAddToBlacklist({ address: 'a2', reason: 'r', severity: 'warn' })
      const r = await executeAddToBlacklist({ address: 'a3', reason: 'r', severity: 'warn' })
      expect(r.success).toBe(false)
      expect(r.error).toMatch(/rate.limit/i)
      delete process.env.SENTINEL_RATE_LIMIT_BLACKLIST_PER_HOUR
    })
  })

  describe('removeFromBlacklist', () => {
    it('soft-deletes an entry by id', async () => {
      await freshDb()
      const { insertBlacklist, getActiveBlacklistEntry } = await import('../../../src/db.js')
      const { executeRemoveFromBlacklist } = await import('../../../src/sentinel/tools/remove-from-blacklist.js')
      const id = insertBlacklist({ address: 'abc', reason: 'r', severity: 'warn', addedBy: 'sentinel' })
      const r = await executeRemoveFromBlacklist({ entryId: id, reason: 'false positive' })
      expect(r.success).toBe(true)
      expect(getActiveBlacklistEntry('abc')).toBeNull()
    })
  })

  describe('alertUser', () => {
    it('emits sentinel:alert + inserts activity_stream row', async () => {
      await freshDb()
      const { guardianBus } = await import('../../../src/coordination/event-bus.js')
      const { executeAlertUser } = await import('../../../src/sentinel/tools/alert-user.js')
      const { getDb } = await import('../../../src/db.js')
      let captured: unknown = null
      const handler = (e: unknown) => { captured = e }
      guardianBus.on('sentinel:alert', handler)
      await executeAlertUser({
        wallet: 'w1', severity: 'warn', title: 'Suspicious deposit', detail: 'new address',
      })
      expect(captured).toMatchObject({ source: 'sentinel', type: 'sentinel:alert' })
      const rows = getDb().prepare(`SELECT * FROM activity_stream WHERE wallet = 'w1'`).all()
      expect(rows.length).toBeGreaterThan(0)
      guardianBus.off('sentinel:alert', handler)
    })
  })

  describe('executeRefund', () => {
    it('below threshold → immediate (mocked) refund', async () => {
      await freshDb()
      process.env.SENTINEL_AUTO_REFUND_THRESHOLD = '5'
      const vaultRefund = vi.fn().mockResolvedValue({ success: true, txId: 'sig1' })
      vi.doMock('../../../src/sentinel/vault-refund.js', () => ({
        performVaultRefund: vaultRefund,
      }))
      const { executeSentinelRefund } = await import('../../../src/sentinel/tools/execute-refund.js')
      const r = await executeSentinelRefund({ pda: 'p1', amount: 0.5, reasoning: 'test', wallet: 'w1' })
      expect(r.mode).toBe('immediate')
      expect(r.result).toEqual({ success: true, txId: 'sig1' })
      expect(vaultRefund).toHaveBeenCalledWith('p1', 0.5)
      delete process.env.SENTINEL_AUTO_REFUND_THRESHOLD
      vi.doUnmock('../../../src/sentinel/vault-refund.js')
    })

    it('above threshold → schedules circuit-breaker action', async () => {
      await freshDb()
      process.env.SENTINEL_AUTO_REFUND_THRESHOLD = '1'
      process.env.SENTINEL_CANCEL_WINDOW_MS = '30000'
      const cb = await import('../../../src/sentinel/circuit-breaker.js')
      cb.registerActionExecutor('refund', async () => ({ success: true }))
      const { executeSentinelRefund } = await import('../../../src/sentinel/tools/execute-refund.js')
      const r = await executeSentinelRefund({ pda: 'p1', amount: 2, reasoning: 'test', wallet: 'w1' })
      expect(r.mode).toBe('scheduled')
      expect(r.actionId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/i)
      cb.clearAllTimers()
      delete process.env.SENTINEL_AUTO_REFUND_THRESHOLD
      delete process.env.SENTINEL_CANCEL_WINDOW_MS
    })

    it('advisory mode blocks executeSentinelRefund regardless of threshold', async () => {
      await freshDb()
      process.env.SENTINEL_MODE = 'advisory'
      const { executeSentinelRefund } = await import('../../../src/sentinel/tools/execute-refund.js')
      await expect(
        executeSentinelRefund({ pda: 'p1', amount: 0.1, reasoning: 'test', wallet: 'w1' }),
      ).rejects.toThrow(/advisory/)
      delete process.env.SENTINEL_MODE
    })
  })

  describe('cancelPendingAction', () => {
    it('delegates to circuit breaker', async () => {
      await freshDb()
      const cb = await import('../../../src/sentinel/circuit-breaker.js')
      const id = cb.scheduleCancellableAction({
        actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 60000,
      })
      const { executeCancelPending } = await import('../../../src/sentinel/tools/cancel-pending.js')
      const r = await executeCancelPending({ actionId: id, reason: 'reconsidered' })
      expect(r.success).toBe(true)
      const { getPendingAction } = await import('../../../src/db.js')
      expect(getPendingAction(id)!.status).toBe('cancelled')
      cb.clearAllTimers()
    })
  })

  describe('vetoSipherAction', () => {
    it('returns a structured veto record for the caller to surface', async () => {
      await freshDb()
      const { executeVetoSipher } = await import('../../../src/sentinel/tools/veto-sipher-action.js')
      const r = await executeVetoSipher({ contextId: 'ctx1', reason: 'known scam address' })
      expect(r.vetoed).toBe(true)
      expect(r.reason).toBe('known scam address')
    })
  })

  it('SENTINEL_ACTION_TOOLS registry contains all 7 action tools', async () => {
    const { SENTINEL_ACTION_TOOLS } = await import('../../../src/sentinel/tools/index.js')
    const names = SENTINEL_ACTION_TOOLS.map((t) => t.name).sort()
    expect(names).toEqual([
      'addToBlacklist',
      'alertUser',
      'cancelPendingAction',
      'executeRefund',
      'removeFromBlacklist',
      'scheduleCancellableAction',
      'vetoSipherAction',
    ])
  })
})
