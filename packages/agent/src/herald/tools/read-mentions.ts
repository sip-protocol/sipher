import type { Tool } from '@mariozechner/pi-ai'
import { getReadClient, getHeraldUserId } from '../x-client.js'
import { trackXApiCost, canMakeCall } from '../budget.js'

// ─────────────────────────────────────────────────────────────────────────────
// readMentions — Fetch recent @SipProtocol mentions from X timeline
// ─────────────────────────────────────────────────────────────────────────────

export interface ReadMentionsParams {
  since_id?: string
  max_results?: number
}

export interface ReadMentionsResult {
  mentions: Array<{
    id: string
    text: string
    author_id?: string
    created_at?: string
  }>
  cost: number
}

export const readMentionsTool: Tool = {
  name: 'readMentions',
  description: 'Read recent mentions of @SipProtocol on X. Returns a list of tweets that mention the account, ordered newest first.',
  parameters: {
    type: 'object',
    properties: {
      since_id: {
        type: 'string',
        description: 'Only return mentions newer than this tweet ID (pagination cursor)',
      },
      max_results: {
        type: 'number',
        description: 'Max mentions to fetch (5–100, default 10)',
      },
    },
    required: [],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON Schema ↔ TypeBox TSchema bridge
  } as any,
}

export async function executeReadMentions(params: ReadMentionsParams = {}): Promise<ReadMentionsResult> {
  if (!canMakeCall('mentions_read')) {
    return { mentions: [], cost: 0 }
  }

  const userId = getHeraldUserId()
  const maxResults = params.max_results ?? 10
  const clampedMax = Math.max(5, Math.min(100, maxResults))

  const opts: Record<string, unknown> = {
    max_results: clampedMax,
    'tweet.fields': ['author_id', 'created_at', 'text'],
  }

  if (params.since_id) {
    opts.since_id = params.since_id
  }

  const client = getReadClient()
  const response = await client.v2.userMentionTimeline(userId, opts)

  const mentions = response.data?.data ?? []

  const resourceCount = mentions.length || 1
  trackXApiCost('mentions_read', resourceCount)

  return {
    mentions: mentions.map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      author_id: tweet.author_id,
      created_at: tweet.created_at,
    })),
    cost: resourceCount * 0.005,
  }
}
