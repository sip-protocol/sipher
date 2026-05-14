import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import supertest from 'supertest'
import jwt from 'jsonwebtoken'
import {
  createPendingSigning,
  getPendingSigning,
  clearAllSigning,
  _setTimeoutMsForTests,
} from '../../src/sentinel/pending-signing.js'

const TEST_JWT_SECRET = 'test-secret-for-tool-signing-tests'
const WALLET = 'WalletABC'
const OTHER_WALLET = 'WalletDEF'

function signJwt(wallet: string): string {
  return jwt.sign({ wallet }, TEST_JWT_SECRET, { expiresIn: '1h', algorithm: 'HS256' })
}

const { toolSigningRouter } = await import('../../src/routes/tool-signing.js')
const { verifyJwt } = await import('../../src/routes/auth.js')

beforeEach(() => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = TEST_JWT_SECRET
  _setTimeoutMsForTests(60_000)
  for (const s of ['test-session', 's1']) clearAllSigning(s)
})

afterEach(() => {
  delete process.env.JWT_SECRET
  for (const s of ['test-session', 's1']) clearAllSigning(s)
})

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/tool-signing', verifyJwt, toolSigningRouter)
  return app
}

function makePending(overrides: Partial<{ wallet: string; sessionId: string }> = {}): {
  flagId: string
  promise: Promise<string>
} {
  return createPendingSigning({
    sessionId: overrides.sessionId ?? 'test-session',
    toolName: 'send',
    wallet: overrides.wallet ?? WALLET,
    serializedTx: 'base64-tx',
    network: 'devnet',
    toolInput: {},
  })
}

describe('POST /api/tool-signing/:flagId/confirm', () => {
  it('resolves the pending promise with the signature on valid request (200)', async () => {
    const { flagId, promise } = makePending()
    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/confirm`)
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({ signature: 'SIG_VALID_BASE58_SIGNATURE_VALUE' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'accepted' })
    await expect(promise).resolves.toBe('SIG_VALID_BASE58_SIGNATURE_VALUE')
  })

  it('returns 404 NOT_FOUND when flagId does not exist', async () => {
    const res = await supertest(createApp())
      .post('/api/tool-signing/missing-id/confirm')
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({ signature: 'SIG' })
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('returns 403 FORBIDDEN when JWT wallet does not match pending wallet', async () => {
    const { flagId, promise } = makePending({ wallet: WALLET })
    promise.catch(() => {})
    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/confirm`)
      .set('Authorization', `Bearer ${signJwt(OTHER_WALLET)}`)
      .send({ signature: 'SIG' })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
    expect(getPendingSigning(flagId)).toBeDefined()
  })

  it('returns 400 VALIDATION_FAILED when signature is missing', async () => {
    const { flagId, promise } = makePending()
    promise.catch(() => {})
    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/confirm`)
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('returns 400 VALIDATION_FAILED when signature is empty string', async () => {
    const { flagId, promise } = makePending()
    promise.catch(() => {})
    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/confirm`)
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({ signature: '' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('returns 400 VALIDATION_FAILED when signature is not a string', async () => {
    const { flagId, promise } = makePending()
    promise.catch(() => {})
    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/confirm`)
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({ signature: 12345 })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })
})

describe('POST /api/tool-signing/:flagId/reject', () => {
  it('rejects the pending promise on valid request (200)', async () => {
    const { flagId, promise } = makePending()
    promise.catch(() => {})
    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/reject`)
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({})
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'rejected' })
    await expect(promise).rejects.toThrow('cancelled_by_user')
  })

  it('returns 404 NOT_FOUND when flagId does not exist', async () => {
    const res = await supertest(createApp())
      .post('/api/tool-signing/missing-id/reject')
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({})
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('returns 403 FORBIDDEN when JWT wallet does not match pending wallet', async () => {
    const { flagId, promise } = makePending({ wallet: WALLET })
    promise.catch(() => {})
    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/reject`)
      .set('Authorization', `Bearer ${signJwt(OTHER_WALLET)}`)
      .send({})
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
    expect(getPendingSigning(flagId)).toBeDefined()
  })

  it('accepts optional reason in body', async () => {
    const { flagId, promise } = makePending()
    promise.catch(() => {})
    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/reject`)
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({ reason: 'user_closed_tab' })
    expect(res.status).toBe(200)
    await expect(promise).rejects.toThrow('user_closed_tab')
  })
})
