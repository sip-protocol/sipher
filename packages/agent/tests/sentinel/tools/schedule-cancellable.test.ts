// packages/agent/tests/sentinel/tools/schedule-cancellable.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VALID_ACTION_ID, VALID_WALLET, VALID_DECISION_ID } from '../../fixtures/sentinel-tool-mocks.js'

const { mockScheduleCancellable } = vi.hoisted(() => ({
  mockScheduleCancellable: vi.fn(),
}))

vi.mock('../../../src/sentinel/circuit-breaker.js', () => ({
  scheduleCancellableAction: mockScheduleCancellable,
}))

import {
  scheduleCancellableTool,
  executeScheduleCancellable,
} from '../../../src/sentinel/tools/schedule-cancellable.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockScheduleCancellable.mockReturnValue(VALID_ACTION_ID)
})

describe('scheduleCancellableTool definition', () => {
  it('has correct name', () => {
    expect(scheduleCancellableTool.name).toBe('scheduleCancellableAction')
  })

  it('declares required actionType, payload, reasoning, delayMs, wallet', () => {
    expect(scheduleCancellableTool.input_schema.required).toEqual([
      'actionType',
      'payload',
      'reasoning',
      'delayMs',
      'wallet',
    ])
  })

  it('declares decisionId as optional (not in required)', () => {
    expect(scheduleCancellableTool.input_schema.required).not.toContain('decisionId')
    expect(scheduleCancellableTool.input_schema.properties).toHaveProperty('decisionId')
  })
})

describe('executeScheduleCancellable — happy path', () => {
  it('returns { success: true, actionId } when scheduler returns an id', async () => {
    const r = await executeScheduleCancellable({
      actionType: 'refund',
      payload: { pda: 'p1', amount: 2 },
      reasoning: 'over threshold',
      delayMs: 30_000,
      wallet: VALID_WALLET,
    })

    expect(r).toEqual({ success: true, actionId: VALID_ACTION_ID })
  })

  it('forwards optional decisionId when provided', async () => {
    await executeScheduleCancellable({
      actionType: 'refund',
      payload: {},
      reasoning: 'r',
      delayMs: 1000,
      wallet: VALID_WALLET,
      decisionId: VALID_DECISION_ID,
    })

    const [arg] = mockScheduleCancellable.mock.calls[0]
    expect(arg.decisionId).toBe(VALID_DECISION_ID)
  })
})

describe('executeScheduleCancellable — service interaction', () => {
  it('passes the full params object to scheduleCancellableAction', async () => {
    await executeScheduleCancellable({
      actionType: 'refund',
      payload: { pda: 'p1', amount: 2 },
      reasoning: 'over threshold',
      delayMs: 30_000,
      wallet: VALID_WALLET,
    })

    expect(mockScheduleCancellable).toHaveBeenCalledTimes(1)
    expect(mockScheduleCancellable).toHaveBeenCalledWith({
      actionType: 'refund',
      payload: { pda: 'p1', amount: 2 },
      reasoning: 'over threshold',
      delayMs: 30_000,
      wallet: VALID_WALLET,
    })
  })

  it('propagates synchronous throw from scheduleCancellableAction', async () => {
    mockScheduleCancellable.mockImplementationOnce(() => {
      throw new Error('queue full')
    })

    await expect(
      executeScheduleCancellable({
        actionType: 'refund',
        payload: {},
        reasoning: 'r',
        delayMs: 1000,
        wallet: VALID_WALLET,
      }),
    ).rejects.toThrow(/queue full/)
  })
})
