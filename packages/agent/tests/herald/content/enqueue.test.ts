import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { closeDb, getDb } from '../../../src/db.js'
import { guardianBus } from '../../../src/coordination/event-bus.js'
import { enqueueContentPost, hasGeneratedToday } from '../../../src/herald/content/enqueue.js'

beforeEach(() => {
  closeDb()
  process.env.NODE_ENV = 'test'
  delete process.env.DB_PATH
  getDb()
})

afterEach(() => {
  closeDb()
  vi.restoreAllMocks()
})

describe('enqueueContentPost', () => {
  it('inserts a pending content row and emits approval-needed', () => {
    const spy = vi.spyOn(guardianBus, 'emit')
    const { id } = enqueueContentPost('GM, privacy fam')

    const row = getDb().prepare('SELECT * FROM herald_queue WHERE id = ?').get(id) as Record<string, unknown>
    expect(row.type).toBe('content')
    expect(row.status).toBe('pending')
    expect(row.content).toBe('GM, privacy fam')
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'herald:approval-needed', data: { id, text: 'GM, privacy fam' } }))
  })

  it('rejects empty and over-length text', () => {
    expect(() => enqueueContentPost('')).toThrow('text is required')
    expect(() => enqueueContentPost('x'.repeat(281))).toThrow('280')
  })
})

describe('hasGeneratedToday', () => {
  it('is false on a fresh DB and true after a content insert', () => {
    expect(hasGeneratedToday()).toBe(false)
    enqueueContentPost('today post')
    expect(hasGeneratedToday()).toBe(true)
  })

  it('ignores non-content rows', () => {
    const now = new Date().toISOString()
    getDb().prepare(`INSERT INTO herald_queue (id, type, content, status, created_at) VALUES (?, 'post', ?, 'pending', ?)`)
      .run('p1', 'a reply', now)
    expect(hasGeneratedToday()).toBe(false)
  })
})
