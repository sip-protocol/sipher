// packages/agent/tests/sentinel/sentinel-errors.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { Response } from 'express'
import { sendSentinelError } from '../../src/routes/sentinel-errors.js'

function mockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response
}

function jsonCall(res: Response): unknown {
  return (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0]
}

describe('sendSentinelError', () => {
  it('VALIDATION_FAILED maps to status 400', () => {
    const res = mockResponse()
    sendSentinelError(res, 'VALIDATION_FAILED', 'bad input')
    expect(res.status).toHaveBeenCalledWith(400)
    expect(jsonCall(res)).toStrictEqual({
      error: { code: 'VALIDATION_FAILED', message: 'bad input' },
    })
  })

  it('NOT_FOUND maps to status 404', () => {
    const res = mockResponse()
    sendSentinelError(res, 'NOT_FOUND', 'missing')
    expect(res.status).toHaveBeenCalledWith(404)
    expect(jsonCall(res)).toStrictEqual({
      error: { code: 'NOT_FOUND', message: 'missing' },
    })
  })

  it('FORBIDDEN maps to status 403', () => {
    const res = mockResponse()
    sendSentinelError(res, 'FORBIDDEN', 'denied')
    expect(res.status).toHaveBeenCalledWith(403)
    expect(jsonCall(res)).toStrictEqual({
      error: { code: 'FORBIDDEN', message: 'denied' },
    })
  })

  it('UNAVAILABLE maps to status 503', () => {
    const res = mockResponse()
    sendSentinelError(res, 'UNAVAILABLE', 'not configured')
    expect(res.status).toHaveBeenCalledWith(503)
    expect(jsonCall(res)).toStrictEqual({
      error: { code: 'UNAVAILABLE', message: 'not configured' },
    })
  })

  it('INTERNAL maps to status 500', () => {
    const res = mockResponse()
    sendSentinelError(res, 'INTERNAL', 'crash')
    expect(res.status).toHaveBeenCalledWith(500)
    expect(jsonCall(res)).toStrictEqual({
      error: { code: 'INTERNAL', message: 'crash' },
    })
  })

  it('preserves message verbatim including special characters and newlines', () => {
    const res = mockResponse()
    const message = 'Error: "value" failed validation\nat line 42'
    sendSentinelError(res, 'VALIDATION_FAILED', message)
    expect(jsonCall(res)).toStrictEqual({
      error: { code: 'VALIDATION_FAILED', message },
    })
  })
})
