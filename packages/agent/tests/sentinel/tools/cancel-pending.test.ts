// packages/agent/tests/sentinel/tools/cancel-pending.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VALID_ACTION_ID } from '../../fixtures/sentinel-tool-mocks.js'

const { mockCancelCircuitBreaker } = vi.hoisted(() => ({
  mockCancelCircuitBreaker: vi.fn(),
}))

vi.mock('../../../src/sentinel/circuit-breaker.js', () => ({
  cancelCircuitBreakerAction: mockCancelCircuitBreaker,
}))

import {
  cancelPendingTool,
  executeCancelPending,
} from '../../../src/sentinel/tools/cancel-pending.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('cancelPendingTool definition', () => {
  it('has correct name', () => {
    expect(cancelPendingTool.name).toBe('cancelPendingAction')
  })

  it('declares required actionId and reason', () => {
    expect(cancelPendingTool.input_schema.required).toEqual(['actionId', 'reason'])
  })

  it('has a non-empty description', () => {
    expect(cancelPendingTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeCancelPending — happy path', () => {
  it('returns success=true when circuit-breaker cancellation succeeds', async () => {
    mockCancelCircuitBreaker.mockReturnValueOnce(true)

    const r = await executeCancelPending({
      actionId: VALID_ACTION_ID,
      reason: 'reconsidered',
    })

    expect(r).toEqual({ success: true })
  })
})

describe('executeCancelPending — branches', () => {
  it('returns success=false when circuit breaker reports cancellation failed', async () => {
    mockCancelCircuitBreaker.mockReturnValueOnce(false)

    const r = await executeCancelPending({
      actionId: VALID_ACTION_ID,
      reason: 'too late',
    })

    expect(r).toEqual({ success: false })
  })
})

describe('executeCancelPending — service interaction', () => {
  it('passes actionId, "sentinel" actor, and reason to cancelCircuitBreakerAction', async () => {
    mockCancelCircuitBreaker.mockReturnValueOnce(true)

    await executeCancelPending({
      actionId: VALID_ACTION_ID,
      reason: 'risk reassessed',
    })

    expect(mockCancelCircuitBreaker).toHaveBeenCalledTimes(1)
    expect(mockCancelCircuitBreaker).toHaveBeenCalledWith(
      VALID_ACTION_ID,
      'sentinel',
      'risk reassessed',
    )
  })

  it('propagates synchronous throw from cancelCircuitBreakerAction', async () => {
    mockCancelCircuitBreaker.mockImplementationOnce(() => {
      throw new Error('breaker offline')
    })

    await expect(
      executeCancelPending({ actionId: VALID_ACTION_ID, reason: 'r' }),
    ).rejects.toThrow(/breaker offline/)
  })
})
