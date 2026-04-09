import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import supertest from 'supertest'
import { closeDb, getDb } from '../../src/db.js'

// ─────────────────────────────────────────────────────────────────────────────
// Test setup — isolated in-memory DB per test
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

// ─────────────────────────────────────────────────────────────────────────────
// Module import (top-level await — Vitest ESM)
// ─────────────────────────────────────────────────────────────────────────────

const { heraldRouter } = await import('../../src/routes/herald-api.js')

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/herald', heraldRouter)
  return app
}

function insertQueuePost(id: string, status: string, content = 'test content') {
  getDb().prepare(
    `INSERT INTO herald_queue (id, type, content, status, created_at)
     VALUES (?, 'post', ?, ?, ?)`
  ).run(id, content, status, new Date().toISOString())
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/herald
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/herald', () => {
  it('returns queue, budget, dms, and recentPosts fields', async () => {
    insertQueuePost('q1', 'pending')
    insertQueuePost('q2', 'posted')

    const res = await supertest(createApp()).get('/api/herald')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('queue')
    expect(res.body).toHaveProperty('budget')
    expect(res.body).toHaveProperty('dms')
    expect(res.body).toHaveProperty('recentPosts')

    // queue contains only pending posts
    expect(Array.isArray(res.body.queue)).toBe(true)
    const queueIds = res.body.queue.map((p: { id: string }) => p.id)
    expect(queueIds).toContain('q1')
    expect(queueIds).not.toContain('q2')

    // recentPosts contains only posted posts
    expect(Array.isArray(res.body.recentPosts)).toBe(true)
    const postedIds = res.body.recentPosts.map((p: { id: string }) => p.id)
    expect(postedIds).toContain('q2')
    expect(postedIds).not.toContain('q1')

    // budget shape
    expect(res.body.budget).toHaveProperty('spent')
    expect(res.body.budget).toHaveProperty('limit')
    expect(res.body.budget).toHaveProperty('gate')
    expect(res.body.budget).toHaveProperty('percentage')

    // dms is array
    expect(Array.isArray(res.body.dms)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/herald/approve/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/herald/approve/:id', () => {
  it('approves a pending post and returns status approved', async () => {
    insertQueuePost('post-1', 'pending')

    const res = await supertest(createApp())
      .post('/api/herald/approve/post-1')
      .send({ action: 'approve' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'approved', id: 'post-1' })

    const row = getDb().prepare('SELECT status FROM herald_queue WHERE id = ?').get('post-1') as { status: string }
    expect(row.status).toBe('approved')
  })

  it('rejects a pending post and returns status rejected', async () => {
    insertQueuePost('post-2', 'pending')

    const res = await supertest(createApp())
      .post('/api/herald/approve/post-2')
      .send({ action: 'reject' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'rejected', id: 'post-2' })

    const row = getDb().prepare('SELECT status FROM herald_queue WHERE id = ?').get('post-2') as { status: string }
    expect(row.status).toBe('rejected')
  })

  it('returns 404 for unknown post id', async () => {
    const res = await supertest(createApp())
      .post('/api/herald/approve/does-not-exist')
      .send({ action: 'approve' })

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })

  it('returns 400 for edit action without content', async () => {
    insertQueuePost('post-3', 'pending')

    const res = await supertest(createApp())
      .post('/api/herald/approve/post-3')
      .send({ action: 'edit' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/content required/i)
  })

  it('edits a pending post content', async () => {
    insertQueuePost('post-4', 'pending', 'original content')

    const res = await supertest(createApp())
      .post('/api/herald/approve/post-4')
      .send({ action: 'edit', content: 'updated content' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'edited', id: 'post-4' })

    const row = getDb().prepare('SELECT content FROM herald_queue WHERE id = ?').get('post-4') as { content: string }
    expect(row.content).toBe('updated content')
  })

  it('returns 400 for unknown action', async () => {
    insertQueuePost('post-5', 'pending')

    const res = await supertest(createApp())
      .post('/api/herald/approve/post-5')
      .send({ action: 'invalidaction' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/action must be/i)
  })

  it('returns 404 for a posted (non-pending/approved) post', async () => {
    insertQueuePost('post-6', 'posted')

    const res = await supertest(createApp())
      .post('/api/herald/approve/post-6')
      .send({ action: 'approve' })

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })
})
