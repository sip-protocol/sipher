// packages/agent/tests/sentinel/tools/alert-user.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  VALID_WALLET,
  VALID_ACTIVITY_ID,
} from '../../fixtures/sentinel-tool-mocks.js'

const {
  mockInsertActivity,
  mockGuardianEmit,
} = vi.hoisted(() => ({
  mockInsertActivity: vi.fn(),
  mockGuardianEmit: vi.fn(),
}))

vi.mock('../../../src/db.js', () => ({
  insertActivity: mockInsertActivity,
}))

vi.mock('../../../src/coordination/event-bus.js', () => ({
  guardianBus: { emit: mockGuardianEmit },
}))

import {
  alertUserTool,
  executeAlertUser,
} from '../../../src/sentinel/tools/alert-user.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockInsertActivity.mockReturnValue(VALID_ACTIVITY_ID)
})

describe('alertUserTool definition', () => {
  it('has correct name', () => {
    expect(alertUserTool.name).toBe('alertUser')
  })

  it('declares required wallet, severity, title, detail (actionableId optional)', () => {
    expect(alertUserTool.input_schema.required).toEqual([
      'wallet',
      'severity',
      'title',
      'detail',
    ])
    expect(alertUserTool.input_schema.properties).toHaveProperty('actionableId')
  })

  it('declares severity enum [warn, block, critical]', () => {
    const props = alertUserTool.input_schema.properties as Record<string, { enum?: string[] }>
    expect(props.severity.enum).toEqual(['warn', 'block', 'critical'])
  })
})

describe('executeAlertUser — happy path', () => {
  it('returns success=true with activityId from insertActivity', async () => {
    const r = await executeAlertUser({
      wallet: VALID_WALLET,
      severity: 'warn',
      title: 'Suspicious deposit',
      detail: 'new address',
    })

    expect(r).toEqual({ success: true, activityId: VALID_ACTIVITY_ID })
  })
})

describe('executeAlertUser — branches', () => {
  it('maps severity=critical to level=critical for both DB row and bus event', async () => {
    await executeAlertUser({
      wallet: VALID_WALLET,
      severity: 'critical',
      title: 'Severe',
      detail: 'd',
    })

    const [activityArg] = mockInsertActivity.mock.calls[0]
    expect(activityArg.level).toBe('critical')

    const [event] = mockGuardianEmit.mock.calls[0]
    expect(event.level).toBe('critical')
  })

  it('maps severity=warn to level=important', async () => {
    await executeAlertUser({
      wallet: VALID_WALLET,
      severity: 'warn',
      title: 't',
      detail: 'd',
    })

    expect(mockInsertActivity.mock.calls[0][0].level).toBe('important')
    expect(mockGuardianEmit.mock.calls[0][0].level).toBe('important')
  })

  it('maps severity=block to level=important (only "critical" promotes)', async () => {
    await executeAlertUser({
      wallet: VALID_WALLET,
      severity: 'block',
      title: 't',
      detail: 'd',
    })

    expect(mockInsertActivity.mock.calls[0][0].level).toBe('important')
    expect(mockGuardianEmit.mock.calls[0][0].level).toBe('important')
  })

  it('forwards actionableId into bus event data when provided', async () => {
    await executeAlertUser({
      wallet: VALID_WALLET,
      severity: 'warn',
      title: 't',
      detail: 'd',
      actionableId: 'act-123',
    })

    const [event] = mockGuardianEmit.mock.calls[0]
    expect(event.data.actionableId).toBe('act-123')
  })
})

describe('executeAlertUser — service interaction', () => {
  it('inserts activity row with agent="sentinel", type="alert", and supplied wallet/title/detail', async () => {
    await executeAlertUser({
      wallet: VALID_WALLET,
      severity: 'warn',
      title: 'Suspicious deposit',
      detail: 'new address',
    })

    expect(mockInsertActivity).toHaveBeenCalledTimes(1)
    expect(mockInsertActivity).toHaveBeenCalledWith({
      agent: 'sentinel',
      level: 'important',
      type: 'alert',
      title: 'Suspicious deposit',
      detail: 'new address',
      wallet: VALID_WALLET,
    })
  })

  it('emits sentinel:alert event with title, detail, severity in data', async () => {
    await executeAlertUser({
      wallet: VALID_WALLET,
      severity: 'warn',
      title: 'Suspicious deposit',
      detail: 'new address',
    })

    const [event] = mockGuardianEmit.mock.calls[0]
    expect(event).toStrictEqual({
      source: 'sentinel',
      type: 'sentinel:alert',
      level: 'important',
      data: {
        title: 'Suspicious deposit',
        detail: 'new address',
        severity: 'warn',
        actionableId: undefined,
      },
      wallet: VALID_WALLET,
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
    })
  })

  it('propagates insertActivity throw and skips bus emit', async () => {
    mockInsertActivity.mockImplementationOnce(() => {
      throw new Error('db locked')
    })

    await expect(
      executeAlertUser({
        wallet: VALID_WALLET,
        severity: 'warn',
        title: 't',
        detail: 'd',
      }),
    ).rejects.toThrow(/db locked/)

    expect(mockGuardianEmit).not.toHaveBeenCalled()
  })
})
