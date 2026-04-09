import type { Tool } from '@mariozechner/pi-ai'
import { getWriteClient } from '../x-client.js'
import { trackXApiCost } from '../budget.js'

// ─────────────────────────────────────────────────────────────────────────────
// replyTweet — AUTO. Posts a reply to an existing tweet directly via X API.
// ─────────────────────────────────────────────────────────────────────────────

export interface ReplyTweetParams {
  tweet_id: string
  text: string
}

export interface ReplyTweetResult {
  tweet_id: string
}

export const replyTweetTool: Tool = {
  name: 'replyTweet',
  description: 'Reply to an existing tweet on behalf of @SipProtocol. Posts immediately — use for timely responses to mentions, questions, or community engagement.',
  parameters: {
    type: 'object',
    properties: {
      tweet_id: {
        type: 'string',
        description: 'The ID of the tweet to reply to',
      },
      text: {
        type: 'string',
        description: 'Reply text (max 280 chars)',
      },
    },
    required: ['tweet_id', 'text'],
  } as any,
}

export async function executeReplyTweet(params: ReplyTweetParams): Promise<ReplyTweetResult> {
  if (!params.tweet_id || params.tweet_id.trim().length === 0) {
    throw new Error('tweet_id is required')
  }
  if (!params.text || params.text.trim().length === 0) {
    throw new Error('text is required')
  }

  const client = getWriteClient()
  const response = await client.v2.reply(params.text, params.tweet_id)
  const tweetId = response.data.id

  trackXApiCost('content_create', 1)

  return { tweet_id: tweetId }
}
