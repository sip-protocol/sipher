import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchGitHubDigest, formatDigest } from '../../../src/herald/content/github-digest.js'

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
})
