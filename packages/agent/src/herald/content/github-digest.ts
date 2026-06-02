const GITHUB_API = 'https://api.github.com'
const DEFAULT_OWNER = 'sip-protocol'
const DEFAULT_REPO = 'sip-protocol'
const TIMEOUT_MS = 8000

export interface GitHubDigest {
  repo: string
  stars: number | null
  commits: string[]
  mergedPRs: string[]
  releases: string[]
  errors: string[]
}

async function ghFetch(path: string): Promise<unknown | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'sipher-herald',
  }
  const token = process.env.GITHUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    const res = await fetch(`${GITHUB_API}${path}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function fetchGitHubDigest(owner = DEFAULT_OWNER, repo = DEFAULT_REPO): Promise<GitHubDigest> {
  const errors: string[] = []
  const [repoData, commitsData, prsData, releasesData] = await Promise.all([
    ghFetch(`/repos/${owner}/${repo}`),
    ghFetch(`/repos/${owner}/${repo}/commits?per_page=5`),
    ghFetch(`/repos/${owner}/${repo}/pulls?state=closed&per_page=10`),
    ghFetch(`/repos/${owner}/${repo}/releases?per_page=3`),
  ])

  let stars: number | null = null
  if (repoData && typeof (repoData as { stargazers_count?: unknown }).stargazers_count === 'number') {
    stars = (repoData as { stargazers_count: number }).stargazers_count
  } else {
    errors.push('stars')
  }

  let commits: string[] = []
  if (Array.isArray(commitsData)) {
    commits = (commitsData as Array<{ commit?: { message?: string } }>)
      .map((c) => (c.commit?.message ?? '').split('\n')[0])
      .filter((s) => s.length > 0)
  } else {
    errors.push('commits')
  }

  let mergedPRs: string[] = []
  if (Array.isArray(prsData)) {
    mergedPRs = (prsData as Array<{ merged_at?: string | null; title?: string }>)
      .filter((p) => Boolean(p.merged_at))
      .map((p) => p.title ?? '')
      .filter((s) => s.length > 0)
  } else {
    errors.push('pulls')
  }

  let releases: string[] = []
  if (Array.isArray(releasesData)) {
    releases = (releasesData as Array<{ name?: string; tag_name?: string }>)
      .map((r) => r.name || r.tag_name || '')
      .filter((s) => s.length > 0)
  } else {
    errors.push('releases')
  }

  return { repo: `${owner}/${repo}`, stars, commits, mergedPRs, releases, errors }
}

export function formatDigest(d: GitHubDigest): string {
  const lines: string[] = [`Repo ${d.repo}${d.stars !== null ? ` (${d.stars} stars)` : ''}:`]
  if (d.releases.length) lines.push(`Recent releases: ${d.releases.join(', ')}`)
  if (d.mergedPRs.length) lines.push(`Recently merged: ${d.mergedPRs.slice(0, 5).join('; ')}`)
  if (d.commits.length) lines.push(`Recent commits: ${d.commits.slice(0, 5).join('; ')}`)
  if (lines.length === 1) lines.push('(no recent activity fetched)')
  return lines.join('\n')
}
