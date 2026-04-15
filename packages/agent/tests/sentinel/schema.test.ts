import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('SENTINEL database schema', () => {
  beforeEach(() => {
    process.env.DB_PATH = ':memory:'
  })

  afterEach(() => {
    delete process.env.DB_PATH
  })

  async function freshDb() {
    const { closeDb, getDb } = await import('../../src/db.js')
    closeDb()
    return getDb()
  }

  it('creates sentinel_blacklist table with expected columns', async () => {
    const db = await freshDb()
    const cols = db.prepare(`PRAGMA table_info(sentinel_blacklist)`).all() as { name: string }[]
    const names = cols.map((c) => c.name).sort()
    expect(names).toEqual([
      'added_at', 'added_by', 'address', 'expires_at',
      'id', 'reason', 'removed_at', 'removed_by', 'removed_reason', 'severity',
      'source_event_id',
    ])
  })

  it('creates sentinel_risk_history with expected columns', async () => {
    const db = await freshDb()
    const cols = db.prepare(`PRAGMA table_info(sentinel_risk_history)`).all() as { name: string }[]
    const names = cols.map((c) => c.name).sort()
    expect(names).toEqual([
      'address', 'context_action', 'created_at', 'decision_id',
      'id', 'reasons', 'recommendation', 'risk', 'score', 'wallet',
    ])
  })

  it('creates sentinel_pending_actions with expected columns', async () => {
    const db = await freshDb()
    const cols = db.prepare(`PRAGMA table_info(sentinel_pending_actions)`).all() as { name: string }[]
    const names = cols.map((c) => c.name).sort()
    expect(names).toContain('execute_at')
    expect(names).toContain('cancelled_by')
    expect(names).toContain('result')
    expect(names).toContain('decision_id')
  })

  it('creates sentinel_decisions with expected columns', async () => {
    const db = await freshDb()
    const cols = db.prepare(`PRAGMA table_info(sentinel_decisions)`).all() as { name: string }[]
    const names = cols.map((c) => c.name).sort()
    expect(names).toContain('invocation_source')
    expect(names).toContain('trigger_event_id')
    expect(names).toContain('verdict')
    expect(names).toContain('input_tokens')
    expect(names).toContain('cost_usd')
  })

  it('creates idx_blacklist_active partial index', async () => {
    const db = await freshDb()
    const indices = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='sentinel_blacklist'`,
    ).all() as { name: string }[]
    expect(indices.map((i) => i.name)).toContain('idx_blacklist_active')
  })

  it('creates idx_pending_due and idx_decisions_trigger indices', async () => {
    const db = await freshDb()
    const indices = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'`,
    ).all() as { name: string }[]
    const names = indices.map((i) => i.name)
    expect(names).toContain('idx_pending_due')
    expect(names).toContain('idx_decisions_trigger')
    expect(names).toContain('idx_decisions_source')
    expect(names).toContain('idx_risk_history')
  })
})
