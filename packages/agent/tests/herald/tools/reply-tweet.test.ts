// packages/agent/tests/herald/tools/reply-tweet.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  VALID_TWEET_ID,
  VALID_REPLY_TWEET_ID,
  makeXReply,
  type ToolSchemaLike,
} from '../../fixtures/herald-tool-mocks.js'

const {
  mockGetWriteClient,
  mockCanMakeCall,
  mockTrackXApiCost,
  mockReply,
} = vi.hoisted(() => ({
  mockGetWriteClient: vi.fn(),
  mockCanMakeCall: vi.fn(),
  mockTrackXApiCost: vi.fn(),
  mockReply: vi.fn(),
}))

vi.mock('../../../src/herald/x-client.js', () => ({
  getWriteClient: mockGetWriteClient,
}))

vi.mock('../../../src/herald/budget.js', () => ({
  canMakeCall: mockCanMakeCall,
  trackXApiCost: mockTrackXApiCost,
}))

import {
  replyTweetTool,
  executeReplyTweet,
} from '../../../src/herald/tools/reply-tweet.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCanMakeCall.mockReturnValue(true)
  mockGetWriteClient.mockReturnValue({ v2: { reply: mockReply } })
  mockReply.mockResolvedValue({ data: makeXReply() })
})

describe('replyTweetTool definition', () => {
  it('has correct name', () => {
    expect(replyTweetTool.name).toBe('replyTweet')
  })

  it('declares required tweet_id and text fields', () => {
    const schema = replyTweetTool.parameters as ToolSchemaLike
    expect(schema.required).toEqual(['tweet_id', 'text'])
  })

  it('has a non-empty description', () => {
    expect(replyTweetTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeReplyTweet — happy path', () => {
  it('returns { tweet_id } from v2.reply response', async () => {
    const r = await executeReplyTweet({ tweet_id: VALID_TWEET_ID, text: 'thanks!' })
    expect(r).toEqual({ tweet_id: VALID_REPLY_TWEET_ID })
  })
})

describe('executeReplyTweet — branches', () => {
  it('throws when budget gate blocks content_create (THROWS, not silent)', async () => {
    mockCanMakeCall.mockReturnValueOnce(false)

    await expect(
      executeReplyTweet({ tweet_id: VALID_TWEET_ID, text: 'reply' }),
    ).rejects.toThrow(/budget gate.*content_create blocked/i)

    expect(mockReply).not.toHaveBeenCalled()
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })

  it('throws gate error (not validation error) when budget blocked AND fields are empty (gate runs first)', async () => {
    mockCanMakeCall.mockReturnValueOnce(false)

    await expect(
      executeReplyTweet({ tweet_id: '', text: '' }),
    ).rejects.toThrow(/budget gate.*content_create blocked/i)

    expect(mockReply).not.toHaveBeenCalled()
  })

  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
    ['tabs', '\t\t'],
  ])('throws when tweet_id is %s', async (_label, tweet_id) => {
    await expect(
      executeReplyTweet({ tweet_id, text: 'reply' }),
    ).rejects.toThrow(/tweet_id is required/i)
    expect(mockReply).not.toHaveBeenCalled()
  })

  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
    ['tabs', '\t\t'],
  ])('throws when text is %s', async (_label, text) => {
    await expect(
      executeReplyTweet({ tweet_id: VALID_TWEET_ID, text }),
    ).rejects.toThrow(/text is required/i)
    expect(mockReply).not.toHaveBeenCalled()
  })
})

describe('executeReplyTweet — service interaction', () => {
  it('calls canMakeCall with "content_create"', async () => {
    await executeReplyTweet({ tweet_id: VALID_TWEET_ID, text: 'reply' })
    expect(mockCanMakeCall).toHaveBeenCalledWith('content_create')
  })

  it('calls v2.reply with text and tweet_id in correct argument order', async () => {
    await executeReplyTweet({ tweet_id: VALID_TWEET_ID, text: 'thanks for the question' })

    expect(mockReply).toHaveBeenCalledTimes(1)
    expect(mockReply).toHaveBeenCalledWith('thanks for the question', VALID_TWEET_ID)
  })

  it('tracks content_create cost with resource count 1', async () => {
    await executeReplyTweet({ tweet_id: VALID_TWEET_ID, text: 'reply' })
    expect(mockTrackXApiCost).toHaveBeenCalledWith('content_create', 1)
  })

  it('propagates v2.reply throw (rate limit / network / auth)', async () => {
    mockReply.mockRejectedValueOnce(new Error('429 rate limit'))

    await expect(
      executeReplyTweet({ tweet_id: VALID_TWEET_ID, text: 'reply' }),
    ).rejects.toThrow(/429 rate limit/)
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })
})
