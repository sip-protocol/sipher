// packages/agent/tests/herald/tools/read-dms.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeXDmEvent, type ToolSchemaLike } from '../../fixtures/herald-tool-mocks.js'

const {
  mockGetWriteClient,
  mockCanMakeCall,
  mockTrackXApiCost,
  mockListDmEvents,
} = vi.hoisted(() => ({
  mockGetWriteClient: vi.fn(),
  mockCanMakeCall: vi.fn(),
  mockTrackXApiCost: vi.fn(),
  mockListDmEvents: vi.fn(),
}))

vi.mock('../../../src/herald/x-client.js', () => ({
  getWriteClient: mockGetWriteClient,
}))

vi.mock('../../../src/herald/budget.js', () => ({
  canMakeCall: mockCanMakeCall,
  trackXApiCost: mockTrackXApiCost,
}))

import {
  readDMsTool,
  executeReadDMs,
} from '../../../src/herald/tools/read-dms.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCanMakeCall.mockReturnValue(true)
  mockGetWriteClient.mockReturnValue({ v2: { listDmEvents: mockListDmEvents } })
  mockListDmEvents.mockResolvedValue({
    data: { data: [makeXDmEvent(), makeXDmEvent({ id: 'dm_event_43' })] },
  })
})

describe('readDMsTool definition', () => {
  it('has correct name', () => {
    expect(readDMsTool.name).toBe('readDMs')
  })

  it('declares no required fields (max_results is optional)', () => {
    const schema = readDMsTool.parameters as ToolSchemaLike
    expect(schema.required).toEqual([])
  })

  it('has a non-empty description', () => {
    expect(readDMsTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeReadDMs — happy path', () => {
  it('returns mapped DMs and cost reflecting result count', async () => {
    const r = await executeReadDMs({})

    expect(r.dms).toHaveLength(2)
    expect(r.cost).toBeCloseTo(0.02, 5)
  })

  it('output shape projects id, text, event_type, created_at, sender_id per DM', async () => {
    const r = await executeReadDMs({})

    const keys = Object.keys(r.dms[0]).sort()
    expect(keys).toEqual(['created_at', 'event_type', 'id', 'sender_id', 'text'])
  })
})

describe('executeReadDMs — branches', () => {
  it('returns { dms: [], cost: 0 } when budget gate blocks dm_read', async () => {
    mockCanMakeCall.mockReturnValueOnce(false)

    const r = await executeReadDMs({})

    expect(r).toEqual({ dms: [], cost: 0 })
    expect(mockListDmEvents).not.toHaveBeenCalled()
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })

  it('clamps max_results below floor (1) up to 1', async () => {
    await executeReadDMs({ max_results: 0 })

    const callOpts = mockListDmEvents.mock.calls[0][0] as { max_results: number }
    expect(callOpts.max_results).toBe(1)
  })

  it('clamps max_results above ceiling (100) down to 100', async () => {
    await executeReadDMs({ max_results: 500 })

    const callOpts = mockListDmEvents.mock.calls[0][0] as { max_results: number }
    expect(callOpts.max_results).toBe(100)
  })

  it('uses default max_results=10 when omitted', async () => {
    await executeReadDMs({})

    const callOpts = mockListDmEvents.mock.calls[0][0] as { max_results: number }
    expect(callOpts.max_results).toBe(10)
  })

  it.each([
    ['401 Unauthorized', '401 Unauthorized'],
    ['403 Forbidden', '403 Forbidden'],
    ['"not authorized" message', 'User is not authorized for DM read'],
  ])('rescues %s errors to empty result with no cost tracking', async (_label, msg) => {
    mockListDmEvents.mockRejectedValueOnce(new Error(msg))

    const r = await executeReadDMs({})

    expect(r).toEqual({ dms: [], cost: 0 })
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })

  it('rescues non-Error throws via String() coercion (e.g. raw string with 401)', async () => {
    mockListDmEvents.mockRejectedValueOnce('401 access denied')

    const r = await executeReadDMs({})

    expect(r).toEqual({ dms: [], cost: 0 })
  })

  it('returns empty dms array when API returns no data, with cost 0.01 (count=1 floor)', async () => {
    mockListDmEvents.mockResolvedValueOnce({ data: { data: [] } })

    const r = await executeReadDMs({})

    expect(r.dms).toEqual([])
    expect(r.cost).toBeCloseTo(0.01, 5)
    expect(mockTrackXApiCost).toHaveBeenCalledWith('dm_read', 1)
  })
})

describe('executeReadDMs — service interaction', () => {
  it('calls v2.listDmEvents with clamped max_results and dm_event.fields list', async () => {
    await executeReadDMs({ max_results: 25 })

    expect(mockListDmEvents).toHaveBeenCalledTimes(1)
    expect(mockListDmEvents).toHaveBeenCalledWith({
      max_results: 25,
      'dm_event.fields': ['id', 'text', 'event_type', 'created_at', 'sender_id'],
    })
  })

  it('tracks dm_read cost with resourceCount = dms.length', async () => {
    await executeReadDMs({})
    expect(mockTrackXApiCost).toHaveBeenCalledWith('dm_read', 2)
  })

  it('rethrows non-auth errors (e.g. 500 server error)', async () => {
    mockListDmEvents.mockRejectedValueOnce(new Error('500 Internal Server Error'))

    await expect(executeReadDMs({})).rejects.toThrow(/500 Internal Server Error/)
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })

  it('rethrows non-auth errors with no recognizable status code', async () => {
    mockListDmEvents.mockRejectedValueOnce(new Error('connection reset'))

    await expect(executeReadDMs({})).rejects.toThrow(/connection reset/)
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })
})
