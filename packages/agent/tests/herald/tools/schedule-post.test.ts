// packages/agent/tests/herald/tools/schedule-post.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SAMPLE_POST_TEXT, type ToolSchemaLike } from '../../fixtures/herald-tool-mocks.js'

const SCHEDULED_AT = '2026-12-01T09:00:00Z'
const FAKE_ULID = '01HZZZQQQQQQQQQQQQQQQQQQQQ'

const {
  mockGetDb,
  mockUlid,
  mockPrepare,
  mockRun,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockUlid: vi.fn(),
  mockPrepare: vi.fn(),
  mockRun: vi.fn(),
}))

vi.mock('../../../src/db.js', () => ({
  getDb: mockGetDb,
}))

vi.mock('ulid', () => ({
  ulid: mockUlid,
}))

import {
  schedulePostTool,
  executeSchedulePost,
} from '../../../src/herald/tools/schedule-post.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockUlid.mockReturnValue(FAKE_ULID)
  mockPrepare.mockReturnValue({ run: mockRun })
  mockGetDb.mockReturnValue({ prepare: mockPrepare })
  mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 })
})

describe('schedulePostTool definition', () => {
  it('has correct name', () => {
    expect(schedulePostTool.name).toBe('schedulePost')
  })

  it('declares required text and scheduled_at fields', () => {
    const schema = schedulePostTool.parameters as ToolSchemaLike
    expect(schema.required).toEqual(['text', 'scheduled_at'])
  })

  it('has a non-empty description', () => {
    expect(schedulePostTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeSchedulePost — happy path', () => {
  it('returns { queued: true, id } with the ulid as id', async () => {
    const r = await executeSchedulePost({
      text: SAMPLE_POST_TEXT,
      scheduled_at: SCHEDULED_AT,
    })
    expect(r).toEqual({ queued: true, id: FAKE_ULID })
  })

  it('output shape has exactly { queued, id }', async () => {
    const r = await executeSchedulePost({
      text: SAMPLE_POST_TEXT,
      scheduled_at: SCHEDULED_AT,
    })
    expect(Object.keys(r).sort()).toEqual(['id', 'queued'])
  })
})

describe('executeSchedulePost — branches', () => {
  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
    ['tabs', '\t\t'],
  ])('throws when text is %s', async (_label, text) => {
    await expect(
      executeSchedulePost({ text, scheduled_at: SCHEDULED_AT }),
    ).rejects.toThrow(/text is required/i)
    expect(mockPrepare).not.toHaveBeenCalled()
  })

  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
    ['tabs', '\t\t'],
  ])('throws when scheduled_at is %s', async (_label, scheduled_at) => {
    await expect(
      executeSchedulePost({ text: SAMPLE_POST_TEXT, scheduled_at }),
    ).rejects.toThrow(/scheduled_at is required/i)
    expect(mockPrepare).not.toHaveBeenCalled()
  })
})

describe('executeSchedulePost — service interaction', () => {
  it('prepares an INSERT into herald_queue', async () => {
    await executeSchedulePost({
      text: SAMPLE_POST_TEXT,
      scheduled_at: SCHEDULED_AT,
    })

    expect(mockPrepare).toHaveBeenCalledTimes(1)
    const sql = mockPrepare.mock.calls[0][0] as string
    expect(sql).toMatch(/INSERT INTO herald_queue/i)
    expect(sql).toMatch(/'post'/)
    expect(sql).toMatch(/'pending'/)
  })

  it('runs the INSERT with id, text, scheduled_at, and an ISO created_at', async () => {
    await executeSchedulePost({
      text: SAMPLE_POST_TEXT,
      scheduled_at: SCHEDULED_AT,
    })

    expect(mockRun).toHaveBeenCalledTimes(1)
    const args = mockRun.mock.calls[0]
    expect(args[0]).toBe(FAKE_ULID)
    expect(args[1]).toBe(SAMPLE_POST_TEXT)
    expect(args[2]).toBe(SCHEDULED_AT)
    expect(args[3]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('propagates db prepare throw', async () => {
    mockPrepare.mockImplementationOnce(() => {
      throw new Error('database is locked')
    })

    await expect(
      executeSchedulePost({
        text: SAMPLE_POST_TEXT,
        scheduled_at: SCHEDULED_AT,
      }),
    ).rejects.toThrow(/database is locked/)
  })

  it('propagates db run throw', async () => {
    mockRun.mockImplementationOnce(() => {
      throw new Error('UNIQUE constraint failed')
    })

    await expect(
      executeSchedulePost({
        text: SAMPLE_POST_TEXT,
        scheduled_at: SCHEDULED_AT,
      }),
    ).rejects.toThrow(/UNIQUE constraint failed/)
  })
})
