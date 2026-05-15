import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import express from 'express'
import supertest from 'supertest'
import jwt from 'jsonwebtoken'

const TEST_JWT_SECRET = 'test-secret-for-tool-signing-tests'
const WALLET = 'WalletABC'
const OTHER_WALLET = 'WalletDEF'

// Verifier is mocked across the file so route tests stay deterministic without
// hitting Solana RPC. Each `describe` block configures the mock per its needs.
const verifySignatureMock = vi.fn()
vi.mock('../../src/sentinel/verify-signature.js', () => ({
  verifySignature: (...args: unknown[]) => verifySignatureMock(...args),
}))
vi.mock('@sipher/sdk', async () => {
  const actual = await vi.importActual<typeof import('@sipher/sdk')>('@sipher/sdk')
  return {
    ...actual,
    createConnection: () => ({}) as unknown,
  }
})

function signJwt(wallet: string): string {
  return jwt.sign({ wallet }, TEST_JWT_SECRET, { expiresIn: '1h', algorithm: 'HS256' })
}

const { toolSigningRouter } = await import('../../src/routes/tool-signing.js')
const { verifyJwt } = await import('../../src/routes/auth.js')
const {
  createPendingSigning,
  getPendingSigning,
  clearAllSigning,
  _setTimeoutMsForTests,
} = await import('../../src/sentinel/pending-signing.js')

beforeEach(() => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = TEST_JWT_SECRET
  process.env.SIPHER_NETWORK = 'devnet'
  process.env.SIPHER_HELIUS_API_KEY = 'test-helius-key'
  // Default: verifier off — keeps the original base-behavior tests focused on
  // the auth/validation surface. Per-describe blocks below override to test
  // strict/advisory behavior with the verifier mock.
  process.env.SIPHER_SIG_VERIFY = 'off'
  _setTimeoutMsForTests(60_000)
  for (const s of ['test-session', 's1']) clearAllSigning(s)
  verifySignatureMock.mockReset()
})

afterEach(() => {
  delete process.env.JWT_SECRET
  delete process.env.SIPHER_NETWORK
  delete process.env.SIPHER_HELIUS_API_KEY
  delete process.env.SIPHER_SIG_VERIFY
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
  it('resolves the pending promise with the signature on valid request (200, verify=off)', async () => {
    const { flagId, promise } = makePending()
    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/confirm`)
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({ signature: 'SIG_VALID_BASE58_SIGNATURE_VALUE' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'accepted', verified: false })
    await expect(promise).resolves.toBe('SIG_VALID_BASE58_SIGNATURE_VALUE')
    expect(verifySignatureMock).not.toHaveBeenCalled()
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

describe('POST /api/tool-signing/:flagId/confirm — SIPHER_SIG_VERIFY=strict', () => {
  beforeEach(() => {
    process.env.SIPHER_SIG_VERIFY = 'strict'
  })

  it('returns 200 verified=true and resolves pending on verifier ok', async () => {
    verifySignatureMock.mockResolvedValue({ ok: true, slot: 42 })
    const { flagId, promise } = makePending()

    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/confirm`)
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({ signature: 'SIG_OK' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'accepted', verified: true })
    await expect(promise).resolves.toBe('SIG_OK')
    expect(getPendingSigning(flagId)).toBeUndefined()
    expect(verifySignatureMock).toHaveBeenCalledOnce()
  })

  it('rejects pending and returns 400 VALIDATION_FAILED on wallet_mismatch', async () => {
    verifySignatureMock.mockResolvedValue({ ok: false, reason: 'wallet_mismatch' })
    const { flagId, promise } = makePending()
    promise.catch(() => {})

    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/confirm`)
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({ signature: 'SIG' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(res.body.error.message).toMatch(/wallet_mismatch/)
    await expect(promise).rejects.toThrow(/verification_failed: wallet_mismatch/)
    expect(getPendingSigning(flagId)).toBeUndefined()
  })

  it('rejects pending and returns 400 on not_confirmed', async () => {
    verifySignatureMock.mockResolvedValue({
      ok: false,
      reason: 'not_confirmed',
      detail: 'tx not found',
    })
    const { flagId, promise } = makePending()
    promise.catch(() => {})

    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/confirm`)
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({ signature: 'SIG' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
    expect(res.body.error.message).toMatch(/not_confirmed/)
  })

  it('returns 503 UNAVAILABLE + Retry-After on rpc_error and keeps pending alive', async () => {
    verifySignatureMock.mockResolvedValue({ ok: false, reason: 'rpc_error', detail: 'ETIMEDOUT' })
    const { flagId, promise } = makePending()
    promise.catch(() => {})

    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/confirm`)
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({ signature: 'SIG' })

    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('UNAVAILABLE')
    expect(res.headers['retry-after']).toBe('2')
    expect(getPendingSigning(flagId)).toBeDefined()
  })

  it('returns 503 UNAVAILABLE + Retry-After on verifier timeout and keeps pending alive', async () => {
    verifySignatureMock.mockResolvedValue({ ok: false, reason: 'timeout' })
    const { flagId, promise } = makePending()
    promise.catch(() => {})

    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/confirm`)
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({ signature: 'SIG' })

    expect(res.status).toBe(503)
    expect(res.headers['retry-after']).toBe('2')
    expect(getPendingSigning(flagId)).toBeDefined()
  })

  it('returns 503 when verifier itself throws (config or createConnection failure)', async () => {
    verifySignatureMock.mockRejectedValue(new Error('config blew up'))
    const { flagId, promise } = makePending()
    promise.catch(() => {})

    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/confirm`)
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({ signature: 'SIG' })

    expect(res.status).toBe(503)
    expect(res.headers['retry-after']).toBe('2')
    expect(getPendingSigning(flagId)).toBeDefined()
  })
})

describe('POST /api/tool-signing/:flagId/confirm — SIPHER_SIG_VERIFY=advisory', () => {
  beforeEach(() => {
    process.env.SIPHER_SIG_VERIFY = 'advisory'
  })

  it('resolves pending and returns 200 verified=false even when verifier fails', async () => {
    verifySignatureMock.mockResolvedValue({ ok: false, reason: 'wallet_mismatch' })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { flagId, promise } = makePending()

    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/confirm`)
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({ signature: 'SIG' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'accepted', verified: false })
    await expect(promise).resolves.toBe('SIG')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/advisory mode.*wallet_mismatch/))
    warnSpy.mockRestore()
  })

  it('resolves and returns verified=false even on rpc_error (does NOT 503)', async () => {
    verifySignatureMock.mockResolvedValue({ ok: false, reason: 'rpc_error' })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { flagId, promise } = makePending()

    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/confirm`)
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({ signature: 'SIG' })

    expect(res.status).toBe(200)
    expect(res.body.verified).toBe(false)
    await expect(promise).resolves.toBe('SIG')
    warnSpy.mockRestore()
  })

  it('reports verified=false even when verifier returns ok (advisory never marks verified=true)', async () => {
    verifySignatureMock.mockResolvedValue({ ok: true, slot: 1 })
    const { flagId, promise } = makePending()

    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/confirm`)
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({ signature: 'SIG' })

    expect(res.status).toBe(200)
    expect(res.body.verified).toBe(false)
    await expect(promise).resolves.toBe('SIG')
  })
})

describe('POST /api/tool-signing/:flagId/confirm — pre-verifier guards skip verifier', () => {
  it('returns 404 NOT_FOUND without calling verifier when flagId is missing (strict mode)', async () => {
    process.env.SIPHER_SIG_VERIFY = 'strict'

    const res = await supertest(createApp())
      .post('/api/tool-signing/unknown-id/confirm')
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({ signature: 'SIG' })

    expect(res.status).toBe(404)
    expect(verifySignatureMock).not.toHaveBeenCalled()
  })

  it('returns 403 FORBIDDEN without calling verifier on JWT mismatch (strict mode)', async () => {
    process.env.SIPHER_SIG_VERIFY = 'strict'
    const { flagId, promise } = makePending()
    promise.catch(() => {})

    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/confirm`)
      .set('Authorization', `Bearer ${signJwt(OTHER_WALLET)}`)
      .send({ signature: 'SIG' })

    expect(res.status).toBe(403)
    expect(verifySignatureMock).not.toHaveBeenCalled()
  })

  it('returns 400 VALIDATION_FAILED without calling verifier on empty signature (strict mode)', async () => {
    process.env.SIPHER_SIG_VERIFY = 'strict'
    const { flagId, promise } = makePending()
    promise.catch(() => {})

    const res = await supertest(createApp())
      .post(`/api/tool-signing/${flagId}/confirm`)
      .set('Authorization', `Bearer ${signJwt(WALLET)}`)
      .send({ signature: '' })

    expect(res.status).toBe(400)
    expect(verifySignatureMock).not.toHaveBeenCalled()
  })
})
