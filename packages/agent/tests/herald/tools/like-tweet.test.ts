// packages/agent/tests/herald/tools/like-tweet.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VALID_TWEET_ID, HERALD_USER_ID } from '../../fixtures/herald-tool-mocks.js'

const {
  mockGetWriteClient,
  mockGetHeraldUserId,
  mockCanMakeCall,
  mockTrackXApiCost,
  mockLike,
} = vi.hoisted(() => ({
  mockGetWriteClient: vi.fn(),
  mockGetHeraldUserId: vi.fn(),
  mockCanMakeCall: vi.fn(),
  mockTrackXApiCost: vi.fn(),
  mockLike: vi.fn(),
}))

vi.mock('../../../src/herald/x-client.js', () => ({
  getWriteClient: mockGetWriteClient,
  getHeraldUserId: mockGetHeraldUserId,
}))

vi.mock('../../../src/herald/budget.js', () => ({
  canMakeCall: mockCanMakeCall,
  trackXApiCost: mockTrackXApiCost,
}))

import {
  likeTweetTool,
  executeLikeTweet,
} from '../../../src/herald/tools/like-tweet.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCanMakeCall.mockReturnValue(true)
  mockGetHeraldUserId.mockReturnValue(HERALD_USER_ID)
  mockGetWriteClient.mockReturnValue({ v2: { like: mockLike } })
  mockLike.mockResolvedValue({ data: { liked: true } })
})

describe('likeTweetTool definition', () => {
  it('has correct name', () => {
    expect(likeTweetTool.name).toBe('likeTweet')
  })

  it('declares required tweet_id field', () => {
    const schema = likeTweetTool.parameters as { required: string[] }
    expect(schema.required).toEqual(['tweet_id'])
  })

  it('has a non-empty description', () => {
    expect(likeTweetTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeLikeTweet — happy path', () => {
  it('returns { liked: true } when budget gate is open', async () => {
    const r = await executeLikeTweet({ tweet_id: VALID_TWEET_ID })
    expect(r).toEqual({ liked: true })
  })
})

describe('executeLikeTweet — branches', () => {
  it('returns { liked: false } silently when budget gate blocks user_interaction', async () => {
    mockCanMakeCall.mockReturnValueOnce(false)

    const r = await executeLikeTweet({ tweet_id: VALID_TWEET_ID })

    expect(r).toEqual({ liked: false })
    expect(mockLike).not.toHaveBeenCalled()
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })

  it('throws when tweet_id is empty string', async () => {
    await expect(
      executeLikeTweet({ tweet_id: '' }),
    ).rejects.toThrow(/tweet_id is required/i)
    expect(mockLike).not.toHaveBeenCalled()
  })

  it('throws when tweet_id is whitespace-only', async () => {
    await expect(
      executeLikeTweet({ tweet_id: '   ' }),
    ).rejects.toThrow(/tweet_id is required/i)
    expect(mockLike).not.toHaveBeenCalled()
  })
})

describe('executeLikeTweet — service interaction', () => {
  it('calls canMakeCall with "user_interaction"', async () => {
    await executeLikeTweet({ tweet_id: VALID_TWEET_ID })
    expect(mockCanMakeCall).toHaveBeenCalledWith('user_interaction')
  })

  it('calls v2.like with HERALD user id and supplied tweet_id', async () => {
    await executeLikeTweet({ tweet_id: VALID_TWEET_ID })

    expect(mockLike).toHaveBeenCalledTimes(1)
    expect(mockLike).toHaveBeenCalledWith(HERALD_USER_ID, VALID_TWEET_ID)
  })

  it('tracks user_interaction cost with resource count 1', async () => {
    await executeLikeTweet({ tweet_id: VALID_TWEET_ID })
    expect(mockTrackXApiCost).toHaveBeenCalledWith('user_interaction', 1)
  })

  it('propagates v2.like throw (rate limit / network / auth)', async () => {
    mockLike.mockRejectedValueOnce(new Error('429 rate limit'))

    await expect(
      executeLikeTweet({ tweet_id: VALID_TWEET_ID }),
    ).rejects.toThrow(/429 rate limit/)
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })
})
