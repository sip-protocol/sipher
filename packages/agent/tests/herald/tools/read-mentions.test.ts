import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── twitter-api-v2 mock ───────────────────────────────────────────────────────
// Must be hoisted — define stable mock before any imports resolve the module

const mockUserMentionTimeline = vi.fn()
const mockSearch = vi.fn()
const mockUserByUsername = vi.fn()
const mockListDmEvents = vi.fn()

vi.mock('twitter-api-v2', () => ({
  TwitterApi: vi.fn().mockImplementation(() => ({
    v2: {
      userMentionTimeline: mockUserMentionTimeline,
      search: mockSearch,
      userByUsername: mockUserByUsername,
      listDmEvents: mockListDmEvents,
    },
  })),
}))

// ─── Imports after mock registration ─────────────────────────────────────────

import { getDb, closeDb, logCost } from '../../../src/db.js'
import {
  readMentionsTool,
  executeReadMentions,
} from '../../../src/herald/tools/read-mentions.js'
import {
  readDMsTool,
  executeReadDMs,
} from '../../../src/herald/tools/read-dms.js'
import {
  searchPostsTool,
  executeSearchPosts,
} from '../../../src/herald/tools/search-posts.js'
import {
  readUserProfileTool,
  executeReadUserProfile,
} from '../../../src/herald/tools/read-user.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MENTION_FIXTURES = [
  { id: '111', text: 'Hello @SipProtocol!', author_id: 'user_a', created_at: '2026-04-09T10:00:00Z' },
  { id: '222', text: 'How does stealth work? @SipProtocol', author_id: 'user_b', created_at: '2026-04-09T09:00:00Z' },
]

const SEARCH_FIXTURES = [
  {
    id: '333',
    text: 'SIP Protocol is great for privacy',
    author_id: 'user_c',
    created_at: '2026-04-09T11:00:00Z',
    public_metrics: { like_count: 5, retweet_count: 2, reply_count: 1 },
  },
]

const USER_FIXTURE = {
  id: '99999',
  name: 'SIP Protocol',
  username: 'SipProtocol',
  description: 'Privacy middleware for Web3',
  verified: false,
  public_metrics: { followers_count: 1200, following_count: 50, tweet_count: 300, listed_count: 10 },
  created_at: '2024-01-01T00:00:00Z',
}

const DM_FIXTURES = [
  { id: 'dm_001', text: 'Hey, how do I deposit?', event_type: 'MessageCreate', created_at: '2026-04-09T08:00:00Z', sender_id: 'user_d' },
]

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

  // Reset API mocks to their default happy-path responses
  mockUserMentionTimeline.mockResolvedValue({ data: { data: MENTION_FIXTURES } })
  mockSearch.mockResolvedValue({ data: { data: SEARCH_FIXTURES } })
  mockUserByUsername.mockResolvedValue({ data: USER_FIXTURE })
  mockListDmEvents.mockResolvedValue({ data: { data: DM_FIXTURES } })
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

// Helper: exhaust budget so gate becomes 'paused'
function exhaustBudget() {
  // $150 total at $0.01/unit = 15000 units
  logCost({ agent: 'herald', provider: 'x_api', operation: 'user_read', cost_usd: 150, resources: 15000 })
}

// ─── readMentionsTool ─────────────────────────────────────────────────────────

describe('readMentionsTool definition', () => {
  it('has correct name', () => {
    expect(readMentionsTool.name).toBe('readMentions')
  })

  it('has a description', () => {
    expect(readMentionsTool.description).toBeTruthy()
    expect(readMentionsTool.description.length).toBeGreaterThan(10)
  })

  it('has no required parameters', () => {
    expect((readMentionsTool.parameters as any).required).toEqual([])
  })

  it('defines since_id and max_results properties', () => {
    const props = (readMentionsTool.parameters as any).properties
    expect(props).toHaveProperty('since_id')
    expect(props).toHaveProperty('max_results')
  })
})

describe('executeReadMentions', () => {
  it('returns mentions array with correct shape', async () => {
    const result = await executeReadMentions()
    expect(result).toHaveProperty('mentions')
    expect(result).toHaveProperty('cost')
    expect(Array.isArray(result.mentions)).toBe(true)
  })

  it('returns populated mentions when API responds', async () => {
    const result = await executeReadMentions()
    expect(result.mentions.length).toBe(2)
    const first = result.mentions[0]
    expect(first.id).toBe('111')
    expect(first.text).toBe('Hello @SipProtocol!')
    expect(first.author_id).toBe('user_a')
  })

  it('includes cost in result', async () => {
    const result = await executeReadMentions()
    expect(result.cost).toBeGreaterThan(0)
  })

  it('forwards since_id option to API', async () => {
    await executeReadMentions({ since_id: '999', max_results: 20 })
    expect(mockUserMentionTimeline).toHaveBeenCalledWith(
      '12345678',
      expect.objectContaining({ since_id: '999', max_results: 20 }),
    )
  })

  it('clamps max_results to minimum of 5', async () => {
    await executeReadMentions({ max_results: 1 })
    expect(mockUserMentionTimeline).toHaveBeenCalledWith(
      '12345678',
      expect.objectContaining({ max_results: 5 }),
    )
  })

  it('clamps max_results to maximum of 100', async () => {
    await executeReadMentions({ max_results: 9999 })
    expect(mockUserMentionTimeline).toHaveBeenCalledWith(
      '12345678',
      expect.objectContaining({ max_results: 100 }),
    )
  })

  it('returns empty mentions when budget gate blocks (paused)', async () => {
    exhaustBudget()
    const result = await executeReadMentions()
    expect(result.mentions).toEqual([])
    expect(result.cost).toBe(0)
    expect(mockUserMentionTimeline).not.toHaveBeenCalled()
  })

  it('handles empty API response gracefully', async () => {
    mockUserMentionTimeline.mockResolvedValue({ data: { data: [] } })
    const result = await executeReadMentions()
    expect(result.mentions).toEqual([])
    expect(result.cost).toBeGreaterThan(0) // still charges minimum 1 unit
  })

  it('handles undefined data in API response', async () => {
    mockUserMentionTimeline.mockResolvedValue({ data: {} })
    const result = await executeReadMentions()
    expect(result.mentions).toEqual([])
  })
})

// ─── readDMsTool ──────────────────────────────────────────────────────────────

describe('readDMsTool definition', () => {
  it('has correct name', () => {
    expect(readDMsTool.name).toBe('readDMs')
  })

  it('has a description', () => {
    expect(readDMsTool.description).toBeTruthy()
    expect(readDMsTool.description.length).toBeGreaterThan(10)
  })

  it('has no required parameters', () => {
    expect((readDMsTool.parameters as any).required).toEqual([])
  })

  it('defines max_results property', () => {
    const props = (readDMsTool.parameters as any).properties
    expect(props).toHaveProperty('max_results')
  })
})

describe('executeReadDMs', () => {
  it('returns dms array with cost', async () => {
    const result = await executeReadDMs()
    expect(result).toHaveProperty('dms')
    expect(result).toHaveProperty('cost')
    expect(Array.isArray(result.dms)).toBe(true)
  })

  it('returns populated DMs when API responds', async () => {
    const result = await executeReadDMs()
    expect(result.dms.length).toBe(1)
    expect(result.dms[0].id).toBe('dm_001')
    expect(result.dms[0].sender_id).toBe('user_d')
  })

  it('includes cost in result', async () => {
    const result = await executeReadDMs()
    expect(result.cost).toBeGreaterThan(0)
  })

  it('returns empty dms when budget is paused', async () => {
    exhaustBudget()
    const result = await executeReadDMs()
    expect(result.dms).toEqual([])
    expect(result.cost).toBe(0)
    expect(mockListDmEvents).not.toHaveBeenCalled()
  })

  it('handles empty DM list gracefully', async () => {
    mockListDmEvents.mockResolvedValue({ data: { data: [] } })
    const result = await executeReadDMs()
    expect(result.dms).toEqual([])
  })

  it('returns empty on 401/403 auth errors', async () => {
    mockListDmEvents.mockRejectedValue(new Error('403 forbidden: not authorized'))
    const result = await executeReadDMs()
    expect(result.dms).toEqual([])
    expect(result.cost).toBe(0)
  })

  it('re-throws non-auth errors', async () => {
    mockListDmEvents.mockRejectedValue(new Error('Network timeout'))
    await expect(executeReadDMs()).rejects.toThrow('Network timeout')
  })
})

// ─── searchPostsTool ──────────────────────────────────────────────────────────

describe('searchPostsTool definition', () => {
  it('has correct name', () => {
    expect(searchPostsTool.name).toBe('searchPosts')
  })

  it('has a description', () => {
    expect(searchPostsTool.description).toBeTruthy()
  })

  it('requires query parameter', () => {
    expect((searchPostsTool.parameters as any).required).toContain('query')
  })

  it('defines max_results property', () => {
    const props = (searchPostsTool.parameters as any).properties
    expect(props).toHaveProperty('max_results')
    expect(props).toHaveProperty('query')
  })
})

describe('executeSearchPosts', () => {
  it('returns posts array with cost', async () => {
    const result = await executeSearchPosts({ query: 'SIP Protocol' })
    expect(result).toHaveProperty('posts')
    expect(result).toHaveProperty('cost')
    expect(Array.isArray(result.posts)).toBe(true)
  })

  it('returns populated posts for valid query', async () => {
    const result = await executeSearchPosts({ query: 'privacy stealth' })
    expect(result.posts.length).toBe(1)
    expect(result.posts[0].id).toBe('333')
    expect(result.posts[0].text).toContain('SIP Protocol')
    expect(result.posts[0].public_metrics).toBeDefined()
  })

  it('forwards query to API', async () => {
    await executeSearchPosts({ query: 'stealth address privacy', max_results: 20 })
    expect(mockSearch).toHaveBeenCalledWith(
      'stealth address privacy',
      expect.objectContaining({ max_results: 20 }),
    )
  })

  it('throws when query is empty string', async () => {
    await expect(executeSearchPosts({ query: '' })).rejects.toThrow(/query/i)
  })

  it('throws when query is whitespace only', async () => {
    await expect(executeSearchPosts({ query: '   ' })).rejects.toThrow(/query/i)
  })

  it('returns empty posts when budget is paused', async () => {
    exhaustBudget()
    const result = await executeSearchPosts({ query: 'SIP Protocol' })
    expect(result.posts).toEqual([])
    expect(result.cost).toBe(0)
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('handles empty search results gracefully', async () => {
    mockSearch.mockResolvedValue({ data: { data: [] } })
    const result = await executeSearchPosts({ query: 'obscure query' })
    expect(result.posts).toEqual([])
  })
})

// ─── readUserProfileTool ──────────────────────────────────────────────────────

describe('readUserProfileTool definition', () => {
  it('has correct name', () => {
    expect(readUserProfileTool.name).toBe('readUserProfile')
  })

  it('has a description', () => {
    expect(readUserProfileTool.description).toBeTruthy()
  })

  it('requires username parameter', () => {
    expect((readUserProfileTool.parameters as any).required).toContain('username')
  })

  it('defines username property', () => {
    const props = (readUserProfileTool.parameters as any).properties
    expect(props).toHaveProperty('username')
  })
})

describe('executeReadUserProfile', () => {
  it('returns user object with cost', async () => {
    const result = await executeReadUserProfile({ username: 'SipProtocol' })
    expect(result).toHaveProperty('user')
    expect(result).toHaveProperty('cost')
  })

  it('returns populated user fields', async () => {
    const result = await executeReadUserProfile({ username: 'SipProtocol' })
    expect(result.user).not.toBeNull()
    expect(result.user?.id).toBe('99999')
    expect(result.user?.username).toBe('SipProtocol')
    expect(result.user?.name).toBe('SIP Protocol')
    expect(result.user?.public_metrics?.followers_count).toBe(1200)
  })

  it('strips leading @ from username before calling API', async () => {
    await executeReadUserProfile({ username: '@SipProtocol' })
    expect(mockUserByUsername).toHaveBeenCalledWith(
      'SipProtocol',
      expect.any(Object),
    )
  })

  it('throws when username is empty string', async () => {
    await expect(executeReadUserProfile({ username: '' })).rejects.toThrow(/username/i)
  })

  it('throws when username is whitespace only', async () => {
    await expect(executeReadUserProfile({ username: '   ' })).rejects.toThrow(/username/i)
  })

  it('returns null user when budget is paused', async () => {
    exhaustBudget()
    const result = await executeReadUserProfile({ username: 'SipProtocol' })
    expect(result.user).toBeNull()
    expect(result.cost).toBe(0)
    expect(mockUserByUsername).not.toHaveBeenCalled()
  })

  it('returns cost of 0.01 per user lookup', async () => {
    const result = await executeReadUserProfile({ username: 'SipProtocol' })
    expect(result.cost).toBe(0.01)
  })

  it('returns null user when API returns no data', async () => {
    mockUserByUsername.mockResolvedValue({ data: undefined })
    const result = await executeReadUserProfile({ username: 'ghostaccount' })
    expect(result.user).toBeNull()
  })
})
