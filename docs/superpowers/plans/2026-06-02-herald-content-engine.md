# HERALD Content Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give HERALD a proactive daily content engine — it drafts an original tweet from real GitHub activity per a weekly theme calendar and enqueues it to the existing approval queue for RECTOR to approve and publish.

**Architecture:** A new `packages/agent/src/herald/content/` submodule built on HERALD's existing queue→approval→publish pipeline. A cron timer calls an orchestrator that (1) fetches a GitHub activity digest, (2) picks today's theme from a weekly calendar, (3) invokes the HERALD LLM via `chat()` to draft a ≤280-char post, (4) enqueues it as a `pending` `herald_queue` row with `type='content'`. The existing `checkScheduledPosts` poller publishes it once approved. **Generation only writes to the DB — it never calls the X API directly.** The cron runs hourly with a same-day guard, so it produces ~one post per calendar day.

**Tech Stack:** TypeScript (ESM, NodeNext, `.js` import suffixes), `better-sqlite3` via the existing `getDb()` singleton, `@mariozechner/pi-ai` via the existing `chat()` helper (OpenRouter), global `fetch` + `AbortSignal.timeout`, Vitest 3 (forks pool, `:memory:` DB, hoisted mocks).

**Scope (this plan):** GitHub digest → daily theme → HERALD draft → enqueue. **Out of scope (separate plans):** bounty-state ingestion (no bounties exist yet), live @sipprotocol credential wiring + deploy, reactive mention/DM reply-loop verification.

---

## Context for the implementer (verified facts — you have zero prior context)

- **`chat()`** — `packages/agent/src/agent.ts:534`. Signature:
  `export async function chat(userMessage: string, opts: ChatOptions): Promise<{ text: string; toolsUsed: string[] }>`.
  `ChatOptions` (`agent.ts:206`): `{ systemPrompt?: string; tools?: AnthropicTool[]; toolExecutor?: ...; model?: string; history?: AgentMessage[]; sessionId?: string }`. The `model` string MUST be `provider:modelId`, e.g. `openrouter:anthropic/claude-sonnet-4.6` (note dots, not dashes). Calling with no `tools` makes the LLM return plain text. Requires `OPENROUTER_API_KEY` at runtime.
- **`herald_queue` schema** — `packages/agent/src/db.ts:80-93`. Columns: `id TEXT PK, type TEXT NOT NULL, content TEXT NOT NULL, reply_to TEXT, scheduled_at TEXT, status TEXT DEFAULT 'pending', approved_by TEXT, approved_at TEXT, posted_at TEXT, tweet_id TEXT, metrics TEXT, created_at TEXT NOT NULL`. Status flow: `pending → approved → posted`. Index `idx_herald_queue_status(status, scheduled_at)`.
- **Enqueue precedent** — `executePostTweet` (`herald/tools/post-tweet.ts:46`) inserts `(ulid(), 'post', text, null, null, 'pending', now)` and emits `guardianBus.emit({ source:'herald', type:'herald:approval-needed', level:'important', data:{ id, text }, timestamp })`. We mirror this but with `type='content'`.
- **Publish loop already exists** — `startPoller` (`herald/poller.ts:228`) runs `scheduledTimer = setInterval(checkScheduledPosts, 60_000)`. `checkScheduledPosts` (`poller.ts:154`) calls `getReadyToPublish()` → `publishTweet(content)` → `markPublished(id, tweetId)`. We do NOT touch this — our cron only enqueues.
- **DB access** — `import { getDb } from '../../db.js'` (from `content/`). `better-sqlite3` singleton, synchronous prepared statements: `getDb().prepare(sql).run(...)/.get(...)/.all(...)`. In tests, DB is `:memory:` when `NODE_ENV==='test'`.
- **Event bus** — `import { guardianBus } from '../../coordination/event-bus.js'`. `guardianBus.emit(event)` where event = `{ source, type, level, data, timestamp }`.
- **ULID** — `import { ulid } from 'ulid'`.
- **Lifecycle hook** — `packages/agent/src/index.ts:371-388`: HERALD poller starts inside the `server.listen` callback, gated on `process.env.X_BEARER_TOKEN && process.env.X_CONSUMER_KEY` via a dynamic `import('./herald/poller.js')`. We add the content cron in this same block.
- **Config idiom** — inline `Number(process.env.X ?? 'default')` and `process.env.X === 'true'`. No central config module for HERALD. There is no `dotenv`; env is injected by Docker (`docker-compose.yml` `environment:` block) — so new vars must be added to the root `.env.example` AND `docker-compose.yml`.
- **Test idiom** — Vitest 3 (`pnpm --filter @sip-protocol/agent test` runs `vitest run`). Mock `twitter-api-v2` (not needed here — we never call X). DB setup in `beforeEach`: `closeDb(); process.env.NODE_ENV='test'; delete process.env.DB_PATH; getDb()`. Teardown `afterEach`: `closeDb()`. `closeDb`/`getDb` from `'../../../src/db.js'`. Mock global `fetch` with `vi.stubGlobal('fetch', vi.fn(...))` + `vi.unstubAllGlobals()` in `afterEach`.

**Files created by this plan:**

| File | Responsibility |
|------|----------------|
| `packages/agent/src/herald/content/calendar.ts` | Pure day-of-week → content theme mapping |
| `packages/agent/src/herald/content/github-digest.ts` | Fetch + format GitHub activity (commits/PRs/releases/stars) |
| `packages/agent/src/herald/content/prompt.ts` | Content-drafting system prompt + draft-prompt builder |
| `packages/agent/src/herald/content/generator.ts` | Invoke HERALD LLM via `chat()`, return trimmed ≤280 draft |
| `packages/agent/src/herald/content/enqueue.ts` | Insert `type='content'` queue row + same-day guard |
| `packages/agent/src/herald/content/cron.ts` | Orchestrator `generateDailyContent` + `startContentCron`/`stopContentCron` |
| `packages/agent/tests/herald/content/*.test.ts` | One test file per module above |

**File modified:** `packages/agent/src/index.ts` (wire the cron), root `.env.example`, `docker-compose.yml`, `docs/deployment.md`.

**Run all tests for this package:** `cd /Users/rector/local-dev/sipher && pnpm --filter @sip-protocol/agent test`
**Typecheck:** `cd /Users/rector/local-dev/sipher && pnpm --filter @sip-protocol/agent typecheck` (after, run repo-root `pnpm typecheck`).

---

## Task 1: Content theme calendar

**Files:**
- Create: `packages/agent/src/herald/content/calendar.ts`
- Test: `packages/agent/tests/herald/content/calendar.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/agent/tests/herald/content/calendar.test.ts
import { describe, it, expect } from 'vitest'
import { themeForDate } from '../../../src/herald/content/calendar.js'

describe('themeForDate', () => {
  // Anchor dates: 2023-01-01 (UTC) is a Sunday, 01-02 Monday, ... 01-07 Saturday.
  it('maps each UTC weekday to its theme', () => {
    expect(themeForDate(new Date('2023-01-01T12:00:00Z')).theme).toBe('Vision')        // Sun
    expect(themeForDate(new Date('2023-01-02T12:00:00Z')).theme).toBe('SDK tip')       // Mon
    expect(themeForDate(new Date('2023-01-03T12:00:00Z')).theme).toBe('Privacy explainer') // Tue
    expect(themeForDate(new Date('2023-01-04T12:00:00Z')).theme).toBe('Ecosystem')     // Wed
    expect(themeForDate(new Date('2023-01-05T12:00:00Z')).theme).toBe('Bounty spotlight') // Thu
    expect(themeForDate(new Date('2023-01-06T12:00:00Z')).theme).toBe('Week in SIP')   // Fri
    expect(themeForDate(new Date('2023-01-07T12:00:00Z')).theme).toBe('Community')     // Sat
  })

  it('returns a focus string and day label', () => {
    const t = themeForDate(new Date('2023-01-02T12:00:00Z'))
    expect(t.day).toBe('Mon')
    expect(t.focus.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/rector/local-dev/sipher && pnpm --filter @sip-protocol/agent test -- calendar`
Expected: FAIL — cannot find module `calendar.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/agent/src/herald/content/calendar.ts
export interface ContentTheme {
  day: string
  theme: string
  focus: string
}

const CALENDAR: Record<number, ContentTheme> = {
  0: { day: 'Sun', theme: 'Vision', focus: 'the bigger privacy-standard vision and a roadmap teaser' },
  1: { day: 'Mon', theme: 'SDK tip', focus: 'a concrete @sip-protocol/sdk code tip or snippet developers can use' },
  2: { day: 'Tue', theme: 'Privacy explainer', focus: 'one privacy concept — stealth addresses, Pedersen commitments, or viewing keys' },
  3: { day: 'Wed', theme: 'Ecosystem', focus: 'the Solana privacy ecosystem and where SIP fits' },
  4: { day: 'Thu', theme: 'Bounty spotlight', focus: 'SIP developer bounties and how to participate' },
  5: { day: 'Fri', theme: 'Week in SIP', focus: "the week's shipped progress drawn from the GitHub activity below" },
  6: { day: 'Sat', theme: 'Community', focus: 'a contributor, integration, or community moment worth celebrating' },
}

export function themeForDate(date: Date): ContentTheme {
  return CALENDAR[date.getUTCDay()]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/rector/local-dev/sipher && pnpm --filter @sip-protocol/agent test -- calendar`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/rector/local-dev/sipher
git add packages/agent/src/herald/content/calendar.ts packages/agent/tests/herald/content/calendar.test.ts
git commit -m "feat(herald): add content theme calendar"
```

---

## Task 2: GitHub activity digest

**Files:**
- Create: `packages/agent/src/herald/content/github-digest.ts`
- Test: `packages/agent/tests/herald/content/github-digest.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/agent/tests/herald/content/github-digest.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/rector/local-dev/sipher && pnpm --filter @sip-protocol/agent test -- github-digest`
Expected: FAIL — cannot find module `github-digest.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/agent/src/herald/content/github-digest.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/rector/local-dev/sipher && pnpm --filter @sip-protocol/agent test -- github-digest`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/rector/local-dev/sipher
git add packages/agent/src/herald/content/github-digest.ts packages/agent/tests/herald/content/github-digest.test.ts
git commit -m "feat(herald): add GitHub activity digest for content engine"
```

---

## Task 3: Content-drafting prompt

**Files:**
- Create: `packages/agent/src/herald/content/prompt.ts`
- Test: `packages/agent/tests/herald/content/prompt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/agent/tests/herald/content/prompt.test.ts
import { describe, it, expect } from 'vitest'
import { HERALD_CONTENT_SYSTEM_PROMPT, buildDraftPrompt } from '../../../src/herald/content/prompt.js'
import type { ContentTheme } from '../../../src/herald/content/calendar.js'

const theme: ContentTheme = { day: 'Mon', theme: 'SDK tip', focus: 'a concrete SDK snippet' }

describe('content prompt', () => {
  it('system prompt sets the HERALD voice and a 280-char constraint', () => {
    expect(HERALD_CONTENT_SYSTEM_PROMPT).toMatch(/HERALD/)
    expect(HERALD_CONTENT_SYSTEM_PROMPT).toMatch(/280/)
  })

  it('draft prompt embeds the theme focus and the digest', () => {
    const p = buildDraftPrompt(theme, 'Repo sip-protocol/sip-protocol (42 stars):')
    expect(p).toContain('a concrete SDK snippet')
    expect(p).toContain('42 stars')
    expect(p).toContain('280')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/rector/local-dev/sipher && pnpm --filter @sip-protocol/agent test -- content/prompt`
Expected: FAIL — cannot find module `prompt.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/agent/src/herald/content/prompt.ts
import type { ContentTheme } from './calendar.js'

export const HERALD_CONTENT_SYSTEM_PROMPT = `You are HERALD, SIP Protocol's voice on X/Twitter. Confident, technical, cypherpunk — never corporate, never aggressive shilling. You speak for @SipProtocol, the privacy standard for Web3: stealth addresses, hidden amounts, and viewing keys for compliance.

You are drafting ONE original tweet. Output ONLY the tweet text — no preamble, no surrounding quotes, no "Here's a tweet:", no hashtag spam. Keep it under 280 characters. Use at most one mention (@SipProtocol) and at most two relevant emojis. Never include wallet addresses, amounts, or private keys.`

export function buildDraftPrompt(theme: ContentTheme, digestText: string): string {
  return `Today's theme is "${theme.theme}" (${theme.day}). Draft a tweet about ${theme.focus}.

Recent SIP Protocol activity you may draw on (do not invent facts beyond this):
${digestText}

Write the single tweet now, under 280 characters. Output only the tweet text.`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/rector/local-dev/sipher && pnpm --filter @sip-protocol/agent test -- content/prompt`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/rector/local-dev/sipher
git add packages/agent/src/herald/content/prompt.ts packages/agent/tests/herald/content/prompt.test.ts
git commit -m "feat(herald): add content-drafting prompt"
```

---

## Task 4: Content generator (LLM call)

**Files:**
- Create: `packages/agent/src/herald/content/generator.ts`
- Test: `packages/agent/tests/herald/content/generator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/agent/tests/herald/content/generator.test.ts
import { describe, it, expect, vi } from 'vitest'
import { generateDraft } from '../../../src/herald/content/generator.js'
import type { ContentTheme } from '../../../src/herald/content/calendar.js'

const theme: ContentTheme = { day: 'Mon', theme: 'SDK tip', focus: 'a concrete SDK snippet' }

describe('generateDraft', () => {
  it('calls chat with the content system prompt and returns a trimmed draft', async () => {
    const fakeChat = vi.fn().mockResolvedValue({ text: '  Privacy is a default, not a feature. 🔒  ', toolsUsed: [] })
    const draft = await generateDraft(theme, 'digest text', { chat: fakeChat })

    expect(draft).toBe('Privacy is a default, not a feature. 🔒')
    expect(fakeChat).toHaveBeenCalledTimes(1)
    const [message, opts] = fakeChat.mock.calls[0]
    expect(message).toContain('a concrete SDK snippet')
    expect(opts.systemPrompt).toMatch(/HERALD/)
    expect(opts.model).toMatch(/^openrouter:/)
  })

  it('truncates drafts longer than 280 characters', async () => {
    const long = 'x'.repeat(400)
    const fakeChat = vi.fn().mockResolvedValue({ text: long, toolsUsed: [] })
    const draft = await generateDraft(theme, 'digest', { chat: fakeChat })
    expect(draft.length).toBe(280)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/rector/local-dev/sipher && pnpm --filter @sip-protocol/agent test -- generator`
Expected: FAIL — cannot find module `generator.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/agent/src/herald/content/generator.ts
import { chat } from '../../agent.js'
import { HERALD_CONTENT_SYSTEM_PROMPT, buildDraftPrompt } from './prompt.js'
import type { ContentTheme } from './calendar.js'

const MODEL = process.env.HERALD_MODEL ?? 'openrouter:anthropic/claude-sonnet-4.6'
const MAX_TWEET = 280

export interface GenerateDeps {
  chat: typeof chat
}

const defaultDeps: GenerateDeps = { chat }

export async function generateDraft(
  theme: ContentTheme,
  digestText: string,
  deps: GenerateDeps = defaultDeps,
): Promise<string> {
  const prompt = buildDraftPrompt(theme, digestText)
  const { text } = await deps.chat(prompt, {
    systemPrompt: HERALD_CONTENT_SYSTEM_PROMPT,
    model: MODEL,
  })
  const draft = text.trim()
  return draft.length > MAX_TWEET ? draft.slice(0, MAX_TWEET) : draft
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/rector/local-dev/sipher && pnpm --filter @sip-protocol/agent test -- generator`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/rector/local-dev/sipher
git add packages/agent/src/herald/content/generator.ts packages/agent/tests/herald/content/generator.test.ts
git commit -m "feat(herald): add content generator (HERALD LLM draft)"
```

---

## Task 5: Enqueue + same-day guard

**Files:**
- Create: `packages/agent/src/herald/content/enqueue.ts`
- Test: `packages/agent/tests/herald/content/enqueue.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/agent/tests/herald/content/enqueue.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { closeDb, getDb } from '../../../src/db.js'
import { guardianBus } from '../../../src/coordination/event-bus.js'
import { enqueueContentPost, hasGeneratedToday } from '../../../src/herald/content/enqueue.js'

beforeEach(() => {
  closeDb()
  process.env.NODE_ENV = 'test'
  delete process.env.DB_PATH
  getDb()
})

afterEach(() => {
  closeDb()
  vi.restoreAllMocks()
})

describe('enqueueContentPost', () => {
  it('inserts a pending content row and emits approval-needed', () => {
    const spy = vi.spyOn(guardianBus, 'emit')
    const { id } = enqueueContentPost('GM, privacy fam')

    const row = getDb().prepare('SELECT * FROM herald_queue WHERE id = ?').get(id) as Record<string, unknown>
    expect(row.type).toBe('content')
    expect(row.status).toBe('pending')
    expect(row.content).toBe('GM, privacy fam')
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'herald:approval-needed', data: { id, text: 'GM, privacy fam' } }))
  })

  it('rejects empty and over-length text', () => {
    expect(() => enqueueContentPost('')).toThrow('text is required')
    expect(() => enqueueContentPost('x'.repeat(281))).toThrow('280')
  })
})

describe('hasGeneratedToday', () => {
  it('is false on a fresh DB and true after a content insert', () => {
    expect(hasGeneratedToday()).toBe(false)
    enqueueContentPost('today post')
    expect(hasGeneratedToday()).toBe(true)
  })

  it('ignores non-content rows', () => {
    const now = new Date().toISOString()
    getDb().prepare(`INSERT INTO herald_queue (id, type, content, status, created_at) VALUES (?, 'post', ?, 'pending', ?)`)
      .run('p1', 'a reply', now)
    expect(hasGeneratedToday()).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/rector/local-dev/sipher && pnpm --filter @sip-protocol/agent test -- content/enqueue`
Expected: FAIL — cannot find module `enqueue.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/agent/src/herald/content/enqueue.ts
import { ulid } from 'ulid'
import { getDb } from '../../db.js'
import { guardianBus } from '../../coordination/event-bus.js'

export interface EnqueueResult {
  id: string
}

export function enqueueContentPost(text: string): EnqueueResult {
  if (!text || text.trim().length === 0) {
    throw new Error('text is required')
  }
  if (text.length > 280) {
    throw new Error('text exceeds 280 character limit')
  }

  const id = ulid()
  const now = new Date().toISOString()

  getDb().prepare(`
    INSERT INTO herald_queue (id, type, content, reply_to, scheduled_at, status, created_at)
    VALUES (?, 'content', ?, null, null, 'pending', ?)
  `).run(id, text, now)

  guardianBus.emit({
    source: 'herald',
    type: 'herald:approval-needed',
    level: 'important',
    data: { id, text },
    timestamp: now,
  })

  return { id }
}

export function hasGeneratedToday(): boolean {
  const row = getDb().prepare(
    `SELECT 1 AS one FROM herald_queue WHERE type = 'content' AND date(created_at) = date('now') LIMIT 1`
  ).get() as { one: number } | undefined
  return row !== undefined
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/rector/local-dev/sipher && pnpm --filter @sip-protocol/agent test -- content/enqueue`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/rector/local-dev/sipher
git add packages/agent/src/herald/content/enqueue.ts packages/agent/tests/herald/content/enqueue.test.ts
git commit -m "feat(herald): enqueue content posts with same-day guard"
```

---

## Task 6: Daily orchestrator + cron timer

**Files:**
- Create: `packages/agent/src/herald/content/cron.ts`
- Test: `packages/agent/tests/herald/content/cron.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/agent/tests/herald/content/cron.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { generateDailyContent, startContentCron, type DailyContentDeps } from '../../../src/herald/content/cron.js'

function makeDeps(over: Partial<DailyContentDeps> = {}): DailyContentDeps {
  return {
    hasGeneratedToday: vi.fn().mockReturnValue(false),
    fetchGitHubDigest: vi.fn().mockResolvedValue({ repo: 'r', stars: 1, commits: [], mergedPRs: [], releases: [], errors: [] }),
    formatDigest: vi.fn().mockReturnValue('digest text'),
    themeForDate: vi.fn().mockReturnValue({ day: 'Mon', theme: 'SDK tip', focus: 'a snippet' }),
    generateDraft: vi.fn().mockResolvedValue('a fresh draft'),
    enqueueContentPost: vi.fn().mockReturnValue({ id: 'q1' }),
    now: () => new Date('2026-06-02T12:00:00Z'),
    ...over,
  }
}

afterEach(() => {
  delete process.env.HERALD_CONTENT_CRON_ENABLED
})

describe('generateDailyContent', () => {
  it('skips when a post was already generated today', async () => {
    const deps = makeDeps({ hasGeneratedToday: vi.fn().mockReturnValue(true) })
    const result = await generateDailyContent(deps)
    expect(result).toEqual({ generated: false, reason: 'already-generated-today' })
    expect(deps.enqueueContentPost).not.toHaveBeenCalled()
  })

  it('drafts and enqueues when none exists yet', async () => {
    const deps = makeDeps()
    const result = await generateDailyContent(deps)
    expect(deps.generateDraft).toHaveBeenCalledWith(expect.objectContaining({ theme: 'SDK tip' }), 'digest text')
    expect(deps.enqueueContentPost).toHaveBeenCalledWith('a fresh draft')
    expect(result).toEqual({ generated: true, id: 'q1' })
  })

  it('skips enqueue when the draft is empty', async () => {
    const deps = makeDeps({ generateDraft: vi.fn().mockResolvedValue('   ') })
    const result = await generateDailyContent(deps)
    expect(result).toEqual({ generated: false, reason: 'empty-draft' })
    expect(deps.enqueueContentPost).not.toHaveBeenCalled()
  })
})

describe('startContentCron', () => {
  it('returns null when disabled', () => {
    delete process.env.HERALD_CONTENT_CRON_ENABLED
    expect(startContentCron()).toBeNull()
  })

  it('returns a timer when enabled', () => {
    process.env.HERALD_CONTENT_CRON_ENABLED = 'true'
    const timer = startContentCron()
    expect(timer).not.toBeNull()
    if (timer) clearInterval(timer)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/rector/local-dev/sipher && pnpm --filter @sip-protocol/agent test -- content/cron`
Expected: FAIL — cannot find module `cron.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/agent/src/herald/content/cron.ts
import { fetchGitHubDigest, formatDigest } from './github-digest.js'
import { themeForDate } from './calendar.js'
import { generateDraft } from './generator.js'
import { enqueueContentPost, hasGeneratedToday } from './enqueue.js'
import { guardianBus } from '../../coordination/event-bus.js'

export interface DailyContentDeps {
  hasGeneratedToday: typeof hasGeneratedToday
  fetchGitHubDigest: typeof fetchGitHubDigest
  formatDigest: typeof formatDigest
  themeForDate: typeof themeForDate
  generateDraft: typeof generateDraft
  enqueueContentPost: typeof enqueueContentPost
  now: () => Date
}

const defaultDeps: DailyContentDeps = {
  hasGeneratedToday,
  fetchGitHubDigest,
  formatDigest,
  themeForDate,
  generateDraft,
  enqueueContentPost,
  now: () => new Date(),
}

export interface DailyContentResult {
  generated: boolean
  id?: string
  reason?: string
}

export async function generateDailyContent(deps: DailyContentDeps = defaultDeps): Promise<DailyContentResult> {
  if (deps.hasGeneratedToday()) {
    return { generated: false, reason: 'already-generated-today' }
  }

  const digest = await deps.fetchGitHubDigest()
  const digestText = deps.formatDigest(digest)
  const theme = deps.themeForDate(deps.now())
  const draft = await deps.generateDraft(theme, digestText)

  if (!draft || draft.trim().length === 0) {
    return { generated: false, reason: 'empty-draft' }
  }

  const { id } = deps.enqueueContentPost(draft)

  guardianBus.emit({
    source: 'herald',
    type: 'herald:content-generated',
    level: 'routine',
    data: { id, theme: theme.theme },
    timestamp: deps.now().toISOString(),
  })

  return { generated: true, id }
}

function cronEnabled(): boolean {
  return process.env.HERALD_CONTENT_CRON_ENABLED === 'true'
}

function cronIntervalMs(): number {
  // Hourly check; the same-day guard in generateDailyContent ensures ~one post/day.
  return Number(process.env.HERALD_CONTENT_CRON_INTERVAL ?? '3600000')
}

export function startContentCron(): ReturnType<typeof setInterval> | null {
  if (!cronEnabled()) return null

  const timer = setInterval(() => {
    generateDailyContent().catch((err) => {
      guardianBus.emit({
        source: 'herald',
        type: 'herald:content-failed',
        level: 'important',
        data: { error: err instanceof Error ? err.message : String(err) },
        timestamp: new Date().toISOString(),
      })
    })
  }, cronIntervalMs())

  timer.unref()
  return timer
}

export function stopContentCron(timer: ReturnType<typeof setInterval> | null): void {
  if (timer) clearInterval(timer)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/rector/local-dev/sipher && pnpm --filter @sip-protocol/agent test -- content/cron`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/rector/local-dev/sipher
git add packages/agent/src/herald/content/cron.ts packages/agent/tests/herald/content/cron.test.ts
git commit -m "feat(herald): add daily content orchestrator + cron"
```

---

## Task 7: Wire the cron into the HERALD lifecycle

**Files:**
- Modify: `packages/agent/src/index.ts` (the HERALD startup block, ~lines 371-388)

This wiring runs only inside the entrypoint; it is verified by typecheck + the Task 6 `startContentCron` unit tests (enable-flag gate) rather than a new unit test for `index.ts`.

- [ ] **Step 1: Read the current HERALD startup block**

Run: `cd /Users/rector/local-dev/sipher && sed -n '368,392p' packages/agent/src/index.ts`
Confirm it matches the block quoted below before editing.

- [ ] **Step 2: Modify the startup block**

Replace the existing HERALD startup block:

```ts
  // Start HERALD (X agent) only when X API credentials are present
  if (process.env.X_BEARER_TOKEN && process.env.X_CONSUMER_KEY) {
    Promise.all([
      import('./herald/poller.js'),
      import('./adapters/x.js'),
    ]).then(([{ createPollerState, startPoller }, { createXAdapter }]) => {
      createXAdapter()
      const heraldState = createPollerState()
      startPoller(heraldState)
      console.log('  HERALD:  poller started (mentions + DMs + scheduled posts)')
    }).catch(err => {
      console.warn('  HERALD:  not started:', (err as Error).message)
    })
  }
```

with (adds the content-cron import + start):

```ts
  // Start HERALD (X agent) only when X API credentials are present
  if (process.env.X_BEARER_TOKEN && process.env.X_CONSUMER_KEY) {
    Promise.all([
      import('./herald/poller.js'),
      import('./adapters/x.js'),
      import('./herald/content/cron.js'),
    ]).then(([{ createPollerState, startPoller }, { createXAdapter }, { startContentCron }]) => {
      createXAdapter()
      const heraldState = createPollerState()
      startPoller(heraldState)
      const contentTimer = startContentCron()
      console.log(
        contentTimer
          ? '  HERALD:  poller started (mentions + DMs + scheduled posts) + content cron'
          : '  HERALD:  poller started (mentions + DMs + scheduled posts); content cron disabled'
      )
    }).catch(err => {
      console.warn('  HERALD:  not started:', (err as Error).message)
    })
  }
```

> Note: if the actual block differs from Step 1's output, preserve its real shape and only add the third dynamic import + the `startContentCron()` call + the updated log line.

- [ ] **Step 3: Typecheck**

Run: `cd /Users/rector/local-dev/sipher && pnpm --filter @sip-protocol/agent typecheck`
Expected: no errors.

- [ ] **Step 4: Run the full agent test suite**

Run: `cd /Users/rector/local-dev/sipher && pnpm --filter @sip-protocol/agent test`
Expected: all pass, including the new `content/*` tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/rector/local-dev/sipher
git add packages/agent/src/index.ts
git commit -m "feat(herald): start content cron in HERALD lifecycle"
```

---

## Task 8: Config docs — .env.example, docker-compose, deployment doc

**Files:**
- Modify: `.env.example` (repo root)
- Modify: `docker-compose.yml` (repo root)
- Modify: `docs/deployment.md`

No runtime code changes; verified by inspection + a final repo-root typecheck.

- [ ] **Step 1: Add the HERALD content-engine + GitHub vars to `.env.example`**

Append after the existing OpenRouter block in the root `.env.example`:

```bash
# HERALD content engine (proactive daily posts → approval queue)
# Opt-in: only generates when set to 'true'. Posts always require RECTOR approval before publish.
HERALD_CONTENT_CRON_ENABLED=false
# Cron check interval (ms). Default 1h; a same-day guard ensures ~one post/day.
HERALD_CONTENT_CRON_INTERVAL=3600000
# GitHub read token for the activity digest (optional — unauthenticated falls back to 60 req/hr).
GITHUB_TOKEN=

# HERALD X/Twitter credentials (required for HERALD to post/reply on @sipprotocol).
# Read path uses the bearer token; write path uses the OAuth 1.0a 4-tuple.
X_BEARER_TOKEN=
X_CONSUMER_KEY=
X_CONSUMER_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_SECRET=
HERALD_X_USER_ID=
```

> Do NOT add a `SIPHER_OPENROUTER_API_KEY` — pi-ai reads `OPENROUTER_API_KEY` directly (issue #295).

- [ ] **Step 2: Add the same vars to `docker-compose.yml`**

In the agent service's `environment:` block, add pass-throughs (host env → container) following the existing style:

```yaml
      - HERALD_CONTENT_CRON_ENABLED=${HERALD_CONTENT_CRON_ENABLED:-false}
      - HERALD_CONTENT_CRON_INTERVAL=${HERALD_CONTENT_CRON_INTERVAL:-3600000}
      - GITHUB_TOKEN=${GITHUB_TOKEN:-}
      - X_BEARER_TOKEN=${X_BEARER_TOKEN:-}
      - X_CONSUMER_KEY=${X_CONSUMER_KEY:-}
      - X_CONSUMER_SECRET=${X_CONSUMER_SECRET:-}
      - X_ACCESS_TOKEN=${X_ACCESS_TOKEN:-}
      - X_ACCESS_SECRET=${X_ACCESS_SECRET:-}
      - HERALD_X_USER_ID=${HERALD_X_USER_ID:-}
```

> First read the existing `environment:` block and match its exact indentation + whether it already declares any of these (don't duplicate — only add the missing ones).

- [ ] **Step 3: Document the content engine in `docs/deployment.md`**

Add a short subsection under the HERALD/operations area:

```markdown
### HERALD content engine

When `HERALD_CONTENT_CRON_ENABLED=true` (and X credentials are present), HERALD drafts
one original tweet per day from a weekly theme calendar + a live GitHub activity digest,
and enqueues it to the approval queue. Nothing publishes until approved in the Command
Center HeraldView. Tunables: `HERALD_CONTENT_CRON_INTERVAL` (ms, default 3600000),
`GITHUB_TOKEN` (optional, raises the GitHub rate limit).
```

- [ ] **Step 4: Typecheck the whole repo**

Run: `cd /Users/rector/local-dev/sipher && pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/rector/local-dev/sipher
git add .env.example docker-compose.yml docs/deployment.md
git commit -m "docs(herald): document content-engine + X env vars"
```

---

## Self-Review

**1. Spec coverage (against the T3 refresh spec §A2 "Operationalize HERALD"):**
- ① daily content cron → Tasks 6, 7 ✅
- ② context ingestion (GitHub digest) → Task 2 ✅ (bounty ingestion deferred — documented, no data yet)
- ③ live wiring (@sipprotocol creds, deploy) → **deferred to a follow-on plan** (this plan adds the env-var surface in Task 8; actual credential generation + deploy is RECTOR-gated and out of scope here)
- ④ reactive-loop verification → **deferred to a follow-on plan**
- Approval-queue mode (posts wait for approval) → preserved: enqueue writes `pending`, existing poller publishes only `approved` rows ✅
- Weekly content calendar → Task 1 ✅

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". Every code step has complete code. GitHub failure handling is explicit (typed null + `errors[]`). ✅

**3. Type consistency:** `ContentTheme` (Task 1) is consumed unchanged in Tasks 3/4/6. `GitHubDigest` (Task 2) flows into `formatDigest`/`fetchGitHubDigest` deps in Task 6. `generateDraft(theme, digestText, deps)` signature matches its call in `generateDailyContent`. `enqueueContentPost(text) → { id }` matches its orchestrator use. `herald_queue` insert columns match the verified schema (`db.ts:80-93`). Status `'pending'` and `type='content'` are consistent across enqueue + guard + the existing publish selector. ✅

---

## Execution Handoff

Implement with **superpowers:subagent-driven-development** (recommended) — fresh subagent per task, two-stage review between tasks — or **superpowers:executing-plans** for inline batch execution. Tasks 1–6 are pure TDD; Task 7 is a small wiring edit verified by typecheck; Task 8 is config docs.

After all tasks: open a PR `feat/herald-content-engine` against `main`, and (RECTOR-gated, separate) generate @sipprotocol X credentials + set `HERALD_CONTENT_CRON_ENABLED=true` on the VPS to go live.
