// packages/agent/tests/sentinel/tools/get-pending-claims.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  makePendingClaimRow,
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
  getPendingClaimsTool,
  executeGetPendingClaims,
} from '../../../src/sentinel/tools/get-pending-claims.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockPrepare.mockReturnValue({ all: mockAll })
  mockGetDb.mockReturnValue({ prepare: mockPrepare })
  mockAll.mockReturnValue([])
})

describe('getPendingClaimsTool definition', () => {
  it('has correct name', () => {
    expect(getPendingClaimsTool.name).toBe('getPendingClaims')
  })

  it('declares no required fields (wallet optional)', () => {
    expect(getPendingClaimsTool.input_schema.required).toBeUndefined()
    expect(getPendingClaimsTool.input_schema.properties).toHaveProperty('wallet')
  })

  it('has a non-empty description', () => {
    expect(getPendingClaimsTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeGetPendingClaims — happy path', () => {
  it('returns mapped claims when DB returns rows with full detail', async () => {
    mockAll.mockReturnValueOnce([
      makePendingClaimRow({
        detail: JSON.stringify({ ephemeralPubkey: 'eph1', amount: 0.5 }),
        created_at: '2026-05-04T00:00:00.000Z',
      }),
    ])

    const r = await executeGetPendingClaims({ wallet: VALID_WALLET })

    expect(r.claims.length).toBe(1)
    expect(r.claims[0].ephemeralPubkey).toBe('eph1')
    expect(r.claims[0].amount).toBe(0.5)
    expect(r.claims[0].detectedAt).toBe('2026-05-04T00:00:00.000Z')
  })
})

describe('executeGetPendingClaims — branches', () => {
  it('returns empty claims when DB returns no rows', async () => {
    mockAll.mockReturnValueOnce([])

    const r = await executeGetPendingClaims({})

    expect(r.claims).toEqual([])
  })

  it('falls back to "unknown" ephemeralPubkey when detail JSON omits it', async () => {
    mockAll.mockReturnValueOnce([
      makePendingClaimRow({
        detail: JSON.stringify({ amount: 1 }),
      }),
    ])

    const r = await executeGetPendingClaims({})

    expect(r.claims[0].ephemeralPubkey).toBe('unknown')
    expect(r.claims[0].amount).toBe(1)
  })

  it('falls back to amount=0 when detail JSON omits it', async () => {
    mockAll.mockReturnValueOnce([
      makePendingClaimRow({
        detail: JSON.stringify({ ephemeralPubkey: 'eph2' }),
      }),
    ])

    const r = await executeGetPendingClaims({})

    expect(r.claims[0].amount).toBe(0)
  })
})

describe('executeGetPendingClaims — service interaction', () => {
  it('builds SQL without wallet filter when wallet param is omitted', async () => {
    await executeGetPendingClaims({})

    expect(mockPrepare).toHaveBeenCalledTimes(1)
    const [sql] = mockPrepare.mock.calls[0]
    expect(sql).toContain(`agent = 'sentinel' AND type = 'unclaimed'`)
    expect(sql).not.toContain('wallet = ?')
    expect(mockAll).toHaveBeenCalledWith()
  })

  it('builds SQL with wallet filter when wallet is provided', async () => {
    await executeGetPendingClaims({ wallet: VALID_WALLET })

    const [sql] = mockPrepare.mock.calls[0]
    expect(sql).toContain('wallet = ?')
    expect(mockAll).toHaveBeenCalledWith(VALID_WALLET)
  })

  it('orders by created_at DESC and limits to 100', async () => {
    await executeGetPendingClaims({})

    const [sql] = mockPrepare.mock.calls[0]
    expect(sql).toMatch(/ORDER BY created_at DESC/)
    expect(sql).toMatch(/LIMIT 100/)
  })
})
