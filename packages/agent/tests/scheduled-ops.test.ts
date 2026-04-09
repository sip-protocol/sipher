import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getDb,
  closeDb,
  getOrCreateSession,
  createScheduledOp,
  getScheduledOp,
  getScheduledOpsBySession,
  getPendingOps,
  updateScheduledOp,
  cancelScheduledOp,
} from '../src/db.js'

const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

describe('createScheduledOp', () => {
  it('creates an op with all fields', () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id,
      action: 'send',
      params: { amount: 10, token: 'SOL', recipient: 'addr' },
      wallet_signature: 'sig123',
      next_exec: Date.now() + 60_000,
      expires_at: Date.now() + 3600_000,
      max_exec: 1,
    })

    expect(op.id).toBeDefined()
    expect(op.session_id).toBe(session.id)
    expect(op.action).toBe('send')
    expect(op.params).toEqual({ amount: 10, token: 'SOL', recipient: 'addr' })
    expect(op.status).toBe('pending')
    expect(op.exec_count).toBe(0)
  })

  it('uses custom id when provided', () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      id: 'custom-op-id',
      session_id: session.id,
      action: 'send',
      params: {},
      wallet_signature: 'sig',
      next_exec: Date.now() + 60_000,
      expires_at: Date.now() + 3600_000,
      max_exec: 1,
    })
    expect(op.id).toBe('custom-op-id')
  })
})

describe('getScheduledOp', () => {
  it('retrieves an existing op', () => {
    const session = getOrCreateSession(WALLET)
    const created = createScheduledOp({
      session_id: session.id,
      action: 'send',
      params: { amount: 5 },
      wallet_signature: 'sig',
      next_exec: Date.now() + 60_000,
      expires_at: Date.now() + 3600_000,
      max_exec: 1,
    })
    const retrieved = getScheduledOp(created.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.id).toBe(created.id)
    expect(retrieved!.params).toEqual({ amount: 5 })
  })

  it('returns null for unknown id', () => {
    expect(getScheduledOp('nonexistent')).toBeNull()
  })
})

describe('getScheduledOpsBySession', () => {
  it('returns ops for a session sorted by next_exec ASC', () => {
    const session = getOrCreateSession(WALLET)
    const now = Date.now()
    createScheduledOp({
      session_id: session.id, action: 'send', params: { i: 2 },
      wallet_signature: 'sig', next_exec: now + 120_000, expires_at: now + 3600_000, max_exec: 1,
    })
    createScheduledOp({
      session_id: session.id, action: 'send', params: { i: 1 },
      wallet_signature: 'sig', next_exec: now + 60_000, expires_at: now + 3600_000, max_exec: 1,
    })
    const ops = getScheduledOpsBySession(session.id)
    expect(ops).toHaveLength(2)
    expect(ops[0].params.i).toBe(1)
    expect(ops[1].params.i).toBe(2)
  })

  it('returns empty for unknown session', () => {
    expect(getScheduledOpsBySession('unknown')).toHaveLength(0)
  })
})

describe('getPendingOps', () => {
  it('returns ops where next_exec <= now and status is pending', () => {
    const session = getOrCreateSession(WALLET)
    const now = Date.now()
    createScheduledOp({
      session_id: session.id, action: 'send', params: { due: true },
      wallet_signature: 'sig', next_exec: now - 1000, expires_at: now + 3600_000, max_exec: 1,
    })
    createScheduledOp({
      session_id: session.id, action: 'send', params: { due: false },
      wallet_signature: 'sig', next_exec: now + 60_000, expires_at: now + 3600_000, max_exec: 1,
    })
    const pending = getPendingOps(now)
    expect(pending).toHaveLength(1)
    expect(pending[0].params.due).toBe(true)
  })

  it('excludes non-pending statuses', () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id, action: 'send', params: {},
      wallet_signature: 'sig', next_exec: Date.now() - 1000, expires_at: Date.now() + 3600_000, max_exec: 1,
    })
    updateScheduledOp(op.id, { status: 'completed' })
    expect(getPendingOps()).toHaveLength(0)
  })
})

describe('updateScheduledOp', () => {
  it('updates status', () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id, action: 'send', params: {},
      wallet_signature: 'sig', next_exec: Date.now(), expires_at: Date.now() + 3600_000, max_exec: 3,
    })
    updateScheduledOp(op.id, { status: 'executing' })
    expect(getScheduledOp(op.id)!.status).toBe('executing')
  })

  it('updates exec_count and next_exec', () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id, action: 'send', params: {},
      wallet_signature: 'sig', next_exec: Date.now(), expires_at: Date.now() + 3600_000, max_exec: 3,
    })
    const nextExec = Date.now() + 120_000
    updateScheduledOp(op.id, { exec_count: 1, next_exec: nextExec, status: 'pending' })
    const updated = getScheduledOp(op.id)!
    expect(updated.exec_count).toBe(1)
    expect(updated.next_exec).toBe(nextExec)
    expect(updated.status).toBe('pending')
  })
})

describe('cancelScheduledOp', () => {
  it('sets status to cancelled', () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id, action: 'send', params: {},
      wallet_signature: 'sig', next_exec: Date.now() + 60_000, expires_at: Date.now() + 3600_000, max_exec: 1,
    })
    cancelScheduledOp(op.id)
    expect(getScheduledOp(op.id)!.status).toBe('cancelled')
  })

  it('throws for non-existent op', () => {
    expect(() => cancelScheduledOp('nonexistent')).toThrow()
  })
})
