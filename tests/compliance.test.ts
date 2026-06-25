import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express, { Router, Request, Response, NextFunction } from 'express'
import { resetComplianceProvider, verifyAuditor } from '../src/services/compliance-provider.js'
import type { AuditorVerification } from '../src/services/compliance-provider.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import { bytesToHex } from '@noble/hashes/utils.js'

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation(function () { return ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    }) }),
  }
})

const { default: app } = await import('../src/server.js')

// ─── Helpers ────────────────────────────────────────────────────────────────

const DOMAIN_TAG = new TextEncoder().encode('SIPHER-COMPLIANCE')

function makeAuditorVerification(viewingKeyHash: string, nonce: string): AuditorVerification {
  const input = new Uint8Array(
    DOMAIN_TAG.length + new TextEncoder().encode('AUDITOR' + nonce + viewingKeyHash).length
  )
  input.set(DOMAIN_TAG)
  input.set(new TextEncoder().encode('AUDITOR' + nonce + viewingKeyHash), DOMAIN_TAG.length)
  const auditorKeyHash = '0x' + bytesToHex(keccak_256(input))
  return { auditorKeyHash, nonce }
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const hex32 = '0x' + 'ab'.repeat(32)
const nonce = '0x' + 'cd'.repeat(16)

const validViewingKey = {
  key: hex32,
  path: 'm/44/501/0',
  hash: hex32,
}

const validVerification = makeAuditorVerification(hex32, nonce)

const validDisclose = {
  viewingKey: validViewingKey,
  transactionData: {
    txHash: '0x' + 'ff'.repeat(32),
    amount: '1000000000',
    sender: 'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at',
    receiver: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
  },
  scope: { type: 'full' as const },
  auditorId: 'auditor-001',
  auditorVerification: validVerification,
}

const validReport = {
  viewingKey: validViewingKey,
  startTime: 1700000000000,
  endTime: 1700100000000,
  auditorId: 'auditor-001',
  auditorVerification: validVerification,
}

// ─── POST /v1/compliance/disclose ───────────────────────────────────────────

describe('POST /v1/compliance/disclose', () => {
  beforeEach(() => resetComplianceProvider())

  it('creates disclosure with valid auditor → 200', async () => {
    const res = await request(app)
      .post('/v1/compliance/disclose')
      .send(validDisclose)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.disclosureId).toMatch(/^cmp_[0-9a-f]{64}$/)
    expect(res.body.data.scopedViewingKeyHash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.body.data.ciphertext).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.body.data.auditorVerified).toBe(true)
    expect(res.body.data.scope.type).toBe('full')
  })

  it('rejects invalid auditor verification → 500', async () => {
    const badVerification = { auditorKeyHash: '0x' + 'ff'.repeat(32), nonce }
    const res = await request(app)
      .post('/v1/compliance/disclose')
      .send({ ...validDisclose, auditorVerification: badVerification })
    expect(res.status).toBe(500)
    expect(res.body.success).toBe(false)
  })

  it('supports full scope type', async () => {
    const res = await request(app)
      .post('/v1/compliance/disclose')
      .send({ ...validDisclose, scope: { type: 'full' } })
    expect(res.status).toBe(200)
    expect(res.body.data.scope.type).toBe('full')
  })

  it('supports time_range scope with start/end', async () => {
    const res = await request(app)
      .post('/v1/compliance/disclose')
      .send({
        ...validDisclose,
        scope: { type: 'time_range', startTime: 1700000000000, endTime: 1700100000000 },
      })
    expect(res.status).toBe(200)
    expect(res.body.data.scope.type).toBe('time_range')
    expect(res.body.data.scope.startTime).toBe(1700000000000)
  })

  it('rejects missing viewingKey → 400', async () => {
    const { viewingKey: _vk, ...rest } = validDisclose
    const res = await request(app)
      .post('/v1/compliance/disclose')
      .send(rest)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects invalid scope type → 400', async () => {
    const res = await request(app)
      .post('/v1/compliance/disclose')
      .send({ ...validDisclose, scope: { type: 'invalid_scope' } })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('supports idempotency', async () => {
    const key = '550e8400-e29b-41d4-a716-446655440070'
    const first = await request(app)
      .post('/v1/compliance/disclose')
      .set('Idempotency-Key', key)
      .send(validDisclose)
    expect(first.status).toBe(200)

    const second = await request(app)
      .post('/v1/compliance/disclose')
      .set('Idempotency-Key', key)
      .send(validDisclose)
    expect(second.status).toBe(200)
    expect(second.headers['idempotency-replayed']).toBe('true')
    expect(second.body.data.disclosureId).toBe(first.body.data.disclosureId)
  })
})

// ─── POST /v1/compliance/report ─────────────────────────────────────────────

describe('POST /v1/compliance/report', () => {
  beforeEach(() => resetComplianceProvider())

  it('generates report with valid auditor → 200', async () => {
    const res = await request(app)
      .post('/v1/compliance/report')
      .send(validReport)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.reportId).toMatch(/^rpt_[0-9a-f]{64}$/)
    expect(res.body.data.status).toBe('encrypted')
    expect(res.body.data.generatedAt).toBeGreaterThan(0)
    expect(res.body.data.expiresAt).toBeGreaterThan(res.body.data.generatedAt)
    expect(res.body.data.encryptedReport).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.body.data.reportHash).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('includes encrypted transaction entries in summary', async () => {
    const res = await request(app)
      .post('/v1/compliance/report')
      .send(validReport)
    expect(res.status).toBe(200)
    const { summary } = res.body.data
    expect(summary.totalTransactions).toBeGreaterThanOrEqual(5)
    expect(summary.encryptedTransactions.length).toBeGreaterThan(0)
    expect(summary.encryptedTransactions[0]).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('includes volume summary', async () => {
    const res = await request(app)
      .post('/v1/compliance/report')
      .send(validReport)
    expect(res.status).toBe(200)
    expect(typeof res.body.data.summary.totalVolume).toBe('string')
    expect(Number(res.body.data.summary.totalVolume)).toBeGreaterThanOrEqual(0)
  })

  it('includes counterparties when requested', async () => {
    const res = await request(app)
      .post('/v1/compliance/report')
      .send({ ...validReport, includeCounterparties: true })
    expect(res.status).toBe(200)
    expect(res.body.data.summary.uniqueCounterparties).toBeGreaterThan(0)
  })

  it('rejects endTime <= startTime → 400', async () => {
    const res = await request(app)
      .post('/v1/compliance/report')
      .send({ ...validReport, endTime: validReport.startTime - 1 })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects missing auditor verification → 400', async () => {
    const { auditorVerification: _av, ...rest } = validReport
    const res = await request(app)
      .post('/v1/compliance/report')
      .send(rest)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects invalid auditor → 500', async () => {
    const badVerification = { auditorKeyHash: '0x' + 'ff'.repeat(32), nonce }
    const res = await request(app)
      .post('/v1/compliance/report')
      .send({ ...validReport, auditorVerification: badVerification })
    expect(res.status).toBe(500)
    expect(res.body.success).toBe(false)
  })

  it('supports idempotency', async () => {
    const key = '550e8400-e29b-41d4-a716-446655440071'
    const first = await request(app)
      .post('/v1/compliance/report')
      .set('Idempotency-Key', key)
      .send(validReport)
    expect(first.status).toBe(200)

    const second = await request(app)
      .post('/v1/compliance/report')
      .set('Idempotency-Key', key)
      .send(validReport)
    expect(second.status).toBe(200)
    expect(second.headers['idempotency-replayed']).toBe('true')
    expect(second.body.data.reportId).toBe(first.body.data.reportId)
  })
})

// ─── GET /v1/compliance/report/:id ──────────────────────────────────────────

describe('GET /v1/compliance/report/:id', () => {
  beforeEach(() => resetComplianceProvider())

  it('retrieves generated report by ID → 200', async () => {
    const createRes = await request(app)
      .post('/v1/compliance/report')
      .send(validReport)
    const { reportId } = createRes.body.data

    const res = await request(app)
      .get(`/v1/compliance/report/${reportId}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.reportId).toBe(reportId)
    expect(res.body.data.status).toBe('encrypted')
  })

  it('returns 404 for unknown report ID', async () => {
    const fakeId = 'rpt_' + 'ff'.repeat(32)
    const res = await request(app)
      .get(`/v1/compliance/report/${fakeId}`)
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('COMPLIANCE_REPORT_NOT_FOUND')
  })

  it('returns 400 for invalid report ID format', async () => {
    const res = await request(app)
      .get('/v1/compliance/report/invalid-id')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── Enterprise Tier Gating ─────────────────────────────────────────────────

describe('Compliance enterprise tier gating', () => {
  let tierApp: express.Application

  beforeEach(async () => {
    resetComplianceProvider()

    const { requireTier } = await import('../src/middleware/require-tier.js')

    // Create a custom app with controlled tier assignment
    tierApp = express()
    tierApp.use(express.json())

    // Middleware to set tier from X-Test-Tier header
    tierApp.use((req: Request, _res: Response, next: NextFunction) => {
      req.apiKeyTier = (req.headers['x-test-tier'] as any) || 'enterprise'
      next()
    })

    const compRouter = Router()
    compRouter.post('/compliance/test', requireTier('enterprise'), (_req: Request, res: Response) => {
      res.json({ success: true, data: { message: 'ok' } })
    })
    tierApp.use('/v1', compRouter)
  })

  it('allows enterprise tier → 200', async () => {
    const res = await request(tierApp)
      .post('/v1/compliance/test')
      .set('X-Test-Tier', 'enterprise')
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('rejects pro tier → 403', async () => {
    const res = await request(tierApp)
      .post('/v1/compliance/test')
      .set('X-Test-Tier', 'pro')
      .send({})
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('TIER_ACCESS_DENIED')
  })

  it('rejects free tier → 403', async () => {
    const res = await request(tierApp)
      .post('/v1/compliance/test')
      .set('X-Test-Tier', 'free')
      .send({})
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('TIER_ACCESS_DENIED')
  })
})

// ─── Auditor Verification Unit Test ─────────────────────────────────────────

describe('verifyAuditor', () => {
  it('returns true for valid verification', () => {
    const vkHash = '0x' + 'ab'.repeat(32)
    const n = '0x' + 'cd'.repeat(16)
    const verification = makeAuditorVerification(vkHash, n)
    expect(verifyAuditor(verification, vkHash)).toBe(true)
  })

  it('returns false for tampered hash', () => {
    const vkHash = '0x' + 'ab'.repeat(32)
    const n = '0x' + 'cd'.repeat(16)
    const verification = { auditorKeyHash: '0x' + 'ff'.repeat(32), nonce: n }
    expect(verifyAuditor(verification, vkHash)).toBe(false)
  })
})
