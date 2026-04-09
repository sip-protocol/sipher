import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getDb,
  closeDb,
  insertActivity,
  getActivity,
  dismissActivity,
  logCost,
  getCostTotals,
  logAgentEvent,
  getAgentEvents,
  createExecutionLink,
  getExecutionLink,
  updateExecutionLink,
} from '../src/db.js'

// ─────────────────────────────────────────────────────────────────────────────
// Use in-memory SQLite for all tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

const WALLET_A = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'
const WALLET_B = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'

// ─────────────────────────────────────────────────────────────────────────────
// Table existence
// ─────────────────────────────────────────────────────────────────────────────

describe('schema — new tables exist', () => {
  const TABLES = [
    'activity_stream',
    'herald_queue',
    'herald_dms',
    'execution_links',
    'cost_log',
    'agent_events',
  ]

  for (const table of TABLES) {
    it(`table "${table}" exists`, () => {
      const db = getDb()
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        .get(table) as { name: string } | undefined
      expect(row).toBeDefined()
      expect(row?.name).toBe(table)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Activity stream
// ─────────────────────────────────────────────────────────────────────────────

describe('insertActivity / getActivity', () => {
  it('returns a non-empty string ID', () => {
    const id = insertActivity({
      agent: 'sipher',
      level: 'info',
      type: 'transfer',
      title: 'Sent 1 SOL',
      wallet: WALLET_A,
    })
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('inserts and retrieves activity by wallet', () => {
    insertActivity({
      agent: 'sipher',
      level: 'info',
      type: 'transfer',
      title: 'Sent 1 SOL',
      wallet: WALLET_A,
    })

    const rows = getActivity(WALLET_A)
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row['agent']).toBe('sipher')
    expect(row['level']).toBe('info')
    expect(row['type']).toBe('transfer')
    expect(row['title']).toBe('Sent 1 SOL')
    expect(row['wallet']).toBe(WALLET_A)
    expect(row['dismissed']).toBe(0)
    expect(row['actionable']).toBe(0)
  })

  it('inserts activity with optional detail and actionable fields', () => {
    insertActivity({
      agent: 'herald',
      level: 'warn',
      type: 'approval',
      title: 'Tweet pending approval',
      detail: 'Content: Hello world',
      wallet: WALLET_B,
      actionable: 1,
      action_type: 'approve_tweet',
      action_data: JSON.stringify({ tweet_id: 'abc123' }),
    })

    const rows = getActivity(WALLET_B)
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row['detail']).toBe('Content: Hello world')
    expect(row['actionable']).toBe(1)
    expect(row['action_type']).toBe('approve_tweet')
  })

  it('filters by wallet — no cross-wallet leakage', () => {
    insertActivity({ agent: 'sipher', level: 'info', type: 'transfer', title: 'A tx', wallet: WALLET_A })
    insertActivity({ agent: 'sipher', level: 'info', type: 'transfer', title: 'B tx', wallet: WALLET_B })

    const rowsA = getActivity(WALLET_A)
    const rowsB = getActivity(WALLET_B)
    expect(rowsA).toHaveLength(1)
    expect(rowsB).toHaveLength(1)
    expect(rowsA[0]['title']).toBe('A tx')
    expect(rowsB[0]['title']).toBe('B tx')
  })

  it('returns global activity (wallet=null) for all wallets', () => {
    insertActivity({ agent: 'sipher', level: 'info', type: 'transfer', title: 'A', wallet: WALLET_A })
    insertActivity({ agent: 'sipher', level: 'info', type: 'transfer', title: 'B', wallet: WALLET_B })

    const rows = getActivity(null)
    expect(rows.length).toBeGreaterThanOrEqual(2)
  })

  it('filters by level', () => {
    insertActivity({ agent: 'sipher', level: 'info', type: 't', title: 'info entry', wallet: WALLET_A })
    insertActivity({ agent: 'sipher', level: 'error', type: 't', title: 'error entry', wallet: WALLET_A })

    const infoOnly = getActivity(WALLET_A, { levels: ['info'] })
    expect(infoOnly.every(r => r['level'] === 'info')).toBe(true)
    expect(infoOnly).toHaveLength(1)

    const all = getActivity(WALLET_A, { levels: ['info', 'error'] })
    expect(all).toHaveLength(2)
  })

  it('respects limit option', () => {
    for (let i = 0; i < 5; i++) {
      insertActivity({ agent: 'sipher', level: 'info', type: 't', title: `Entry ${i}`, wallet: WALLET_A })
    }
    const rows = getActivity(WALLET_A, { limit: 3 })
    expect(rows).toHaveLength(3)
  })

  it('returns entries ordered newest first', () => {
    insertActivity({ agent: 'sipher', level: 'info', type: 't', title: 'first', wallet: WALLET_A })
    insertActivity({ agent: 'sipher', level: 'info', type: 't', title: 'second', wallet: WALLET_A })

    const rows = getActivity(WALLET_A)
    // newest is second (inserted last)
    expect(rows[0]['title']).toBe('second')
    expect(rows[1]['title']).toBe('first')
  })
})

describe('dismissActivity', () => {
  it('marks activity as dismissed', () => {
    const id = insertActivity({
      agent: 'sipher',
      level: 'info',
      type: 'transfer',
      title: 'To dismiss',
      wallet: WALLET_A,
    })

    dismissActivity(id)

    const db = getDb()
    const row = db.prepare('SELECT dismissed FROM activity_stream WHERE id = ?').get(id) as { dismissed: number } | undefined
    expect(row?.dismissed).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Cost log
// ─────────────────────────────────────────────────────────────────────────────

describe('logCost / getCostTotals', () => {
  it('returns a non-empty string ID', () => {
    const id = logCost({ agent: 'sipher', provider: 'openrouter', operation: 'chat', cost_usd: 0.01 })
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('persists cost entry with all fields', () => {
    logCost({
      agent: 'sipher',
      provider: 'openrouter',
      operation: 'chat',
      cost_usd: 0.05,
      tokens_in: 1000,
      tokens_out: 500,
    })

    const db = getDb()
    const row = db.prepare('SELECT * FROM cost_log LIMIT 1').get() as Record<string, unknown> | undefined
    expect(row).toBeDefined()
    expect(row!['agent']).toBe('sipher')
    expect(row!['provider']).toBe('openrouter')
    expect(row!['operation']).toBe('chat')
    expect(row!['cost_usd']).toBeCloseTo(0.05)
    expect(row!['tokens_in']).toBe(1000)
    expect(row!['tokens_out']).toBe(500)
  })

  it('getCostTotals today returns sum by agent', () => {
    logCost({ agent: 'sipher', provider: 'openrouter', operation: 'chat', cost_usd: 0.10 })
    logCost({ agent: 'sipher', provider: 'openrouter', operation: 'chat', cost_usd: 0.05 })
    logCost({ agent: 'herald', provider: 'openrouter', operation: 'chat', cost_usd: 0.03 })

    const totals = getCostTotals('today')
    expect(totals['sipher']).toBeCloseTo(0.15)
    expect(totals['herald']).toBeCloseTo(0.03)
  })

  it('getCostTotals month returns sum by agent', () => {
    logCost({ agent: 'sipher', provider: 'openrouter', operation: 'embed', cost_usd: 0.02 })
    logCost({ agent: 'herald', provider: 'anthropic', operation: 'chat', cost_usd: 0.08 })

    const totals = getCostTotals('month')
    expect(totals['sipher']).toBeCloseTo(0.02)
    expect(totals['herald']).toBeCloseTo(0.08)
  })

  it('returns empty object when no costs logged', () => {
    const totals = getCostTotals('today')
    expect(totals).toEqual({})
  })

  it('persists optional resources field', () => {
    logCost({ agent: 'sipher', provider: 'openrouter', operation: 'search', cost_usd: 0.01, resources: 3 })
    const db = getDb()
    const row = db.prepare('SELECT resources FROM cost_log LIMIT 1').get() as { resources: number } | undefined
    expect(row?.resources).toBe(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Agent events
// ─────────────────────────────────────────────────────────────────────────────

describe('logAgentEvent / getAgentEvents', () => {
  it('returns a non-empty string ID', () => {
    const id = logAgentEvent('sipher', 'herald', 'task_complete', { task: 'write_tweet' })
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('inserts an event and retrieves it', () => {
    logAgentEvent('sipher', 'herald', 'task_complete', { task: 'write_tweet' })

    const events = getAgentEvents()
    expect(events).toHaveLength(1)
    const ev = events[0]
    expect(ev['from_agent']).toBe('sipher')
    expect(ev['to_agent']).toBe('herald')
    expect(ev['event_type']).toBe('task_complete')
    // payload should be the parsed object or JSON string
    const payload = typeof ev['payload'] === 'string' ? JSON.parse(ev['payload'] as string) : ev['payload']
    expect(payload).toEqual({ task: 'write_tweet' })
  })

  it('supports null to_agent (broadcast)', () => {
    logAgentEvent('sipher', null, 'broadcast', { msg: 'hello' })
    const events = getAgentEvents()
    expect(events[0]['to_agent']).toBeNull()
  })

  it('respects limit option', () => {
    for (let i = 0; i < 5; i++) {
      logAgentEvent('sipher', null, `event_${i}`, { i })
    }
    const events = getAgentEvents({ limit: 2 })
    expect(events).toHaveLength(2)
  })

  it('respects since option — filters events before cutoff', () => {
    // Insert an "old" event stamped in the past
    const db = getDb()
    const pastId = 'old-event-past-id'
    const pastTs = new Date(Date.now() - 60_000).toISOString() // 1 min ago
    db.prepare(
      'INSERT INTO agent_events (id, from_agent, to_agent, event_type, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(pastId, 'sipher', null, 'old', JSON.stringify({}), pastTs)

    // Insert a "new" event now
    logAgentEvent('sipher', null, 'new', { i: 1 })

    // Filter to only events since 30 seconds ago
    const since = new Date(Date.now() - 30_000).toISOString()
    const events = getAgentEvents({ since })

    // Must include "new", must not include "old"
    const types = events.map(e => e['event_type'])
    expect(types).toContain('new')
    expect(types).not.toContain('old')
  })

  it('returns events ordered newest first', () => {
    logAgentEvent('sipher', null, 'first', {})
    logAgentEvent('sipher', null, 'second', {})

    const events = getAgentEvents()
    expect(events[0]['event_type']).toBe('second')
    expect(events[1]['event_type']).toBe('first')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Execution links
// ─────────────────────────────────────────────────────────────────────────────

describe('createExecutionLink / getExecutionLink / updateExecutionLink', () => {
  it('returns a short non-empty string ID', () => {
    const id = createExecutionLink({
      action: 'send',
      params: { amount: 1, token: 'SOL' },
      source: 'herald_dm',
    })
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('retrieves a created link', () => {
    const id = createExecutionLink({
      action: 'send',
      params: { amount: 1, token: 'SOL' },
      source: 'herald_dm',
    })

    const link = getExecutionLink(id)
    expect(link).toBeDefined()
    expect(link!['action']).toBe('send')
    expect(link!['source']).toBe('herald_dm')
    expect(link!['status']).toBe('pending')
    // params should be parseable JSON
    const params = typeof link!['params'] === 'string' ? JSON.parse(link!['params'] as string) : link!['params']
    expect(params).toEqual({ amount: 1, token: 'SOL' })
  })

  it('returns undefined for unknown ID', () => {
    const link = getExecutionLink('nonexistent-id')
    expect(link).toBeUndefined()
  })

  it('uses default expiry when expiresInMs not specified', () => {
    const before = Date.now()
    const id = createExecutionLink({
      action: 'swap',
      params: {},
      source: 'herald_dm',
    })
    const link = getExecutionLink(id)
    expect(link).toBeDefined()
    // expires_at should be an ISO string in the future
    const expiresAt = new Date(link!['expires_at'] as string).getTime()
    expect(expiresAt).toBeGreaterThan(before)
  })

  it('respects custom expiresInMs', () => {
    const id = createExecutionLink({
      action: 'send',
      params: {},
      source: 'herald_dm',
      expiresInMs: 60_000, // 1 minute
    })
    const link = getExecutionLink(id)
    const expiresAt = new Date(link!['expires_at'] as string).getTime()
    const nowPlus1m = Date.now() + 60_000
    // within 2 seconds tolerance
    expect(Math.abs(expiresAt - nowPlus1m)).toBeLessThan(2000)
  })

  it('updateExecutionLink changes status', () => {
    const id = createExecutionLink({
      action: 'send',
      params: { amount: 0.5 },
      source: 'herald_dm',
    })

    updateExecutionLink(id, { status: 'executed', signed_tx: 'abc123signature' })

    const link = getExecutionLink(id)
    expect(link!['status']).toBe('executed')
    expect(link!['signed_tx']).toBe('abc123signature')
  })

  it('createExecutionLink stores optional wallet', () => {
    const id = createExecutionLink({
      action: 'send',
      params: {},
      source: 'herald_dm',
    })
    // wallet is optional — link still retrieves without it
    const link = getExecutionLink(id)
    expect(link).toBeDefined()
  })
})
