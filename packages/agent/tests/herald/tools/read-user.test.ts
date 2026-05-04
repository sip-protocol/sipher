// packages/agent/tests/herald/tools/read-user.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  VALID_USERNAME,
  makeXUser,
  type ToolSchemaLike,
} from '../../fixtures/herald-tool-mocks.js'

const {
  mockGetReadClient,
  mockCanMakeCall,
  mockTrackXApiCost,
  mockUserByUsername,
} = vi.hoisted(() => ({
  mockGetReadClient: vi.fn(),
  mockCanMakeCall: vi.fn(),
  mockTrackXApiCost: vi.fn(),
  mockUserByUsername: vi.fn(),
}))

vi.mock('../../../src/herald/x-client.js', () => ({
  getReadClient: mockGetReadClient,
}))

vi.mock('../../../src/herald/budget.js', () => ({
  canMakeCall: mockCanMakeCall,
  trackXApiCost: mockTrackXApiCost,
}))

import {
  readUserProfileTool,
  executeReadUserProfile,
} from '../../../src/herald/tools/read-user.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCanMakeCall.mockReturnValue(true)
  mockGetReadClient.mockReturnValue({ v2: { userByUsername: mockUserByUsername } })
  mockUserByUsername.mockResolvedValue({ data: makeXUser() })
})

describe('readUserProfileTool definition', () => {
  it('has correct name', () => {
    expect(readUserProfileTool.name).toBe('readUserProfile')
  })

  it('declares required username field', () => {
    const schema = readUserProfileTool.parameters as ToolSchemaLike
    expect(schema.required).toEqual(['username'])
  })

  it('has a non-empty description', () => {
    expect(readUserProfileTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeReadUserProfile — happy path', () => {
  it('returns user shape and cost 0.01 when API returns data', async () => {
    const r = await executeReadUserProfile({ username: VALID_USERNAME })

    expect(r.cost).toBe(0.01)
    expect(r.user?.username).toBe(VALID_USERNAME)
    expect(r.user?.id).toBeDefined()
    expect(r.user?.name).toBeDefined()
  })

  it('output shape includes id, name, username, description, verified, public_metrics, created_at', async () => {
    const r = await executeReadUserProfile({ username: VALID_USERNAME })

    expect(r.user).not.toBeNull()
    const keys = Object.keys(r.user!).sort()
    expect(keys).toEqual([
      'created_at',
      'description',
      'id',
      'name',
      'public_metrics',
      'username',
      'verified',
    ])
  })
})

describe('executeReadUserProfile — branches', () => {
  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
    ['tabs', '\t\t'],
  ])('throws when username is %s', async (_label, username) => {
    await expect(
      executeReadUserProfile({ username }),
    ).rejects.toThrow(/username is required/i)
    expect(mockUserByUsername).not.toHaveBeenCalled()
  })

  it('strips leading @ before calling API', async () => {
    await executeReadUserProfile({ username: '@SipProtocol' })

    expect(mockUserByUsername).toHaveBeenCalledTimes(1)
    expect(mockUserByUsername.mock.calls[0][0]).toBe('SipProtocol')
  })

  it('returns { user: null, cost: 0 } when budget gate blocks user_read', async () => {
    mockCanMakeCall.mockReturnValueOnce(false)

    const r = await executeReadUserProfile({ username: VALID_USERNAME })

    expect(r).toEqual({ user: null, cost: 0 })
    expect(mockUserByUsername).not.toHaveBeenCalled()
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })

  it('returns { user: null, cost: 0.01 } when API response.data is missing', async () => {
    mockUserByUsername.mockResolvedValueOnce({ data: null })

    const r = await executeReadUserProfile({ username: VALID_USERNAME })

    expect(r.user).toBeNull()
    expect(r.cost).toBe(0.01)
    expect(mockTrackXApiCost).toHaveBeenCalledWith('user_read', 1)
  })
})

describe('executeReadUserProfile — service interaction', () => {
  it('calls canMakeCall with "user_read"', async () => {
    await executeReadUserProfile({ username: VALID_USERNAME })
    expect(mockCanMakeCall).toHaveBeenCalledWith('user_read')
  })

  it('calls v2.userByUsername with stripped username and full user.fields list', async () => {
    await executeReadUserProfile({ username: VALID_USERNAME })

    expect(mockUserByUsername).toHaveBeenCalledTimes(1)
    expect(mockUserByUsername).toHaveBeenCalledWith(VALID_USERNAME, {
      'user.fields': [
        'id',
        'name',
        'username',
        'description',
        'verified',
        'public_metrics',
        'created_at',
      ],
    })
  })

  it('tracks user_read cost with resource count 1', async () => {
    await executeReadUserProfile({ username: VALID_USERNAME })
    expect(mockTrackXApiCost).toHaveBeenCalledWith('user_read', 1)
  })

  it('propagates v2.userByUsername throw (rate limit / network / auth)', async () => {
    mockUserByUsername.mockRejectedValueOnce(new Error('429 rate limit'))

    await expect(
      executeReadUserProfile({ username: VALID_USERNAME }),
    ).rejects.toThrow(/429 rate limit/)
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })
})
