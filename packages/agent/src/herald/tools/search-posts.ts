import type { Tool } from '@mariozechner/pi-ai'
import { getReadClient } from '../x-client.js'
import { trackXApiCost, canMakeCall } from '../budget.js'

// ─────────────────────────────────────────────────────────────────────────────
// searchPosts — Search X for posts matching a query
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchPostsParams {
  query: string
  max_results?: number
}

export interface SearchPostsResult {
  posts: Array<{
    id: string
    text: string
    author_id?: string
    created_at?: string
    public_metrics?: {
      like_count?: number
      retweet_count?: number
      reply_count?: number
    }
  }>
  cost: number
}

export const searchPostsTool: Tool = {
  name: 'searchPosts',
  description: 'Search X for recent posts matching a query string. Useful for monitoring SIP Protocol mentions, competitor activity, or privacy-related conversations.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'X search query string (e.g. "SIP Protocol privacy" or "#stealth")',
      },
      max_results: {
        type: 'number',
        description: 'Max posts to return (10–100, default 10)',
      },
    },
    required: ['query'],
  } as any,
}

export async function executeSearchPosts(params: SearchPostsParams): Promise<SearchPostsResult> {
  if (!params.query || params.query.trim().length === 0) {
    throw new Error('Search query is required')
  }

  if (!canMakeCall('search_read')) {
    return { posts: [], cost: 0 }
  }

  const maxResults = params.max_results ?? 10
  const clampedMax = Math.max(10, Math.min(100, maxResults))

  const client = getReadClient()
  const response = await client.v2.search(params.query, {
    max_results: clampedMax,
    'tweet.fields': ['author_id', 'created_at', 'text', 'public_metrics'],
  })

  const tweets = response.data?.data ?? []

  const resourceCount = tweets.length || 1
  trackXApiCost('search_read', resourceCount)

  return {
    posts: tweets.map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      author_id: tweet.author_id,
      created_at: tweet.created_at,
      public_metrics: tweet.public_metrics,
    })),
    cost: resourceCount * 0.005,
  }
}
