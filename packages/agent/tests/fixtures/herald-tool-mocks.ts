// packages/agent/tests/fixtures/herald-tool-mocks.ts
//
// Shared data-shape factories for HERALD tool tests (Phase 5 PR-3).
// Each factory returns the shape that real twitter-api-v2 client methods
// return as observed by HERALD tools (which read .data and .data.data
// projections, NOT the full TwitterApi SDK response envelope).
//
// NOTE: This file does NOT export vi.fn() instances. Vitest hoists vi.mock
// above imports, so vi.fn() instances must be declared per-test-file via
// vi.hoisted to avoid TDZ. This file holds DATA shapes only — call sites
// pass them into mockResolvedValueOnce / mockReturnValueOnce inside tests.

// ─────────────────────────────────────────────────────────────────────────────
// Test constants
// ─────────────────────────────────────────────────────────────────────────────

/** Sample numeric tweet ID (X uses 64-bit ints serialized as strings) */
export const VALID_TWEET_ID = '1786543210987654321'

/** Sample numeric user ID */
export const VALID_USER_ID = '1234567890'

/** Sample HERALD bot user ID (used by likeTweet via getHeraldUserId) */
export const HERALD_USER_ID = '9876543210'

/** Sample username (no @ prefix — tools strip it) */
export const VALID_USERNAME = 'SipProtocol'

/** Sample DM event ID returned by sendDmToParticipant */
export const VALID_DM_EVENT_ID = 'dm_event_42'

/** Sample reply tweet ID returned by .v2.reply */
export const VALID_REPLY_TWEET_ID = '1786543210987654322'

/** Sample post text */
export const SAMPLE_POST_TEXT = 'Privacy is normal.'

/** Sample search query */
export const SAMPLE_SEARCH_QUERY = 'SIP Protocol privacy'

/** Sample DM body */
export const SAMPLE_DM_TEXT = 'Hello from HERALD'

/**
 * Loose schema-shape type for HERALD tool definition tests.
 * Pi AI's `Tool` type uses a generic `object` for parameters, so we cast
 * to this shape when asserting on the schema (e.g., `tool.parameters as ToolSchemaLike`).
 * `required` is optional because some tools have all-optional params.
 */
export type ToolSchemaLike = {
  required?: string[]
  properties?: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// twitter-api-v2 response shapes — partial, matching what HERALD tools read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shape of an entry in `client.v2.search()` response.data.data[].
 * Matches the projection HERALD's searchPosts tool maps over (id, text,
 * author_id, created_at, public_metrics).
 */
export interface XTweetShape {
  id: string
  text: string
  author_id?: string
  created_at?: string
  public_metrics?: {
    like_count?: number
    retweet_count?: number
    reply_count?: number
  }
}

export function makeXTweet(overrides: Partial<XTweetShape> = {}): XTweetShape {
  return {
    id: VALID_TWEET_ID,
    text: 'sample tweet text',
    author_id: VALID_USER_ID,
    created_at: '2026-05-04T00:00:00.000Z',
    public_metrics: {
      like_count: 5,
      retweet_count: 1,
      reply_count: 2,
    },
    ...overrides,
  }
}

/**
 * Shape of `client.v2.userByUsername()` response.data.
 * Matches the projection HERALD's readUserProfile tool reads (id, name,
 * username, description, verified, public_metrics, created_at).
 */
export interface XUserShape {
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
}

export function makeXUser(overrides: Partial<XUserShape> = {}): XUserShape {
  return {
    id: VALID_USER_ID,
    name: 'SIP Protocol',
    username: VALID_USERNAME,
    description: 'Privacy standard for Web3',
    verified: false,
    public_metrics: {
      followers_count: 1000,
      following_count: 100,
      tweet_count: 250,
      listed_count: 10,
    },
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

/**
 * Shape of an entry in `client.v2.listDmEvents()` response.data.data[].
 * The DMEventV2 typings in twitter-api-v2 are incomplete; HERALD's readDMs
 * tool reads these fields directly via a local `DMEventFields` interface.
 */
export interface XDmEventShape {
  id: string
  text?: string
  event_type?: string
  created_at?: string
  sender_id?: string
}

export function makeXDmEvent(overrides: Partial<XDmEventShape> = {}): XDmEventShape {
  return {
    id: VALID_DM_EVENT_ID,
    text: 'incoming dm body',
    event_type: 'MessageCreate',
    created_at: '2026-05-04T00:00:00.000Z',
    sender_id: VALID_USER_ID,
    ...overrides,
  }
}

/**
 * Shape of `client.v2.reply()` response.data — single tweet with id and text.
 * Used by HERALD's replyTweet tool (it reads response.data.id only).
 */
export interface XReplyShape {
  id: string
  text: string
}

export function makeXReply(overrides: Partial<XReplyShape> = {}): XReplyShape {
  return {
    id: VALID_REPLY_TWEET_ID,
    text: 'sample reply body',
    ...overrides,
  }
}

/**
 * Shape of `client.v2.sendDmToParticipant()` response — flat object with
 * `dm_event_id`. Used by HERALD's sendDM tool.
 */
export interface XSendDmResultShape {
  dm_event_id: string
  dm_conversation_id?: string
}

export function makeXSendDmResult(
  overrides: Partial<XSendDmResultShape> = {},
): XSendDmResultShape {
  return {
    dm_event_id: VALID_DM_EVENT_ID,
    dm_conversation_id: 'conv_001',
    ...overrides,
  }
}
