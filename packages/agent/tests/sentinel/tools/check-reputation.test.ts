// packages/agent/tests/sentinel/tools/check-reputation.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  makeBlacklistEntry,
  VALID_TARGET_ADDRESS,
} from '../../fixtures/sentinel-tool-mocks.js'

const { mockGetActiveBlacklistEntry } = vi.hoisted(() => ({
  mockGetActiveBlacklistEntry: vi.fn(),
}))

vi.mock('../../../src/db.js', () => ({
  getActiveBlacklistEntry: mockGetActiveBlacklistEntry,
}))

import {
  checkReputationTool,
  executeCheckReputation,
} from '../../../src/sentinel/tools/check-reputation.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('checkReputationTool definition', () => {
  it('has correct name', () => {
    expect(checkReputationTool.name).toBe('checkReputation')
  })

  it('declares required address field', () => {
    expect(checkReputationTool.input_schema.required).toEqual(['address'])
  })

  it('has a non-empty description', () => {
    expect(checkReputationTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeCheckReputation — input validation', () => {
  it('rejects empty address string', async () => {
    await expect(
      executeCheckReputation({ address: '' }),
    ).rejects.toThrow(/address is required/i)
  })
})

describe('executeCheckReputation — branches', () => {
  it('returns blacklisted=true with entry when getActiveBlacklistEntry resolves to a row', async () => {
    const entry = makeBlacklistEntry({ address: VALID_TARGET_ADDRESS, reason: 'scam' })
    mockGetActiveBlacklistEntry.mockReturnValueOnce(entry)

    const r = await executeCheckReputation({ address: VALID_TARGET_ADDRESS })

    expect(r.blacklisted).toBe(true)
    expect(r.entry?.reason).toBe('scam')
    expect(r.entry?.address).toBe(VALID_TARGET_ADDRESS)
  })

  it('returns blacklisted=false with entry undefined when getActiveBlacklistEntry returns null', async () => {
    mockGetActiveBlacklistEntry.mockReturnValueOnce(null)

    const r = await executeCheckReputation({ address: 'clean-address' })

    expect(r.blacklisted).toBe(false)
    expect(r.entry).toBeUndefined()
  })
})

describe('executeCheckReputation — service interaction', () => {
  it('calls getActiveBlacklistEntry with the supplied address verbatim', async () => {
    mockGetActiveBlacklistEntry.mockReturnValueOnce(null)

    await executeCheckReputation({ address: VALID_TARGET_ADDRESS })

    expect(mockGetActiveBlacklistEntry).toHaveBeenCalledTimes(1)
    expect(mockGetActiveBlacklistEntry).toHaveBeenCalledWith(VALID_TARGET_ADDRESS)
  })

  it('propagates getActiveBlacklistEntry throw', async () => {
    mockGetActiveBlacklistEntry.mockImplementationOnce(() => {
      throw new Error('db locked')
    })

    await expect(
      executeCheckReputation({ address: VALID_TARGET_ADDRESS }),
    ).rejects.toThrow(/db locked/)
  })
})
