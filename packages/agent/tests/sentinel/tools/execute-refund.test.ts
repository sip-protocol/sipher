// packages/agent/tests/sentinel/tools/execute-refund.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  makeSentinelConfig,
  VALID_PDA,
  VALID_WALLET,
  VALID_ACTION_ID,
  VALID_DECISION_ID,
} from '../../fixtures/sentinel-tool-mocks.js'

const {
  mockGetSentinelConfig,
  mockScheduleCancellable,
  mockPerformVaultRefund,
} = vi.hoisted(() => ({
  mockGetSentinelConfig: vi.fn(),
  mockScheduleCancellable: vi.fn(),
  mockPerformVaultRefund: vi.fn(),
}))

vi.mock('../../../src/sentinel/config.js', () => ({
  getSentinelConfig: mockGetSentinelConfig,
}))

vi.mock('../../../src/sentinel/circuit-breaker.js', () => ({
  scheduleCancellableAction: mockScheduleCancellable,
}))

vi.mock('../../../src/sentinel/vault-refund.js', () => ({
  performVaultRefund: mockPerformVaultRefund,
}))

import {
  executeRefundTool,
  executeSentinelRefund,
} from '../../../src/sentinel/tools/execute-refund.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSentinelConfig.mockReturnValue(makeSentinelConfig())
  mockScheduleCancellable.mockReturnValue(VALID_ACTION_ID)
  mockPerformVaultRefund.mockResolvedValue({ success: true, txId: 'sig1' })
})

describe('executeRefundTool definition', () => {
  it('has correct name', () => {
    expect(executeRefundTool.name).toBe('executeRefund')
  })

  it('declares required pda, amount, reasoning, wallet (decisionId optional)', () => {
    expect(executeRefundTool.input_schema.required).toEqual([
      'pda',
      'amount',
      'reasoning',
      'wallet',
    ])
    expect(executeRefundTool.input_schema.properties).toHaveProperty('decisionId')
  })

  it('description mentions threshold and circuit-breaker', () => {
    expect(executeRefundTool.description).toMatch(/SENTINEL_AUTO_REFUND_THRESHOLD/)
    expect(executeRefundTool.description).toMatch(/circuit-breaker/i)
  })
})

describe('executeSentinelRefund — mode gates', () => {
  it('throws when mode=advisory regardless of amount', async () => {
    mockGetSentinelConfig.mockReturnValueOnce(makeSentinelConfig({ mode: 'advisory' }))

    await expect(
      executeSentinelRefund({
        pda: VALID_PDA,
        amount: 0.1,
        reasoning: 't',
        wallet: VALID_WALLET,
      }),
    ).rejects.toThrow(/advisory/)

    expect(mockPerformVaultRefund).not.toHaveBeenCalled()
    expect(mockScheduleCancellable).not.toHaveBeenCalled()
  })

  it('throws when mode=off', async () => {
    mockGetSentinelConfig.mockReturnValueOnce(makeSentinelConfig({ mode: 'off' }))

    await expect(
      executeSentinelRefund({
        pda: VALID_PDA,
        amount: 0.1,
        reasoning: 't',
        wallet: VALID_WALLET,
      }),
    ).rejects.toThrow(/off/)
  })
})

describe('executeSentinelRefund — branches', () => {
  it('amount ≤ threshold → mode=immediate, calls performVaultRefund', async () => {
    mockGetSentinelConfig.mockReturnValueOnce(
      makeSentinelConfig({ autoRefundThreshold: 5 }),
    )

    const r = await executeSentinelRefund({
      pda: VALID_PDA,
      amount: 0.5,
      reasoning: 'small',
      wallet: VALID_WALLET,
    })

    expect(r.mode).toBe('immediate')
    expect(r.result).toEqual({ success: true, txId: 'sig1' })
    expect(mockPerformVaultRefund).toHaveBeenCalledTimes(1)
    expect(mockPerformVaultRefund).toHaveBeenCalledWith(VALID_PDA, 0.5)
    expect(mockScheduleCancellable).not.toHaveBeenCalled()
  })

  it('amount === threshold → mode=immediate (boundary inclusive)', async () => {
    mockGetSentinelConfig.mockReturnValueOnce(
      makeSentinelConfig({ autoRefundThreshold: 5 }),
    )

    const r = await executeSentinelRefund({
      pda: VALID_PDA,
      amount: 5,
      reasoning: 'at boundary',
      wallet: VALID_WALLET,
    })

    expect(r.mode).toBe('immediate')
  })

  it('amount > threshold → mode=scheduled, schedules cancellable action', async () => {
    mockGetSentinelConfig.mockReturnValueOnce(
      makeSentinelConfig({ autoRefundThreshold: 1, cancelWindowMs: 30_000 }),
    )

    const r = await executeSentinelRefund({
      pda: VALID_PDA,
      amount: 10,
      reasoning: 'large',
      wallet: VALID_WALLET,
    })

    expect(r.mode).toBe('scheduled')
    expect(r.actionId).toBe(VALID_ACTION_ID)
    expect(mockPerformVaultRefund).not.toHaveBeenCalled()
    expect(mockScheduleCancellable).toHaveBeenCalledTimes(1)
  })
})

describe('executeSentinelRefund — service interaction (scheduled path)', () => {
  it('passes actionType=refund, payload, delayMs from config to scheduleCancellableAction', async () => {
    mockGetSentinelConfig.mockReturnValueOnce(
      makeSentinelConfig({ autoRefundThreshold: 1, cancelWindowMs: 60_000 }),
    )

    await executeSentinelRefund({
      pda: VALID_PDA,
      amount: 5,
      reasoning: 'over threshold',
      wallet: VALID_WALLET,
      decisionId: VALID_DECISION_ID,
    })

    expect(mockScheduleCancellable).toHaveBeenCalledWith({
      actionType: 'refund',
      payload: { pda: VALID_PDA, amount: 5 },
      reasoning: 'over threshold',
      wallet: VALID_WALLET,
      delayMs: 60_000,
      decisionId: VALID_DECISION_ID,
    })
  })

  it('schedules without decisionId when caller omits it', async () => {
    mockGetSentinelConfig.mockReturnValueOnce(
      makeSentinelConfig({ autoRefundThreshold: 0 }),
    )

    await executeSentinelRefund({
      pda: VALID_PDA,
      amount: 1,
      reasoning: 'r',
      wallet: VALID_WALLET,
    })

    const [arg] = mockScheduleCancellable.mock.calls[0]
    expect(arg.decisionId).toBeUndefined()
  })
})

describe('executeSentinelRefund — service errors', () => {
  it('propagates performVaultRefund rejection (immediate path)', async () => {
    mockGetSentinelConfig.mockReturnValueOnce(
      makeSentinelConfig({ autoRefundThreshold: 5 }),
    )
    mockPerformVaultRefund.mockRejectedValueOnce(new Error('vault paused'))

    await expect(
      executeSentinelRefund({
        pda: VALID_PDA,
        amount: 1,
        reasoning: 'r',
        wallet: VALID_WALLET,
      }),
    ).rejects.toThrow(/vault paused/)
  })

  it('propagates scheduleCancellableAction throw (scheduled path)', async () => {
    mockGetSentinelConfig.mockReturnValueOnce(
      makeSentinelConfig({ autoRefundThreshold: 1 }),
    )
    mockScheduleCancellable.mockImplementationOnce(() => {
      throw new Error('queue full')
    })

    await expect(
      executeSentinelRefund({
        pda: VALID_PDA,
        amount: 5,
        reasoning: 'r',
        wallet: VALID_WALLET,
      }),
    ).rejects.toThrow(/queue full/)
  })
})
