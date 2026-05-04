// packages/agent/tests/sentinel/tools/add-to-blacklist.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  makeSentinelConfig,
  VALID_TARGET_ADDRESS,
  VALID_ENTRY_ID,
} from '../../fixtures/sentinel-tool-mocks.js'

const {
  mockInsertBlacklist,
  mockIsBlacklistWithinRateLimit,
  mockGetSentinelConfig,
  mockGuardianEmit,
} = vi.hoisted(() => ({
  mockInsertBlacklist: vi.fn(),
  mockIsBlacklistWithinRateLimit: vi.fn(),
  mockGetSentinelConfig: vi.fn(),
  mockGuardianEmit: vi.fn(),
}))

vi.mock('../../../src/db.js', () => ({
  insertBlacklist: mockInsertBlacklist,
}))

vi.mock('../../../src/sentinel/rate-limit.js', () => ({
  isBlacklistWithinRateLimit: mockIsBlacklistWithinRateLimit,
}))

vi.mock('../../../src/sentinel/config.js', () => ({
  getSentinelConfig: mockGetSentinelConfig,
}))

vi.mock('../../../src/coordination/event-bus.js', () => ({
  guardianBus: { emit: mockGuardianEmit },
}))

import {
  addToBlacklistTool,
  executeAddToBlacklist,
} from '../../../src/sentinel/tools/add-to-blacklist.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSentinelConfig.mockReturnValue(makeSentinelConfig())
  mockIsBlacklistWithinRateLimit.mockReturnValue(true)
  mockInsertBlacklist.mockReturnValue(VALID_ENTRY_ID)
})

describe('addToBlacklistTool definition', () => {
  it('has correct name', () => {
    expect(addToBlacklistTool.name).toBe('addToBlacklist')
  })

  it('declares required address, reason, severity (expiresAt and sourceEventId optional)', () => {
    expect(addToBlacklistTool.input_schema.required).toEqual([
      'address',
      'reason',
      'severity',
    ])
    expect(addToBlacklistTool.input_schema.properties).toHaveProperty('expiresAt')
    expect(addToBlacklistTool.input_schema.properties).toHaveProperty('sourceEventId')
  })

  it('declares severity enum [warn, block, critical]', () => {
    const props = addToBlacklistTool.input_schema.properties as Record<string, { enum?: string[] }>
    expect(props.severity.enum).toEqual(['warn', 'block', 'critical'])
  })
})

describe('executeAddToBlacklist — happy path', () => {
  it('returns success=true with entryId when autonomy enabled and within rate limit', async () => {
    const r = await executeAddToBlacklist({
      address: VALID_TARGET_ADDRESS,
      reason: 'scam',
      severity: 'block',
    })

    expect(r).toEqual({ success: true, entryId: VALID_ENTRY_ID })
  })

  it('forwards optional expiresAt and sourceEventId into insertBlacklist', async () => {
    await executeAddToBlacklist({
      address: VALID_TARGET_ADDRESS,
      reason: 'scam',
      severity: 'block',
      expiresAt: '2027-01-01T00:00:00Z',
      sourceEventId: 'evt-1',
    })

    const [arg] = mockInsertBlacklist.mock.calls[0]
    expect(arg.expiresAt).toBe('2027-01-01T00:00:00Z')
    expect(arg.sourceEventId).toBe('evt-1')
  })
})

describe('executeAddToBlacklist — branches (gates)', () => {
  it('returns success=false when blacklist autonomy is disabled', async () => {
    mockGetSentinelConfig.mockReturnValueOnce(makeSentinelConfig({ blacklistAutonomy: false }))

    const r = await executeAddToBlacklist({
      address: VALID_TARGET_ADDRESS,
      reason: 'scam',
      severity: 'warn',
    })

    expect(r.success).toBe(false)
    expect(r.error).toMatch(/blacklist autonomy disabled/i)
    expect(mockInsertBlacklist).not.toHaveBeenCalled()
    expect(mockGuardianEmit).not.toHaveBeenCalled()
  })

  it('returns success=false when rate-limit cap is reached', async () => {
    mockIsBlacklistWithinRateLimit.mockReturnValueOnce(false)

    const r = await executeAddToBlacklist({
      address: VALID_TARGET_ADDRESS,
      reason: 'scam',
      severity: 'warn',
    })

    expect(r.success).toBe(false)
    expect(r.error).toMatch(/rate.limit/i)
    expect(mockInsertBlacklist).not.toHaveBeenCalled()
    expect(mockGuardianEmit).not.toHaveBeenCalled()
  })

  it('handles severity=warn correctly (writes through to insertBlacklist)', async () => {
    await executeAddToBlacklist({
      address: VALID_TARGET_ADDRESS,
      reason: 'r',
      severity: 'warn',
    })

    expect(mockInsertBlacklist.mock.calls[0][0].severity).toBe('warn')
  })

  it('handles severity=critical correctly', async () => {
    await executeAddToBlacklist({
      address: VALID_TARGET_ADDRESS,
      reason: 'r',
      severity: 'critical',
    })

    expect(mockInsertBlacklist.mock.calls[0][0].severity).toBe('critical')
  })
})

describe('executeAddToBlacklist — service interaction', () => {
  it('reads rate-limit cap from config and passes it to isBlacklistWithinRateLimit', async () => {
    mockGetSentinelConfig.mockReturnValueOnce(
      makeSentinelConfig({ rateLimitBlacklistPerHour: 7 }),
    )

    await executeAddToBlacklist({
      address: VALID_TARGET_ADDRESS,
      reason: 'r',
      severity: 'warn',
    })

    expect(mockIsBlacklistWithinRateLimit).toHaveBeenCalledWith(7)
  })

  it('inserts blacklist row with addedBy="sentinel" and supplied params', async () => {
    await executeAddToBlacklist({
      address: VALID_TARGET_ADDRESS,
      reason: 'scam-pattern',
      severity: 'block',
    })

    expect(mockInsertBlacklist).toHaveBeenCalledTimes(1)
    expect(mockInsertBlacklist).toHaveBeenCalledWith({
      address: VALID_TARGET_ADDRESS,
      reason: 'scam-pattern',
      severity: 'block',
      addedBy: 'sentinel',
    })
  })

  it('emits sentinel:blacklist-added with entryId, address, severity, reason in data', async () => {
    await executeAddToBlacklist({
      address: VALID_TARGET_ADDRESS,
      reason: 'scam',
      severity: 'block',
    })

    expect(mockGuardianEmit).toHaveBeenCalledTimes(1)
    const [event] = mockGuardianEmit.mock.calls[0]
    expect(event).toStrictEqual({
      source: 'sentinel',
      type: 'sentinel:blacklist-added',
      level: 'important',
      data: {
        entryId: VALID_ENTRY_ID,
        address: VALID_TARGET_ADDRESS,
        severity: 'block',
        reason: 'scam',
      },
      wallet: null,
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
    })
  })

  it('propagates insertBlacklist throw', async () => {
    mockInsertBlacklist.mockImplementationOnce(() => {
      throw new Error('unique constraint violation')
    })

    await expect(
      executeAddToBlacklist({
        address: VALID_TARGET_ADDRESS,
        reason: 'r',
        severity: 'warn',
      }),
    ).rejects.toThrow(/unique constraint/)
  })
})
