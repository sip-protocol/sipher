import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import supertest from 'supertest'
import jwt from 'jsonwebtoken'
import { closeDb, getDb } from '../../src/db.js'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_WALLET = 'admin-wallet-test'
const NON_ADMIN_WALLET = 'random-wallet-test'
const TEST_JWT_SECRET = 'test-secret-for-queue-patch-tests'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function signJwt(wallet: string): string {
  return jwt.sign({ wallet }, TEST_JWT_SECRET, { expiresIn: '1h', algorithm: 'HS256' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Module imports (top-level await — Vitest ESM)
// ─────────────────────────────────────────────────────────────────────────────

const { heraldRouter } = await import('../../src/routes/herald-api.js')
const { verifyJwt, requireOwner } = await import('../../src/routes/auth.js')

// ─────────────────────────────────────────────────────────────────────────────
// Test setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  closeDb()
  process.env.DB_PATH = ':memory:'
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = TEST_JWT_SECRET
  process.env.AUTHORIZED_WALLETS = ADMIN_WALLET

  // Seed a known queue item
  const db = getDb()
  db.prepare(
    'INSERT INTO herald_queue (id, type, content, status, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run('q1', 'tweet', 'old content', 'pending', new Date().toISOString())
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
  delete process.env.JWT_SECRET
  delete process.env.AUTHORIZED_WALLETS
})

// ─────────────────────────────────────────────────────────────────────────────
// App factory — includes full auth chain to exercise 403 path
// ─────────────────────────────────────────────────────────────────────────────

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/herald', verifyJwt, requireOwner, heraldRouter)
  return app
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/herald/queue/:id', () => {
  it('updates content and returns 200 with the updated item', async () => {
    const res = await supertest(createApp())
      .patch('/api/herald/queue/q1')
      .set('Authorization', `Bearer ${signJwt(ADMIN_WALLET)}`)
      .send({ content: 'new content' })

    expect(res.status).toBe(200)
    expect(res.body.id).toBe('q1')
    expect(res.body.content).toBe('new content')
    expect(res.body.status).toBe('pending')
  })

  it('returns 400 for empty content', async () => {
    const res = await supertest(createApp())
      .patch('/api/herald/queue/q1')
      .set('Authorization', `Bearer ${signJwt(ADMIN_WALLET)}`)
      .send({ content: '' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_CONTENT')
  })

  it('returns 400 for content exceeding 280 characters', async () => {
    const res = await supertest(createApp())
      .patch('/api/herald/queue/q1')
      .set('Authorization', `Bearer ${signJwt(ADMIN_WALLET)}`)
      .send({ content: 'a'.repeat(281) })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_CONTENT')
  })

  it('returns 404 for an unknown queue item id', async () => {
    const res = await supertest(createApp())
      .patch('/api/herald/queue/does-not-exist')
      .set('Authorization', `Bearer ${signJwt(ADMIN_WALLET)}`)
      .send({ content: 'valid content' })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('returns 403 for a non-admin wallet', async () => {
    const res = await supertest(createApp())
      .patch('/api/herald/queue/q1')
      .set('Authorization', `Bearer ${signJwt(NON_ADMIN_WALLET)}`)
      .send({ content: 'new content' })

    expect(res.status).toBe(403)
  })
})
