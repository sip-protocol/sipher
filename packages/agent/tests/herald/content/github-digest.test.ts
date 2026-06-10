import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchGitHubDigest, fetchGitHubDigests, formatDigest, formatDigests, DEFAULT_REPOS } from '../../../src/herald/content/github-digest.js'

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchGitHubDigest', () => {
  it('builds a digest from GitHub responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/repos/sip-protocol/sip-protocol')) return jsonResponse({ stargazers_count: 42 })
      if (url.includes('/commits')) return jsonResponse([{ commit: { message: 'feat: add stealth claim\n\nlong body' } }])
      if (url.includes('/pulls')) return jsonResponse([
        { merged_at: '2026-06-01T00:00:00Z', title: 'Merge feature A' },
        { merged_at: null, title: 'still open' },
      ])
      if (url.includes('/releases')) return jsonResponse([{ name: 'SDK v0.9.1', tag_name: 'v0.9.1' }])
      return jsonResponse(null, false)
    }))

    const d = await fetchGitHubDigest()
    expect(d.stars).toBe(42)
    expect(d.commits).toEqual(['feat: add stealth claim'])
    expect(d.mergedPRs).toEqual(['Merge feature A'])
    expect(d.releases).toEqual(['SDK v0.9.1'])
    expect(d.errors).toEqual([])
  })

  it('degrades gracefully when GitHub is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    const d = await fetchGitHubDigest()
    expect(d.stars).toBeNull()
    expect(d.commits).toEqual([])
    expect(d.errors).toContain('stars')
    expect(formatDigest(d)).toContain('no recent activity')
  })

  it('reports partial failure in errors and formatDigest', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/repos/sip-protocol/sip-protocol')) return jsonResponse({ stargazers_count: 7 })
      if (url.includes('/commits')) return jsonResponse([{ commit: { message: 'fix: a thing' } }])
      if (url.includes('/pulls')) return jsonResponse(null, false)
      if (url.includes('/releases')) return jsonResponse([])
      return jsonResponse(null, false)
    }))
    const d = await fetchGitHubDigest()
    expect(d.commits).toEqual(['fix: a thing'])
    expect(d.mergedPRs).toEqual([])
    expect(d.errors).toContain('pulls')
    expect(formatDigest(d)).toContain('data unavailable')
  })
})

describe('fetchGitHubDigests (multi-repo)', () => {
  it('fetches one digest per repo in the list', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (/\/repos\/sip-protocol\/[^/]+$/.test(url)) return jsonResponse({ stargazers_count: 5 })
      if (url.includes('/commits')) return jsonResponse([{ commit: { message: 'feat: x' } }])
      if (url.includes('/pulls')) return jsonResponse([])
      if (url.includes('/releases')) return jsonResponse([])
      return jsonResponse(null, false)
    }))
    const digests = await fetchGitHubDigests(['sip-protocol', 'sip-app'])
    expect(digests).toHaveLength(2)
    expect(digests[0].repo).toBe('sip-protocol/sip-protocol')
    expect(digests[1].repo).toBe('sip-protocol/sip-app')
  })

  it('DEFAULT_REPOS covers the active public-facing repos', () => {
    expect(DEFAULT_REPOS).toContain('sip-protocol')
    expect(DEFAULT_REPOS).toContain('sip-app')
    expect(DEFAULT_REPOS).toContain('sip-mobile')
    expect(DEFAULT_REPOS).toContain('sipher')
    expect(DEFAULT_REPOS).toContain('docs-sip')
    expect(DEFAULT_REPOS).toContain('blog-sip')
    expect(DEFAULT_REPOS).toContain('circuits')
  })
})

describe('formatDigests', () => {
  it('joins only repos that have activity', () => {
    const active = { repo: 'sip-protocol/sip-app', stars: 1, commits: ['feat: a'], mergedPRs: [], releases: [], errors: [] }
    const empty = { repo: 'sip-protocol/circuits', stars: 0, commits: [], mergedPRs: [], releases: [], errors: [] }
    const text = formatDigests([active, empty])
    expect(text).toContain('sip-protocol/sip-app')
    expect(text).not.toContain('circuits')
  })

  it('falls back when no repo has activity', () => {
    const empty = { repo: 'sip-protocol/circuits', stars: 0, commits: [], mergedPRs: [], releases: [], errors: [] }
    expect(formatDigests([empty])).toContain('no recent ecosystem activity')
  })
})
