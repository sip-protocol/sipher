import type { Tool } from '@mariozechner/pi-ai'
import { getWriteClient, getHeraldUserId } from '../x-client.js'
import { trackXApiCost, canMakeCall } from '../budget.js'

// ─────────────────────────────────────────────────────────────────────────────
// likeTweet — AUTO. Likes a tweet from the @SipProtocol account directly.
// ─────────────────────────────────────────────────────────────────────────────

export interface LikeTweetParams {
  tweet_id: string
}

export interface LikeTweetResult {
  liked: boolean
}

export const likeTweetTool: Tool = {
  name: 'likeTweet',
  description: 'Like a tweet from the @SipProtocol account. Posts immediately — use for engaging with community posts, partner content, or relevant privacy discussions.',
  parameters: {
    type: 'object',
    properties: {
      tweet_id: {
        type: 'string',
        description: 'The ID of the tweet to like',
      },
    },
    required: ['tweet_id'],
  } as Tool['parameters'],
}

export async function executeLikeTweet(params: LikeTweetParams): Promise<LikeTweetResult> {
  if (!canMakeCall('user_interaction')) {
    return { liked: false }
  }

  if (!params.tweet_id || params.tweet_id.trim().length === 0) {
    throw new Error('tweet_id is required')
  }

  const userId = getHeraldUserId()
  const client = getWriteClient()
  await client.v2.like(userId, params.tweet_id)

  trackXApiCost('user_interaction', 1)

  return { liked: true }
}
