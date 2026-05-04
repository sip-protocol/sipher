// packages/agent/tests/sentinel/tools/get-recent-activity.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  makeActivityStreamRow,
  VALID_WALLET,
} from '../../fixtures/sentinel-tool-mocks.js'

const {
  mockAll,
  mockPrepare,
  mockGetDb,
} = vi.hoisted(() => ({
  mockAll: vi.fn(),
  mockPrepare: vi.fn(),
  mockGetDb: vi.fn(),
}))

vi.mock('../../../src/db.js', () => ({
  getDb: mockGetDb,
}))

import {
  getRecentActivityTool,
  executeGetRecentActivity,
} from '../../../src/sentinel/tools/get-recent-activity.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockPrepare.mockReturnValue({ all: mockAll })
  mockGetDb.mockReturnValue({ prepare: mockPrepare })
  mockAll.mockReturnValue([])
})

describe('getRecentActivityTool definition', () => {
  it('has correct name', () => {
    expect(getRecentActivityTool.name).toBe('getRecentActivity')
  })

  it('declares required address (limit, since optional)', () => {
    expect(getRecentActivityTool.input_schema.required).toEqual(['address'])
    expect(getRecentActivityTool.input_schema.properties).toHaveProperty('limit')
    expect(getRecentActivityTool.input_schema.properties).toHaveProperty('since')
  })

  it('has a non-empty description', () => {
    expect(getRecentActivityTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeGetRecentActivity — happy path', () => {
  it('returns mapped events with parsed detail JSON', async () => {
    mockAll.mockReturnValueOnce([
      makeActivityStreamRow({
        title: 'send 1 SOL',
        detail: JSON.stringify({ amount: 1, recipient: 'r1' }),
      }),
    ])

    const r = await executeGetRecentActivity({ address: VALID_WALLET, limit: 10 })

    expect(r.count).toBe(1)
    expect(r.events.length).toBe(1)
    expect(r.events[0].title).toBe('send 1 SOL')
    expect(r.events[0].detail).toEqual({ amount: 1, recipient: 'r1' })
  })

  it('returns count=0 and empty events when DB returns nothing', async () => {
    mockAll.mockReturnValueOnce([])

    const r = await executeGetRecentActivity({ address: VALID_WALLET })

    expect(r.count).toBe(0)
    expect(r.events).toEqual([])
  })
})

describe('executeGetRecentActivity — branches', () => {
  it('treats null detail as empty object {}', async () => {
    mockAll.mockReturnValueOnce([
      makeActivityStreamRow({ detail: null }),
    ])

    const r = await executeGetRecentActivity({ address: VALID_WALLET })

    expect(r.events[0].detail).toEqual({})
  })
})

describe('executeGetRecentActivity — service interaction', () => {
  it('builds SQL without "since" clause when since param is omitted', async () => {
    await executeGetRecentActivity({ address: VALID_WALLET })

    const [sql] = mockPrepare.mock.calls[0]
    expect(sql).toContain('wallet = ?')
    expect(sql).not.toContain('created_at > ?')
    expect(mockAll).toHaveBeenCalledWith(VALID_WALLET, 20)
  })

  it('builds SQL with "since" clause when since is provided', async () => {
    await executeGetRecentActivity({
      address: VALID_WALLET,
      since: '2026-05-01T00:00:00Z',
    })

    const [sql] = mockPrepare.mock.calls[0]
    expect(sql).toContain('created_at > ?')
    expect(mockAll).toHaveBeenCalledWith(
      VALID_WALLET,
      '2026-05-01T00:00:00Z',
      20,
    )
  })

  it('uses default limit of 20 when not provided', async () => {
    await executeGetRecentActivity({ address: VALID_WALLET })

    expect(mockAll).toHaveBeenCalledWith(VALID_WALLET, 20)
  })

  it('forwards explicit limit value', async () => {
    await executeGetRecentActivity({ address: VALID_WALLET, limit: 5 })

    expect(mockAll).toHaveBeenCalledWith(VALID_WALLET, 5)
  })

  it('orders by created_at DESC', async () => {
    await executeGetRecentActivity({ address: VALID_WALLET })

    const [sql] = mockPrepare.mock.calls[0]
    expect(sql).toMatch(/ORDER BY created_at DESC/)
  })

  it('propagates DB throw from prepare().all()', async () => {
    mockAll.mockImplementationOnce(() => {
      throw new Error('db locked')
    })

    await expect(
      executeGetRecentActivity({ address: VALID_WALLET }),
    ).rejects.toThrow(/db locked/)
  })
})
