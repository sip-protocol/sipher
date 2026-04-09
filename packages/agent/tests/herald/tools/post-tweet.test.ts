import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── twitter-api-v2 mock ───────────────────────────────────────────────────────
// Stable mock must be declared before any module imports resolve

const mockTweet = vi.fn()
const mockReply = vi.fn()
const mockLike = vi.fn()
const mockNewDmConversation = vi.fn()

vi.mock('twitter-api-v2', () => ({
  TwitterApi: vi.fn().mockImplementation(() => ({
    v2: {
      tweet: mockTweet,
      reply: mockReply,
      like: mockLike,
      sendDmToParticipant: mockNewDmConversation,
    },
  })),
}))

// ─── Imports after mock registration ─────────────────────────────────────────

import { getDb, closeDb } from '../../../src/db.js'
import {
  postTweetTool,
  executePostTweet,
  publishTweet,
} from '../../../src/herald/tools/post-tweet.js'
import {
  replyTweetTool,
  executeReplyTweet,
} from '../../../src/herald/tools/reply-tweet.js'
import {
  likeTweetTool,
  executeLikeTweet,
} from '../../../src/herald/tools/like-tweet.js'
import {
  sendDMTool,
  executeSendDM,
} from '../../../src/herald/tools/send-dm.js'
import {
  schedulePostTool,
  executeSchedulePost,
} from '../../../src/herald/tools/schedule-post.js'

// ─── DB + env isolation ────────────────────────────────────────────────────────

beforeEach(() => {
  closeDb()
  process.env.NODE_ENV = 'test'
  delete process.env.DB_PATH
  delete process.env.HERALD_MONTHLY_BUDGET
  getDb()

  process.env.X_BEARER_TOKEN = 'test-bearer-token'
  process.env.X_CONSUMER_KEY = 'test-consumer-key'
  process.env.X_CONSUMER_SECRET = 'test-consumer-secret'
  process.env.X_ACCESS_TOKEN = 'test-access-token'
  process.env.X_ACCESS_SECRET = 'test-access-secret'
  process.env.HERALD_X_USER_ID = '12345678'

  // Default happy-path responses
  mockTweet.mockResolvedValue({ data: { id: 'tweet_001', text: 'test' } })
  mockReply.mockResolvedValue({ data: { id: 'reply_001', text: 'test reply' } })
  mockLike.mockResolvedValue({ data: { liked: true } })
  mockNewDmConversation.mockResolvedValue({ dm_event_id: 'dm_event_001', dm_conversation_id: 'conv_001' })
})

afterEach(() => {
  closeDb()
  vi.clearAllMocks()
  delete process.env.X_BEARER_TOKEN
  delete process.env.X_CONSUMER_KEY
  delete process.env.X_CONSUMER_SECRET
  delete process.env.X_ACCESS_TOKEN
  delete process.env.X_ACCESS_SECRET
  delete process.env.HERALD_X_USER_ID
  delete process.env.HERALD_MONTHLY_BUDGET
})

// ─── postTweetTool definition ─────────────────────────────────────────────────

describe('postTweetTool definition', () => {
  it('has correct name', () => {
    expect(postTweetTool.name).toBe('postTweet')
  })

  it('has a description', () => {
    expect(postTweetTool.description).toBeTruthy()
    expect(postTweetTool.description.length).toBeGreaterThan(10)
  })

  it('requires text parameter', () => {
    expect((postTweetTool.parameters as any).required).toContain('text')
  })

  it('defines text property', () => {
    const props = (postTweetTool.parameters as any).properties
    expect(props).toHaveProperty('text')
  })
})

// ─── executePostTweet — queue behavior ────────────────────────────────────────

describe('executePostTweet', () => {
  it('does NOT call X API', async () => {
    await executePostTweet({ text: 'Hello world!' })
    expect(mockTweet).not.toHaveBeenCalled()
  })

  it('inserts a row into herald_queue with status=pending', async () => {
    await executePostTweet({ text: 'SIP Protocol is live on mainnet!' })
    const conn = getDb()
    const rows = conn.prepare("SELECT * FROM herald_queue WHERE status = 'pending'").all() as Array<{
      id: string; type: string; content: string; status: string; scheduled_at: string | null
    }>
    expect(rows.length).toBeGreaterThanOrEqual(1)
    const row = rows.find(r => r.content === 'SIP Protocol is live on mainnet!')
    expect(row).toBeDefined()
    expect(row?.status).toBe('pending')
    expect(row?.type).toBe('post')
    expect(row?.scheduled_at).toBeNull()
  })

  it('returns the queued item id', async () => {
    const result = await executePostTweet({ text: 'Test post' })
    expect(result.queued).toBe(true)
    expect(typeof result.id).toBe('string')
    expect(result.id.length).toBeGreaterThan(0)
  })

  it('assigns a unique ULID-style id to each queued item', async () => {
    const r1 = await executePostTweet({ text: 'Post one' })
    const r2 = await executePostTweet({ text: 'Post two' })
    expect(r1.id).not.toBe(r2.id)
  })

  it('throws when text is empty', async () => {
    await expect(executePostTweet({ text: '' })).rejects.toThrow(/text/i)
  })

  it('throws when text exceeds 280 characters', async () => {
    const longText = 'x'.repeat(281)
    await expect(executePostTweet({ text: longText })).rejects.toThrow(/280/i)
  })

  it('stores the exact text in herald_queue content', async () => {
    const text = 'Stealth addresses protect your identity on-chain. 🛡️'
    await executePostTweet({ text })
    const conn = getDb()
    const row = conn.prepare("SELECT * FROM herald_queue WHERE content = ?").get(text) as { content: string } | undefined
    expect(row).toBeDefined()
    expect(row?.content).toBe(text)
  })
})

// ─── publishTweet — actual X API call ────────────────────────────────────────

describe('publishTweet', () => {
  it('calls client.v2.tweet with the given text', async () => {
    await publishTweet('Go live!')
    expect(mockTweet).toHaveBeenCalledWith('Go live!')
  })

  it('returns the tweet id on success', async () => {
    const result = await publishTweet('Mainnet is live!')
    expect(result.tweet_id).toBe('tweet_001')
  })

  it('tracks content_create cost', async () => {
    await publishTweet('Cost tracking test')
    // Cost logged — verify via DB (cost_log table)
    const conn = getDb()
    const row = conn.prepare("SELECT * FROM cost_log WHERE operation = 'content_create' LIMIT 1").get() as { operation: string } | undefined
    expect(row).toBeDefined()
    expect(row?.operation).toBe('content_create')
  })

  it('re-throws X API errors', async () => {
    mockTweet.mockRejectedValue(new Error('403 Forbidden'))
    await expect(publishTweet('Will fail')).rejects.toThrow('403 Forbidden')
  })
})

// ─── schedulePostTool definition ──────────────────────────────────────────────

describe('schedulePostTool definition', () => {
  it('has correct name', () => {
    expect(schedulePostTool.name).toBe('schedulePost')
  })

  it('has a description', () => {
    expect(schedulePostTool.description).toBeTruthy()
    expect(schedulePostTool.description.length).toBeGreaterThan(10)
  })

  it('requires text and scheduled_at parameters', () => {
    const required = (schedulePostTool.parameters as any).required
    expect(required).toContain('text')
    expect(required).toContain('scheduled_at')
  })
})

// ─── executeSchedulePost ──────────────────────────────────────────────────────

describe('executeSchedulePost', () => {
  it('does NOT call X API', async () => {
    await executeSchedulePost({ text: 'Scheduled post', scheduled_at: '2026-05-01T09:00:00Z' })
    expect(mockTweet).not.toHaveBeenCalled()
  })

  it('inserts row into herald_queue with scheduled_at', async () => {
    const scheduledAt = '2026-05-01T09:00:00Z'
    await executeSchedulePost({ text: 'Future announcement', scheduled_at: scheduledAt })
    const conn = getDb()
    const row = conn.prepare("SELECT * FROM herald_queue WHERE content = 'Future announcement'").get() as {
      scheduled_at: string; status: string; type: string
    } | undefined
    expect(row).toBeDefined()
    expect(row?.scheduled_at).toBe(scheduledAt)
    expect(row?.status).toBe('pending')
    expect(row?.type).toBe('post')
  })

  it('returns queued=true with the row id', async () => {
    const result = await executeSchedulePost({ text: 'Sched', scheduled_at: '2026-06-01T12:00:00Z' })
    expect(result.queued).toBe(true)
    expect(typeof result.id).toBe('string')
    expect(result.id.length).toBeGreaterThan(0)
  })

  it('throws when text is empty', async () => {
    await expect(executeSchedulePost({ text: '', scheduled_at: '2026-05-01T09:00:00Z' })).rejects.toThrow(/text/i)
  })

  it('throws when scheduled_at is missing', async () => {
    await expect(executeSchedulePost({ text: 'No date', scheduled_at: '' })).rejects.toThrow(/scheduled_at/i)
  })
})

// ─── replyTweetTool definition ───────────────────────────────────────────────

describe('replyTweetTool definition', () => {
  it('has correct name', () => {
    expect(replyTweetTool.name).toBe('replyTweet')
  })

  it('has a description', () => {
    expect(replyTweetTool.description).toBeTruthy()
    expect(replyTweetTool.description.length).toBeGreaterThan(10)
  })

  it('requires tweet_id and text parameters', () => {
    const required = (replyTweetTool.parameters as any).required
    expect(required).toContain('tweet_id')
    expect(required).toContain('text')
  })
})

// ─── executeReplyTweet ────────────────────────────────────────────────────────

describe('executeReplyTweet', () => {
  it('calls client.v2.reply with text and tweet_id', async () => {
    await executeReplyTweet({ tweet_id: '555', text: 'Great point!' })
    expect(mockReply).toHaveBeenCalledWith('Great point!', '555')
  })

  it('returns tweet_id on success', async () => {
    const result = await executeReplyTweet({ tweet_id: '555', text: 'Hello!' })
    expect(result.tweet_id).toBe('reply_001')
  })

  it('tracks content_create cost', async () => {
    await executeReplyTweet({ tweet_id: '888', text: 'Test reply' })
    const conn = getDb()
    const rows = conn.prepare("SELECT * FROM cost_log WHERE operation = 'content_create'").all() as Array<{ operation: string }>
    expect(rows.length).toBeGreaterThanOrEqual(1)
  })

  it('throws when tweet_id is empty', async () => {
    await expect(executeReplyTweet({ tweet_id: '', text: 'Reply' })).rejects.toThrow(/tweet_id/i)
  })

  it('throws when text is empty', async () => {
    await expect(executeReplyTweet({ tweet_id: '555', text: '' })).rejects.toThrow(/text/i)
  })
})

// ─── likeTweetTool definition ─────────────────────────────────────────────────

describe('likeTweetTool definition', () => {
  it('has correct name', () => {
    expect(likeTweetTool.name).toBe('likeTweet')
  })

  it('has a description', () => {
    expect(likeTweetTool.description).toBeTruthy()
    expect(likeTweetTool.description.length).toBeGreaterThan(10)
  })

  it('requires tweet_id parameter', () => {
    expect((likeTweetTool.parameters as any).required).toContain('tweet_id')
  })
})

// ─── executeLikeTweet ─────────────────────────────────────────────────────────

describe('executeLikeTweet', () => {
  it('calls client.v2.like with userId and tweet_id', async () => {
    await executeLikeTweet({ tweet_id: '999' })
    expect(mockLike).toHaveBeenCalledWith('12345678', '999')
  })

  it('returns liked=true on success', async () => {
    const result = await executeLikeTweet({ tweet_id: '999' })
    expect(result.liked).toBe(true)
  })

  it('tracks user_interaction cost', async () => {
    await executeLikeTweet({ tweet_id: '777' })
    const conn = getDb()
    const rows = conn.prepare("SELECT * FROM cost_log WHERE operation = 'user_interaction'").all() as Array<{ operation: string }>
    expect(rows.length).toBeGreaterThanOrEqual(1)
  })

  it('throws when tweet_id is empty', async () => {
    await expect(executeLikeTweet({ tweet_id: '' })).rejects.toThrow(/tweet_id/i)
  })
})

// ─── sendDMTool definition ────────────────────────────────────────────────────

describe('sendDMTool definition', () => {
  it('has correct name', () => {
    expect(sendDMTool.name).toBe('sendDM')
  })

  it('has a description', () => {
    expect(sendDMTool.description).toBeTruthy()
    expect(sendDMTool.description.length).toBeGreaterThan(10)
  })

  it('requires user_id and text parameters', () => {
    const required = (sendDMTool.parameters as any).required
    expect(required).toContain('user_id')
    expect(required).toContain('text')
  })
})

// ─── executeSendDM ────────────────────────────────────────────────────────────

describe('executeSendDM', () => {
  it('calls DM API with user_id and text', async () => {
    await executeSendDM({ user_id: 'user_abc', text: 'Hey there!' })
    expect(mockNewDmConversation).toHaveBeenCalledWith(
      'user_abc',
      expect.objectContaining({ text: 'Hey there!' }),
    )
  })

  it('returns sent=true on success', async () => {
    const result = await executeSendDM({ user_id: 'user_abc', text: 'Hello!' })
    expect(result.sent).toBe(true)
  })

  it('returns the dm event id', async () => {
    const result = await executeSendDM({ user_id: 'user_abc', text: 'Hello!' })
    expect(result.dm_id).toBe('dm_event_001')
  })

  it('tracks dm_create cost', async () => {
    await executeSendDM({ user_id: 'user_xyz', text: 'DM cost test' })
    const conn = getDb()
    const rows = conn.prepare("SELECT * FROM cost_log WHERE operation = 'dm_create'").all() as Array<{ operation: string }>
    expect(rows.length).toBeGreaterThanOrEqual(1)
  })

  it('emits herald:dm event on the guardianBus', async () => {
    const { guardianBus } = await import('../../../src/coordination/event-bus.js')
    const handler = vi.fn()
    guardianBus.on('herald:dm', handler)
    await executeSendDM({ user_id: 'user_event', text: 'Event test' })
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'herald:dm',
        source: 'herald',
        data: expect.objectContaining({ user_id: 'user_event' }),
      }),
    )
    guardianBus.off('herald:dm', handler)
  })

  it('throws when user_id is empty', async () => {
    await expect(executeSendDM({ user_id: '', text: 'Hi' })).rejects.toThrow(/user_id/i)
  })

  it('throws when text is empty', async () => {
    await expect(executeSendDM({ user_id: 'user_abc', text: '' })).rejects.toThrow(/text/i)
  })
})
