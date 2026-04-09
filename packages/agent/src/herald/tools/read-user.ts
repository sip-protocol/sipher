import type { Tool } from '@mariozechner/pi-ai'
import { getReadClient } from '../x-client.js'
import { trackXApiCost, canMakeCall } from '../budget.js'

// ─────────────────────────────────────────────────────────────────────────────
// readUserProfile — Fetch a user's public profile by username
// ─────────────────────────────────────────────────────────────────────────────

export interface ReadUserProfileParams {
  username: string
}

export interface ReadUserProfileResult {
  user: {
    id: string
    name: string
    username: string
    description?: string
    verified?: boolean
    public_metrics?: {
      followers_count?: number
      following_count?: number
      tweet_count?: number
      listed_count?: number
    }
    created_at?: string
  } | null
  cost: number
}

export const readUserProfileTool: Tool = {
  name: 'readUserProfile',
  description: 'Read a public X user profile by username. Useful for verifying accounts before engaging, checking follower counts, or investigating who mentioned @SipProtocol.',
  parameters: {
    type: 'object',
    properties: {
      username: {
        type: 'string',
        description: 'X username without the @ prefix (e.g. "SipProtocol")',
      },
    },
    required: ['username'],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON Schema ↔ TypeBox TSchema bridge
  } as any,
}

export async function executeReadUserProfile(params: ReadUserProfileParams): Promise<ReadUserProfileResult> {
  if (!params.username || params.username.trim().length === 0) {
    throw new Error('Username is required')
  }

  // Strip leading @ if provided
  const username = params.username.replace(/^@/, '').trim()

  if (!canMakeCall('user_read')) {
    return { user: null, cost: 0 }
  }

  const client = getReadClient()
  const response = await client.v2.userByUsername(username, {
    'user.fields': ['id', 'name', 'username', 'description', 'verified', 'public_metrics', 'created_at'],
  })

  const raw = response.data

  trackXApiCost('user_read', 1)

  if (!raw) {
    return { user: null, cost: 0.01 }
  }

  return {
    user: {
      id: raw.id,
      name: raw.name,
      username: raw.username,
      description: raw.description,
      verified: (raw as any).verified,
      public_metrics: raw.public_metrics,
      created_at: (raw as any).created_at,
    },
    cost: 0.01,
  }
}
