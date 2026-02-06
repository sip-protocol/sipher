import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { ErrorCode, ERROR_CATALOG, getErrorEntry } from '../src/errors/codes.js'

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation(() => ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    })),
  }
})

const { default: app } = await import('../src/server.js')

describe('Error codes catalog', () => {
  describe('GET /v1/errors', () => {
    it('returns the full error catalog', async () => {
      const res = await request(app).get('/v1/errors')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.totalCodes).toBe(ERROR_CATALOG.length)
      expect(res.body.data.errors).toHaveLength(ERROR_CATALOG.length)
    })

    it('each error entry has required fields', async () => {
      const res = await request(app).get('/v1/errors')
      for (const error of res.body.data.errors) {
        expect(error).toHaveProperty('code')
        expect(error).toHaveProperty('httpStatus')
        expect(error).toHaveProperty('description')
        expect(error).toHaveProperty('retryable')
        expect(typeof error.code).toBe('string')
        expect(typeof error.httpStatus).toBe('number')
        expect(typeof error.description).toBe('string')
        expect(typeof error.retryable).toBe('boolean')
      }
    })

    it('includes all ErrorCode enum values', async () => {
      const res = await request(app).get('/v1/errors')
      const returnedCodes = res.body.data.errors.map((e: any) => e.code)
      const enumValues = Object.values(ErrorCode)
      for (const code of enumValues) {
        expect(returnedCodes).toContain(code)
      }
    })

    it('HTTP statuses are valid', async () => {
      const validStatuses = [400, 401, 403, 404, 409, 410, 422, 429, 500, 503]
      const res = await request(app).get('/v1/errors')
      for (const error of res.body.data.errors) {
        expect(validStatuses).toContain(error.httpStatus)
      }
    })
  })

  describe('ErrorCode enum', () => {
    it('has no duplicate values', () => {
      const values = Object.values(ErrorCode)
      const unique = new Set(values)
      expect(unique.size).toBe(values.length)
    })
  })

  describe('getErrorEntry', () => {
    it('returns entry for valid code', () => {
      const entry = getErrorEntry(ErrorCode.VALIDATION_ERROR)
      expect(entry).toBeDefined()
      expect(entry!.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(entry!.httpStatus).toBe(400)
    })

    it('returns undefined for unknown code', () => {
      const entry = getErrorEntry('NONEXISTENT' as ErrorCode)
      expect(entry).toBeUndefined()
    })
  })

  describe('error-handler uses ErrorCode enum', () => {
    it('404 response uses NOT_FOUND code', async () => {
      const res = await request(app).get('/v1/nonexistent')
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe(ErrorCode.NOT_FOUND)
    })

    it('invalid JSON returns INVALID_JSON code', async () => {
      const res = await request(app)
        .post('/v1/stealth/generate')
        .set('Content-Type', 'application/json')
        .send('not json{{{')
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe(ErrorCode.INVALID_JSON)
    })

    it('validation error returns VALIDATION_ERROR code', async () => {
      const res = await request(app)
        .post('/v1/commitment/create')
        .send({})
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe(ErrorCode.VALIDATION_ERROR)
    })
  })
})
