import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, closeDb } from '../../packages/agent/src/db.js'
import {
  getPendingPosts,
  getReadyToPublish,
  approvePost,
  rejectPost,
  markPublished,
  editQueuedPost,
} from '../../packages/agent/src/herald/approval.js'

describe('Herald Post Approval Queue', () => {
  beforeEach(() => {
    closeDb()
    // Force :memory: DB for tests
    process.env.NODE_ENV = 'test'
  })

  it('returns pending posts from herald_queue', () => {
    const db = getDb()
    const now = new Date().toISOString()

    // Insert test posts
    db.prepare(`
      INSERT INTO herald_queue (id, type, content, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('post-1', 'tweet', 'Hello world', 'pending', now)

    db.prepare(`
      INSERT INTO herald_queue (id, type, content, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('post-2', 'tweet', 'Another post', 'approved', now)

    db.prepare(`
      INSERT INTO herald_queue (id, type, content, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('post-3', 'tweet', 'Third post', 'pending', now)

    const pending = getPendingPosts()
    expect(pending).toHaveLength(2)
    expect(pending.map((p) => p.id).sort()).toEqual(['post-1', 'post-3'])
  })

  it('approves a post (status → approved, approved_by set)', () => {
    const db = getDb()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO herald_queue (id, type, content, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('post-1', 'tweet', 'Test post', 'pending', now)

    approvePost('post-1', 'rector')

    const row = db.prepare('SELECT * FROM herald_queue WHERE id = ?').get('post-1') as Record<string, unknown>
    expect(row.status).toBe('approved')
    expect(row.approved_by).toBe('rector')
    expect(row.approved_at).toBeTruthy()
  })

  it('rejects a post (status → rejected)', () => {
    const db = getDb()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO herald_queue (id, type, content, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('post-1', 'tweet', 'Test post', 'pending', now)

    rejectPost('post-1')

    const row = db.prepare('SELECT * FROM herald_queue WHERE id = ?').get('post-1') as Record<string, unknown>
    expect(row.status).toBe('rejected')
  })

  it('getReadyToPublish returns approved posts', () => {
    const db = getDb()
    const now = new Date()
    const nowIso = now.toISOString()
    const pastIso = new Date(now.getTime() - 60000).toISOString()
    const futureIso = new Date(now.getTime() + 60000).toISOString()

    // Approved post without scheduled_at
    db.prepare(`
      INSERT INTO herald_queue (id, type, content, status, approved_at, approved_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('post-1', 'tweet', 'Ready now', 'approved', nowIso, 'rector', nowIso)

    // Approved post with past scheduled_at
    db.prepare(`
      INSERT INTO herald_queue (id, type, content, status, scheduled_at, approved_at, approved_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('post-2', 'tweet', 'Scheduled past', 'approved', pastIso, nowIso, 'rector', nowIso)

    // Approved post with future scheduled_at
    db.prepare(`
      INSERT INTO herald_queue (id, type, content, status, scheduled_at, approved_at, approved_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('post-3', 'tweet', 'Scheduled future', 'approved', futureIso, nowIso, 'rector', nowIso)

    // Pending post
    db.prepare(`
      INSERT INTO herald_queue (id, type, content, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('post-4', 'tweet', 'Still pending', 'pending', nowIso)

    const ready = getReadyToPublish()
    expect(ready.map((p) => p.id).sort()).toEqual(['post-1', 'post-2'])
  })

  it('markPublished updates status + tweet_id', () => {
    const db = getDb()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO herald_queue (id, type, content, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('post-1', 'tweet', 'Test post', 'approved', now)

    markPublished('post-1', 'tw-123456')

    const row = db.prepare('SELECT * FROM herald_queue WHERE id = ?').get('post-1') as Record<string, unknown>
    expect(row.status).toBe('posted')
    expect(row.tweet_id).toBe('tw-123456')
    expect(row.posted_at).toBeTruthy()
  })

  it('editQueuedPost updates content for pending/approved posts', () => {
    const db = getDb()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO herald_queue (id, type, content, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('post-1', 'tweet', 'Old content', 'pending', now)

    db.prepare(`
      INSERT INTO herald_queue (id, type, content, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('post-2', 'tweet', 'Old approved', 'approved', now)

    db.prepare(`
      INSERT INTO herald_queue (id, type, content, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('post-3', 'tweet', 'Already posted', 'posted', now)

    editQueuedPost('post-1', 'New content')
    editQueuedPost('post-2', 'New approved content')
    editQueuedPost('post-3', 'Should not change')

    const row1 = db.prepare('SELECT * FROM herald_queue WHERE id = ?').get('post-1') as Record<string, unknown>
    const row2 = db.prepare('SELECT * FROM herald_queue WHERE id = ?').get('post-2') as Record<string, unknown>
    const row3 = db.prepare('SELECT * FROM herald_queue WHERE id = ?').get('post-3') as Record<string, unknown>

    expect(row1.content).toBe('New content')
    expect(row2.content).toBe('New approved content')
    expect(row3.content).toBe('Already posted') // unchanged
  })

  it('auto-approves pending posts when HERALD_AUTO_APPROVE_POSTS enabled', () => {
    const db = getDb()
    const now = new Date()
    const nowIso = now.toISOString()
    const oldIso = new Date(now.getTime() - 3600000).toISOString() // 1 hour ago

    // Old pending post (should auto-approve)
    db.prepare(`
      INSERT INTO herald_queue (id, type, content, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('post-1', 'tweet', 'Old pending', 'pending', oldIso)

    // Recent pending post (should not auto-approve)
    db.prepare(`
      INSERT INTO herald_queue (id, type, content, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('post-2', 'tweet', 'New pending', 'pending', nowIso)

    // Already approved
    db.prepare(`
      INSERT INTO herald_queue (id, type, content, status, approved_at, approved_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('post-3', 'tweet', 'Approved', 'approved', nowIso, 'rector', nowIso)

    process.env.HERALD_AUTO_APPROVE_POSTS = 'true'
    process.env.HERALD_AUTO_APPROVE_TIMEOUT = '3600' // 1 hour

    const ready = getReadyToPublish()

    // Should have post-1 (auto-approved) and post-3 (already approved)
    expect(ready.map((p) => p.id).sort()).toEqual(['post-1', 'post-3'])

    // Verify post-1 was actually approved
    const row1 = db.prepare('SELECT * FROM herald_queue WHERE id = ?').get('post-1') as Record<string, unknown>
    expect(row1.status).toBe('approved')
    expect(row1.approved_by).toBe('auto')

    // Verify post-2 is still pending
    const row2 = db.prepare('SELECT * FROM herald_queue WHERE id = ?').get('post-2') as Record<string, unknown>
    expect(row2.status).toBe('pending')

    delete process.env.HERALD_AUTO_APPROVE_POSTS
    delete process.env.HERALD_AUTO_APPROVE_TIMEOUT
  })
})
