import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VALID_ENTRY_ID } from '../../fixtures/sentinel-tool-mocks.js'

const {
  mockSoftRemoveBlacklist,
  mockGuardianEmit,
} = vi.hoisted(() => ({
  mockSoftRemoveBlacklist: vi.fn(),
  mockGuardianEmit: vi.fn(),
}))

vi.mock('../../../src/db.js', () => ({
  softRemoveBlacklist: mockSoftRemoveBlacklist,
}))

vi.mock('../../../src/coordination/event-bus.js', () => ({
  guardianBus: { emit: mockGuardianEmit },
}))

import {
  removeFromBlacklistTool,
  executeRemoveFromBlacklist,
} from '../../../src/sentinel/tools/remove-from-blacklist.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('removeFromBlacklistTool definition', () => {
  it('has correct name', () => {
    expect(removeFromBlacklistTool.name).toBe('removeFromBlacklist')
  })

  it('declares required entryId and reason', () => {
    expect(removeFromBlacklistTool.input_schema.required).toEqual(['entryId', 'reason'])
  })

  it('has a non-empty description', () => {
    expect(removeFromBlacklistTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeRemoveFromBlacklist — happy path', () => {
  it('returns success=true when softRemove and bus emit succeed', async () => {
    const r = await executeRemoveFromBlacklist({
      entryId: VALID_ENTRY_ID,
      reason: 'false positive',
    })

    expect(r).toEqual({ success: true })
  })
})

describe('executeRemoveFromBlacklist — service interaction', () => {
  it('passes entryId, "sentinel" actor, and reason to softRemoveBlacklist', async () => {
    await executeRemoveFromBlacklist({
      entryId: VALID_ENTRY_ID,
      reason: 'false positive',
    })

    expect(mockSoftRemoveBlacklist).toHaveBeenCalledTimes(1)
    expect(mockSoftRemoveBlacklist).toHaveBeenCalledWith(
      VALID_ENTRY_ID,
      'sentinel',
      'false positive',
    )
  })

  it('emits sentinel:blacklist-removed event with entryId and reason', async () => {
    await executeRemoveFromBlacklist({
      entryId: VALID_ENTRY_ID,
      reason: 'false positive',
    })

    expect(mockGuardianEmit).toHaveBeenCalledTimes(1)
    const [event] = mockGuardianEmit.mock.calls[0]
    expect(event).toStrictEqual({
      source: 'sentinel',
      type: 'sentinel:blacklist-removed',
      level: 'important',
      data: { entryId: VALID_ENTRY_ID, reason: 'false positive' },
      wallet: null,
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
    })
  })

  it('propagates softRemoveBlacklist throw and skips bus emit', async () => {
    mockSoftRemoveBlacklist.mockImplementationOnce(() => {
      throw new Error('entry not found')
    })

    await expect(
      executeRemoveFromBlacklist({ entryId: VALID_ENTRY_ID, reason: 'r' }),
    ).rejects.toThrow(/entry not found/)

    expect(mockGuardianEmit).not.toHaveBeenCalled()
  })
})
