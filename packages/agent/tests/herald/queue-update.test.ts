import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, closeDb } from '../../src/db.js'
import {
  getQueueItem,
  updateContent,
  NotFoundError,
} from '../../src/herald/approval.js'

describe('herald-queue updateContent', () => {
  beforeEach(() => {
    closeDb()
    process.env.NODE_ENV = 'test'
  })

  it('updates content and returns the updated item', () => {
    const db = getDb()
    db.prepare(`
      INSERT INTO herald_queue (id, type, content, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('q1', 'tweet', 'original', 'pending', new Date().toISOString())

    const updated = updateContent('q1', 'edited tweet')
    expect(updated.content).toBe('edited tweet')
    expect(updated.id).toBe('q1')
    expect(updated.status).toBe('pending')
  })

  it('throws NotFoundError for unknown id', () => {
    expect(() => updateContent('does-not-exist', 'x')).toThrow(NotFoundError)
    expect(() => updateContent('does-not-exist', 'x')).toThrow(/not.found/i)
  })

  it('persists the change so subsequent reads see new content', () => {
    const db = getDb()
    db.prepare(`
      INSERT INTO herald_queue (id, type, content, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('q2', 'tweet', 'original', 'pending', new Date().toISOString())

    updateContent('q2', 'fresh')
    const fetched = getQueueItem('q2')
    expect(fetched?.content).toBe('fresh')
  })
})
