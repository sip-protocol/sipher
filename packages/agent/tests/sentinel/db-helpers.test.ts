import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('SENTINEL DB helpers', () => {
  beforeEach(() => {
    process.env.DB_PATH = ':memory:'
  })

  afterEach(() => {
    delete process.env.DB_PATH
  })

  async function freshDb() {
    const { closeDb, getDb } = await import('../../src/db.js')
    closeDb()
    getDb()
  }

  describe('blacklist', () => {
    it('insertBlacklist + getActiveBlacklistEntry round-trips', async () => {
      await freshDb()
      const { insertBlacklist, getActiveBlacklistEntry } = await import('../../src/db.js')
      const id = insertBlacklist({
        address: 'abc123',
        reason: 'known scam',
        severity: 'block',
        addedBy: 'sentinel',
      })
      expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/i)
      const entry = getActiveBlacklistEntry('abc123')
      expect(entry).not.toBeNull()
      expect(entry!.reason).toBe('known scam')
      expect(entry!.severity).toBe('block')
    })

    it('softRemoveBlacklist makes an entry inactive', async () => {
      await freshDb()
      const { insertBlacklist, softRemoveBlacklist, getActiveBlacklistEntry } = await import('../../src/db.js')
      const id = insertBlacklist({ address: 'abc', reason: 'r', severity: 'warn', addedBy: 'sentinel' })
      softRemoveBlacklist(id, 'admin', 'false positive')
      expect(getActiveBlacklistEntry('abc')).toBeNull()
    })

    it('expired blacklist entries are not returned as active', async () => {
      await freshDb()
      const { insertBlacklist, getActiveBlacklistEntry } = await import('../../src/db.js')
      insertBlacklist({
        address: 'abc',
        reason: 'r',
        severity: 'block',
        addedBy: 'sentinel',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      })
      expect(getActiveBlacklistEntry('abc')).toBeNull()
    })

    it('listBlacklist returns active entries paginated', async () => {
      await freshDb()
      const { insertBlacklist, listBlacklist } = await import('../../src/db.js')
      for (let i = 0; i < 5; i++) {
        insertBlacklist({ address: `a${i}`, reason: 'r', severity: 'warn', addedBy: 'sentinel' })
      }
      const page = listBlacklist({ limit: 3 })
      expect(page.length).toBe(3)
    })

    it('countBlacklistAddedByInLastHour filters by added_by and time', async () => {
      await freshDb()
      const { insertBlacklist, countBlacklistAddedByInLastHour } = await import('../../src/db.js')
      insertBlacklist({ address: 'a', reason: 'r', severity: 'warn', addedBy: 'sentinel' })
      insertBlacklist({ address: 'b', reason: 'r', severity: 'warn', addedBy: 'admin:rector' })
      expect(countBlacklistAddedByInLastHour('sentinel')).toBe(1)
    })
  })

  describe('risk_history', () => {
    it('insertRiskHistory + getRiskHistory round-trips', async () => {
      await freshDb()
      const { insertRiskHistory, getRiskHistory } = await import('../../src/db.js')
      insertRiskHistory({
        address: 'abc',
        risk: 'medium',
        score: 50,
        reasons: ['new address', 'large amount'],
        recommendation: 'warn',
        decisionId: 'dec1',
        contextAction: 'send',
        wallet: 'w1',
      })
      const rows = getRiskHistory('abc', 10)
      expect(rows.length).toBe(1)
      expect(rows[0].risk).toBe('medium')
      expect(rows[0].reasons).toEqual(['new address', 'large amount'])
    })
  })

  describe('pending_actions', () => {
    it('insertPendingAction + getPendingAction round-trips', async () => {
      await freshDb()
      const { insertPendingAction, getPendingAction } = await import('../../src/db.js')
      const id = insertPendingAction({
        actionType: 'refund',
        payload: { pda: 'pda1', amount: 1.5 },
        reasoning: 'auto refund',
        wallet: 'w1',
        delayMs: 30000,
        decisionId: 'dec1',
      })
      const row = getPendingAction(id)
      expect(row).not.toBeNull()
      expect(row!.status).toBe('pending')
      expect(row!.payload).toEqual({ pda: 'pda1', amount: 1.5 })
    })

    it('getDuePendingActions returns rows whose execute_at has passed', async () => {
      await freshDb()
      const { insertPendingAction, getDuePendingActions, getDb } = await import('../../src/db.js')
      const id = insertPendingAction({
        actionType: 'refund',
        payload: { pda: 'p' },
        reasoning: 'r',
        wallet: 'w',
        delayMs: 0,
      })
      // Force execute_at into the past
      getDb().prepare(`UPDATE sentinel_pending_actions SET execute_at = ? WHERE id = ?`)
        .run(new Date(Date.now() - 1000).toISOString(), id)
      const due = getDuePendingActions()
      expect(due.map((r) => r.id)).toContain(id)
    })

    it('cancelPendingAction sets status=cancelled with reason', async () => {
      await freshDb()
      const { insertPendingAction, cancelPendingAction, getPendingAction } = await import('../../src/db.js')
      const id = insertPendingAction({ actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w', delayMs: 60000 })
      cancelPendingAction(id, 'kill-switch', 'operator paused')
      const row = getPendingAction(id)
      expect(row!.status).toBe('cancelled')
      expect(row!.cancelledBy).toBe('kill-switch')
      expect(row!.cancelReason).toBe('operator paused')
    })

    it('markPendingActionExecuting + markPendingActionExecuted transitions', async () => {
      await freshDb()
      const { insertPendingAction, markPendingActionExecuting, markPendingActionExecuted, getPendingAction }
        = await import('../../src/db.js')
      const id = insertPendingAction({ actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w', delayMs: 0 })
      markPendingActionExecuting(id)
      expect(getPendingAction(id)!.status).toBe('executing')
      markPendingActionExecuted(id, { success: true, txId: 'sig1' })
      const row = getPendingAction(id)!
      expect(row.status).toBe('executed')
      expect(row.result).toEqual({ success: true, txId: 'sig1' })
    })

    it('countFundActionsInLastHour counts per-wallet non-cancelled refunds', async () => {
      await freshDb()
      const { insertPendingAction, countFundActionsInLastHour, cancelPendingAction }
        = await import('../../src/db.js')
      const a = insertPendingAction({ actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 0 })
      insertPendingAction({ actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 0 })
      insertPendingAction({ actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w2', delayMs: 0 })
      cancelPendingAction(a, 'kill-switch', 'x')
      expect(countFundActionsInLastHour('w1')).toBe(1) // a cancelled, 1 still counts
      expect(countFundActionsInLastHour('w2')).toBe(1)
    })
  })

  describe('decisions', () => {
    it('insertDecisionDraft reserves a ULID and returns it', async () => {
      await freshDb()
      const { insertDecisionDraft, getDecision } = await import('../../src/db.js')
      const id = insertDecisionDraft({
        invocationSource: 'preflight',
        triggerContext: { action: 'send', amount: 1 },
        model: 'anthropic/claude-sonnet-4.6',
      })
      const row = getDecision(id)
      expect(row).not.toBeNull()
      expect(row!.verdict).toBe('pending')
    })

    it('appendDecisionToolCall accumulates tool_calls array', async () => {
      await freshDb()
      const { insertDecisionDraft, appendDecisionToolCall, getDecision } = await import('../../src/db.js')
      const id = insertDecisionDraft({ invocationSource: 'reactive', triggerContext: {}, model: 'm' })
      appendDecisionToolCall(id, { name: 'checkReputation', args: { address: 'a' }, result: { blacklisted: false } })
      appendDecisionToolCall(id, { name: 'getRecentActivity', args: {}, result: { count: 0 } })
      const row = getDecision(id)!
      expect(row.toolCalls).toHaveLength(2)
      expect(row.toolCalls[0].name).toBe('checkReputation')
    })

    it('finalizeDecision sets verdict + tokens + cost', async () => {
      await freshDb()
      const { insertDecisionDraft, finalizeDecision, getDecision } = await import('../../src/db.js')
      const id = insertDecisionDraft({ invocationSource: 'query', triggerContext: {}, model: 'm' })
      finalizeDecision(id, {
        verdict: 'allow',
        verdictDetail: { risk: 'low' },
        reasoning: 'all clear',
        durationMs: 1234,
        inputTokens: 500,
        outputTokens: 200,
        costUsd: 0.002,
      })
      const row = getDecision(id)!
      expect(row.verdict).toBe('allow')
      expect(row.durationMs).toBe(1234)
      expect(row.costUsd).toBe(0.002)
    })

    it('dailyDecisionCostUsd sums cost over last 24h', async () => {
      await freshDb()
      const { insertDecisionDraft, finalizeDecision, dailyDecisionCostUsd } = await import('../../src/db.js')
      const a = insertDecisionDraft({ invocationSource: 'query', triggerContext: {}, model: 'm' })
      finalizeDecision(a, { verdict: 'allow', verdictDetail: {}, reasoning: '', durationMs: 1, inputTokens: 1, outputTokens: 1, costUsd: 0.5 })
      const b = insertDecisionDraft({ invocationSource: 'query', triggerContext: {}, model: 'm' })
      finalizeDecision(b, { verdict: 'allow', verdictDetail: {}, reasoning: '', durationMs: 1, inputTokens: 1, outputTokens: 1, costUsd: 0.7 })
      expect(dailyDecisionCostUsd()).toBeCloseTo(1.2, 4)
    })
  })
})
