import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  closeDb,
  getOrCreateSession,
  createScheduledOp,
  getScheduledOp,
  getDb,
} from '../src/db.js'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

const { crankTick } = await import('../src/crank.js')

const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'

describe('crankTick', () => {
  it('executes a due pending op', async () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id, action: 'send', params: { amount: 10 },
      wallet_signature: 'sig', next_exec: Date.now() - 1000,
      expires_at: Date.now() + 3600_000, max_exec: 1,
    })

    const executor = vi.fn().mockResolvedValue({ status: 'success' })
    const result = await crankTick(executor)

    expect(executor).toHaveBeenCalledWith('send', { amount: 10 })
    expect(result.executed).toBe(1)
    const updated = getScheduledOp(op.id)!
    expect(updated.status).toBe('completed')
    expect(updated.exec_count).toBe(1)
  })

  it('marks expired ops without executing', async () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id, action: 'send', params: {},
      wallet_signature: 'sig', next_exec: Date.now() - 1000,
      expires_at: Date.now() - 500, max_exec: 1,
    })

    const executor = vi.fn()
    const result = await crankTick(executor)

    expect(executor).not.toHaveBeenCalled()
    expect(result.expired).toBe(1)
    expect(getScheduledOp(op.id)!.status).toBe('expired')
  })

  it('completes ops that hit max_exec', async () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id, action: 'send', params: {},
      wallet_signature: 'sig', next_exec: Date.now() - 1000,
      expires_at: Date.now() + 3600_000, max_exec: 3,
    })
    const db = getDb()
    db.prepare('UPDATE scheduled_ops SET exec_count = 2 WHERE id = ?').run(op.id)

    const executor = vi.fn().mockResolvedValue({ status: 'success' })
    await crankTick(executor)

    const updated = getScheduledOp(op.id)!
    expect(updated.status).toBe('completed')
    expect(updated.exec_count).toBe(3)
  })

  it('re-schedules recurring ops with intervalMs in params', async () => {
    const session = getOrCreateSession(WALLET)
    createScheduledOp({
      session_id: session.id, action: 'send',
      params: { amount: 50, intervalMs: 120_000 },
      wallet_signature: 'sig', next_exec: Date.now() - 1000,
      expires_at: Date.now() + 3600_000, max_exec: 5,
    })

    const executor = vi.fn().mockResolvedValue({ status: 'success' })
    await crankTick(executor)

    const session2 = getOrCreateSession(WALLET)
    const ops = (await import('../src/db.js')).getScheduledOpsBySession(session2.id)
    const updated = ops[0]
    expect(updated.status).toBe('pending')
    expect(updated.exec_count).toBe(1)
    expect(updated.next_exec).toBeGreaterThan(Date.now() + 100_000)
    expect(updated.next_exec).toBeLessThan(Date.now() + 150_000)
  })

  it('skips future ops', async () => {
    const session = getOrCreateSession(WALLET)
    createScheduledOp({
      session_id: session.id, action: 'send', params: {},
      wallet_signature: 'sig', next_exec: Date.now() + 60_000,
      expires_at: Date.now() + 3600_000, max_exec: 1,
    })

    const executor = vi.fn()
    const result = await crankTick(executor)

    expect(executor).not.toHaveBeenCalled()
    expect(result.executed).toBe(0)
  })

  it('continues executing remaining ops if one fails', async () => {
    const session = getOrCreateSession(WALLET)
    createScheduledOp({
      id: 'op-fail', session_id: session.id, action: 'send', params: { fail: true },
      wallet_signature: 'sig', next_exec: Date.now() - 2000,
      expires_at: Date.now() + 3600_000, max_exec: 1,
    })
    createScheduledOp({
      id: 'op-ok', session_id: session.id, action: 'send', params: { fail: false },
      wallet_signature: 'sig', next_exec: Date.now() - 1000,
      expires_at: Date.now() + 3600_000, max_exec: 1,
    })

    const executor = vi.fn().mockImplementation(async (_action: string, params: Record<string, unknown>) => {
      if (params.fail) throw new Error('Test error')
      return { status: 'success' }
    })

    const result = await crankTick(executor)

    expect(result.executed).toBe(1)
    expect(result.failed).toBe(1)
    expect(getScheduledOp('op-fail')!.status).toBe('pending')
    expect(getScheduledOp('op-ok')!.status).toBe('completed')
  })

  it('marks missed ops (due > 5 min ago)', async () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id, action: 'send', params: {},
      wallet_signature: 'sig', next_exec: Date.now() - 6 * 60_000,
      expires_at: Date.now() + 3600_000, max_exec: 1,
    })

    const executor = vi.fn()
    const result = await crankTick(executor)

    expect(result.missed).toBe(1)
    expect(getScheduledOp(op.id)!.status).toBe('missed')
    expect(executor).not.toHaveBeenCalled()
  })

  it('returns zero counts when no ops pending', async () => {
    const executor = vi.fn()
    const result = await crankTick(executor)
    expect(result).toEqual({ executed: 0, expired: 0, missed: 0, failed: 0 })
  })
})
