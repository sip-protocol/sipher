// packages/agent/tests/herald/tools/search-posts.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  SAMPLE_SEARCH_QUERY,
  makeXTweet,
  type ToolSchemaLike,
} from '../../fixtures/herald-tool-mocks.js'

const {
  mockGetReadClient,
  mockCanMakeCall,
  mockTrackXApiCost,
  mockSearch,
} = vi.hoisted(() => ({
  mockGetReadClient: vi.fn(),
  mockCanMakeCall: vi.fn(),
  mockTrackXApiCost: vi.fn(),
  mockSearch: vi.fn(),
}))

vi.mock('../../../src/herald/x-client.js', () => ({
  getReadClient: mockGetReadClient,
}))

vi.mock('../../../src/herald/budget.js', () => ({
  canMakeCall: mockCanMakeCall,
  trackXApiCost: mockTrackXApiCost,
}))

import {
  searchPostsTool,
  executeSearchPosts,
} from '../../../src/herald/tools/search-posts.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCanMakeCall.mockReturnValue(true)
  mockGetReadClient.mockReturnValue({ v2: { search: mockSearch } })
  mockSearch.mockResolvedValue({ data: { data: [makeXTweet(), makeXTweet({ id: '2' })] } })
})

describe('searchPostsTool definition', () => {
  it('has correct name', () => {
    expect(searchPostsTool.name).toBe('searchPosts')
  })

  it('declares required query field', () => {
    const schema = searchPostsTool.parameters as ToolSchemaLike
    expect(schema.required).toEqual(['query'])
  })

  it('has a non-empty description', () => {
    expect(searchPostsTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeSearchPosts — happy path', () => {
  it('returns mapped posts and cost reflecting result count', async () => {
    const r = await executeSearchPosts({ query: SAMPLE_SEARCH_QUERY })

    expect(r.posts).toHaveLength(2)
    expect(r.cost).toBeCloseTo(0.01, 5)
    expect(r.posts[0].id).toBeDefined()
    expect(r.posts[0].text).toBeDefined()
  })

  it('output shape projects id, text, author_id, created_at, public_metrics per post', async () => {
    const r = await executeSearchPosts({ query: SAMPLE_SEARCH_QUERY })

    const keys = Object.keys(r.posts[0]).sort()
    expect(keys).toEqual(['author_id', 'created_at', 'id', 'public_metrics', 'text'])
  })
})

describe('executeSearchPosts — branches', () => {
  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
    ['tabs', '\t\t'],
  ])('throws when query is %s', async (_label, query) => {
    await expect(
      executeSearchPosts({ query }),
    ).rejects.toThrow(/search query is required/i)
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('returns { posts: [], cost: 0 } when budget gate blocks search_read', async () => {
    mockCanMakeCall.mockReturnValueOnce(false)

    const r = await executeSearchPosts({ query: SAMPLE_SEARCH_QUERY })

    expect(r).toEqual({ posts: [], cost: 0 })
    expect(mockSearch).not.toHaveBeenCalled()
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })

  it('clamps max_results below floor (10) up to 10', async () => {
    await executeSearchPosts({ query: SAMPLE_SEARCH_QUERY, max_results: 5 })

    const callOpts = mockSearch.mock.calls[0][1] as { max_results: number }
    expect(callOpts.max_results).toBe(10)
  })

  it('clamps max_results above ceiling (100) down to 100', async () => {
    await executeSearchPosts({ query: SAMPLE_SEARCH_QUERY, max_results: 500 })

    const callOpts = mockSearch.mock.calls[0][1] as { max_results: number }
    expect(callOpts.max_results).toBe(100)
  })

  it('uses default max_results=10 when omitted', async () => {
    await executeSearchPosts({ query: SAMPLE_SEARCH_QUERY })

    const callOpts = mockSearch.mock.calls[0][1] as { max_results: number }
    expect(callOpts.max_results).toBe(10)
  })

  it('returns empty posts array when API returns no data, with cost 0.005 (count=1 floor)', async () => {
    mockSearch.mockResolvedValueOnce({ data: { data: [] } })

    const r = await executeSearchPosts({ query: SAMPLE_SEARCH_QUERY })

    expect(r.posts).toEqual([])
    expect(r.cost).toBeCloseTo(0.005, 5)
    expect(mockTrackXApiCost).toHaveBeenCalledWith('search_read', 1)
  })
})

describe('executeSearchPosts — service interaction', () => {
  it('calls v2.search with verbatim query and tweet.fields list', async () => {
    await executeSearchPosts({ query: SAMPLE_SEARCH_QUERY })

    expect(mockSearch).toHaveBeenCalledTimes(1)
    expect(mockSearch).toHaveBeenCalledWith(SAMPLE_SEARCH_QUERY, {
      max_results: 10,
      'tweet.fields': ['author_id', 'created_at', 'text', 'public_metrics'],
    })
  })

  it('tracks search_read cost with resourceCount = tweets.length', async () => {
    await executeSearchPosts({ query: SAMPLE_SEARCH_QUERY })
    expect(mockTrackXApiCost).toHaveBeenCalledWith('search_read', 2)
  })

  it('propagates v2.search throw (rate limit / network / auth)', async () => {
    mockSearch.mockRejectedValueOnce(new Error('429 rate limit'))

    await expect(
      executeSearchPosts({ query: SAMPLE_SEARCH_QUERY }),
    ).rejects.toThrow(/429 rate limit/)
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })
})
