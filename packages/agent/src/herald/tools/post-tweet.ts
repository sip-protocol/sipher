import type { Tool } from '@mariozechner/pi-ai'
import { getWriteClient } from '../x-client.js'
import { trackXApiCost, canMakeCall } from '../budget.js'
import { getDb } from '../../db.js'
import { ulid } from 'ulid'
import { guardianBus } from '../../coordination/event-bus.js'

// ─────────────────────────────────────────────────────────────────────────────
// postTweet — QUEUED post. Inserts into herald_queue, never calls X API.
// publishTweet — ACTUALLY posts to X. Called by the approval system only.
// ─────────────────────────────────────────────────────────────────────────────

export interface PostTweetParams {
  text: string
}

export interface PostTweetResult {
  queued: boolean
  id: string
}

export interface PublishTweetResult {
  tweet_id: string
}

export const postTweetTool: Tool = {
  name: 'postTweet',
  description: 'Queue a new post for @SipProtocol. Posts go through approval queue — not posted immediately. Use schedulePost if you need a specific future time.',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Tweet text (max 280 chars)',
      },
    },
    required: ['text'],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON Schema ↔ TypeBox TSchema bridge
  } as any,
}

/**
 * Queue a tweet for human approval. Does NOT call the X API.
 * Emits `herald:approval-needed` so the admin dashboard can surface it.
 */
export async function executePostTweet(params: PostTweetParams): Promise<PostTweetResult> {
  if (!params.text || params.text.trim().length === 0) {
    throw new Error('text is required')
  }
  if (params.text.length > 280) {
    throw new Error('text exceeds 280 character limit')
  }

  const id = ulid()
  const now = new Date().toISOString()
  const conn = getDb()

  conn.prepare(`
    INSERT INTO herald_queue (id, type, content, reply_to, scheduled_at, status, created_at)
    VALUES (?, 'post', ?, null, null, 'pending', ?)
  `).run(id, params.text, now)

  guardianBus.emit({
    source: 'herald',
    type: 'herald:approval-needed',
    level: 'important',
    data: { id, text: params.text },
    timestamp: now,
  })

  return { queued: true, id }
}

/**
 * Actually publish a tweet to X. Called by the approval workflow after a human
 * approves a queued item — NOT called by the agent directly.
 */
export async function publishTweet(text: string): Promise<PublishTweetResult> {
  if (!canMakeCall('content_create')) {
    throw new Error('budget gate: content_create blocked')
  }

  const client = getWriteClient()
  const response = await client.v2.tweet(text)
  const tweetId = response.data.id

  trackXApiCost('content_create', 1)

  return { tweet_id: tweetId }
}
