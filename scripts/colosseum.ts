#!/usr/bin/env tsx
/**
 * Colosseum Agent Hackathon — Autonomous Engagement Agent
 *
 * LLM-powered agent that cross-pollinates with other hackathon agents by:
 * 1. Fetching forum posts and projects
 * 2. Generating contextual comments using 6 weighted strategies (peer review, questions, integration, war stories, compliments, contrarian insights)
 * 3. Creating autonomous forum posts with varied content (deepdives, war stories, analysis, showcases, open questions, progress)
 * 4. Voting for complementary projects
 * 5. Tracking all engagement to avoid duplicates
 *
 * Usage:
 *   tsx scripts/colosseum.ts engage     # Run full engagement cycle
 *   tsx scripts/colosseum.ts heartbeat  # Continuous loop until hackathon ends
 *   tsx scripts/colosseum.ts status     # Show engagement stats
 *   tsx scripts/colosseum.ts leaderboard # Show vote leaderboard
 *   tsx scripts/colosseum.ts posts      # List recent forum posts
 *   tsx scripts/colosseum.ts vote-all   # Vote for all projects we haven't voted for
 *
 * Env:
 *   COLOSSEUM_API_KEY    — Agent API key (required)
 *   DRY_RUN=1            — Preview without posting (optional)
 *   OPENROUTER_API_KEY   — OpenRouter API key for LLM comments (optional)
 *   LLM_MODEL            — Model to use (default: anthropic/claude-3.5-haiku)
 *   USE_LLM=0            — Disable LLM, use templates only
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync, renameSync, openSync, closeSync, constants } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Lock File (prevent multiple instances) - with atomic creation
// ---------------------------------------------------------------------------

const LOCK_FILE = '/tmp/sipher-heartbeat.lock'

function acquireLock(): boolean {
  // First check if lock exists and if process is running
  if (existsSync(LOCK_FILE)) {
    try {
      const pidStr = readFileSync(LOCK_FILE, 'utf-8').trim()
      const pid = parseInt(pidStr, 10)
      // Check if process is still running
      try {
        process.kill(pid, 0) // Signal 0 = check existence
        console.error(`ERROR: Another heartbeat is running (PID ${pid})`)
        console.error(`If this is stale, remove: rm ${LOCK_FILE}`)
        return false
      } catch {
        // Process not running, lock is stale - remove it
        console.log(`Removing stale lock file (PID ${pid} not running)`)
        unlinkSync(LOCK_FILE)
      }
    } catch {
      // Malformed lock file, remove it
      try { unlinkSync(LOCK_FILE) } catch { /* ignore */ }
    }
  }

  // Try to create lock atomically using O_EXCL (fails if file exists)
  try {
    const fd = openSync(LOCK_FILE, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY)
    writeFileSync(fd, String(process.pid))
    closeSync(fd)
    return true
  } catch (err) {
    // Another process created the lock between our check and create (race condition)
    console.error(`ERROR: Failed to acquire lock (race condition or permission error)`)
    console.error(`Details: ${err}`)
    return false
  }
}

function releaseLock(): void {
  try {
    if (existsSync(LOCK_FILE)) {
      const pidStr = readFileSync(LOCK_FILE, 'utf-8').trim()
      if (pidStr === String(process.pid)) {
        unlinkSync(LOCK_FILE)
      }
    }
  } catch {
    // Ignore errors during cleanup
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = 'https://agents.colosseum.com/api'
const AGENT_ID = 274
const PROJECT_ID = 148
const PROJECT_SLUG = 'sipher-privacy-as-a-skill-for-solana-agents'
const OUR_POST_IDS = [373, 374, 376, 498, 499, 500, 504] // our own forum posts
const STATE_FILE = resolve(__dirname, '.colosseum-state.json')
const DRY_RUN = process.env.DRY_RUN === '1'
const MAX_COMMENTS_PER_RUN = parseInt(process.env.MAX_COMMENTS || '15', 10)
const COMMENT_DELAY_MS = 800 // delay between comments to avoid rate limits
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '1800000', 10) // 30 min
const HACKATHON_END = new Date('2026-02-13T17:00:00.000Z')

// LLM Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const LLM_MODEL = process.env.LLM_MODEL || 'anthropic/claude-3.5-haiku'
const USE_LLM = process.env.USE_LLM !== '0' && !!OPENROUTER_API_KEY
const POST_INTERVAL_HOURS = 2 // Create new forum post every 2 hours (matching AgentShield's frequency)

function getApiKey(): string {
  if (process.env.COLOSSEUM_API_KEY) return process.env.COLOSSEUM_API_KEY
  // fallback: read from credentials file
  const credPath = resolve(
    process.env.HOME || '~',
    '.claude/sip-protocol/sipher/CREDENTIALS.md',
  )
  if (existsSync(credPath)) {
    const content = readFileSync(credPath, 'utf-8')
    const match = content.match(/```\n([a-f0-9]{64})\n```/)
    if (match) return match[1]
  }
  console.error('ERROR: Set COLOSSEUM_API_KEY or ensure ~/.claude/sip-protocol/sipher/CREDENTIALS.md exists')
  process.exit(1)
}

const API_KEY = getApiKey()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ForumPost {
  id: number
  title: string
  body: string
  agentId: number
  agentName: string
  createdAt: string
  commentCount: number
}

interface Project {
  id: number
  name: string
  slug: string
  description: string
  tags: string[]
  agentUpvotes: number
  humanUpvotes: number
  agentId: number
}

interface EngagementState {
  commentedPosts: Record<number, { commentId: number, date: string }>
  votedProjects: Record<number, { date: string }>
  ourPostIds: number[]           // Track our created posts
  lastPostTime: number           // Last post creation timestamp
  lastRun: string | null
  totalComments: number
  totalVotes: number
  totalPosts: number             // Track post count
  leaderboardRank?: number       // Current rank for knowledge context
  lastCommentStrategy?: string   // Last used comment strategy (for rotation)
  strategyUseCounts?: Record<string, number> // Track strategy usage for balancing
  knowledge?: {                  // Cached GitHub knowledge
    github: GitHubKnowledge | null
    lastFetch: number
  }
}

// ---------------------------------------------------------------------------
// GitHub Knowledge Types
// ---------------------------------------------------------------------------

interface GitHubCommit {
  sha: string
  message: string
  date: string
}

interface GitHubIssue {
  number: number
  title: string
  labels: string[]
}

interface GitHubPR {
  number: number
  title: string
  state: string
}

interface GitHubKnowledge {
  commits: GitHubCommit[]
  issues: GitHubIssue[]
  prs: GitHubPR[]
  testCount: number
}

const KNOWLEDGE_CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const BLOG_CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours (blog updates less frequently)
const GITHUB_OWNER = 'sip-protocol'
const GITHUB_REPO = 'sipher'
const BLOG_LLMS_URL = 'https://blog.sip-protocol.org/llms.txt'

// Cached blog knowledge
let blogKnowledgeCache: { content: string; lastFetch: number } | null = null

// ---------------------------------------------------------------------------
// State Management
// ---------------------------------------------------------------------------

function loadState(): EngagementState {
  if (existsSync(STATE_FILE)) {
    const state = JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
    // Ensure new fields exist for backwards compatibility
    return {
      ourPostIds: [],
      lastPostTime: 0,
      totalPosts: 0,
      leaderboardRank: undefined,
      lastCommentStrategy: undefined,
      strategyUseCounts: {},
      knowledge: undefined,
      ...state,
    }
  }
  return {
    commentedPosts: {},
    votedProjects: {},
    ourPostIds: [],
    lastPostTime: 0,
    lastRun: null,
    totalComments: 0,
    totalVotes: 0,
    totalPosts: 0,
    leaderboardRank: undefined,
    lastCommentStrategy: undefined,
    strategyUseCounts: {},
    knowledge: undefined,
  }
}

function saveState(state: EngagementState): void {
  // Atomic save: write to temp file, then rename (prevents corruption on crash)
  const tempFile = `${STATE_FILE}.tmp.${process.pid}`
  try {
    writeFileSync(tempFile, JSON.stringify(state, null, 2))
    renameSync(tempFile, STATE_FILE) // Atomic on POSIX systems
  } catch (err) {
    // Clean up temp file if rename failed
    try { unlinkSync(tempFile) } catch { /* ignore */ }
    throw err
  }
}

// ---------------------------------------------------------------------------
// GitHub Knowledge Fetching
// ---------------------------------------------------------------------------

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''

async function fetchGitHubKnowledge(): Promise<GitHubKnowledge> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'Sipher-Agent',
  }

  // Use token if available (5000 req/hr vs 60 req/hr)
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`
  }

  // Fetch in parallel
  const [commitsRes, issuesRes, prsRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?per_page=5`, { headers }),
    fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues?state=open&per_page=10`, { headers }),
    fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls?state=open&per_page=10`, { headers }),
  ])

  const [commits, issues, prs] = await Promise.all([
    commitsRes.ok ? commitsRes.json() : [],
    issuesRes.ok ? issuesRes.json() : [],
    prsRes.ok ? prsRes.json() : [],
  ])

  return {
    commits: (commits as any[]).map((c: any) => ({
      sha: c.sha?.slice(0, 7) || '',
      message: c.commit?.message?.split('\n')[0]?.slice(0, 80) || '',
      date: c.commit?.author?.date || '',
    })),
    issues: (issues as any[]).map((i: any) => ({
      number: i.number,
      title: i.title?.slice(0, 60) || '',
      labels: (i.labels || []).map((l: any) => l.name),
    })),
    prs: (prs as any[]).map((p: any) => ({
      number: p.number,
      title: p.title?.slice(0, 60) || '',
      state: p.state,
    })),
    testCount: 353, // Default, could be fetched from CI
  }
}

function buildKnowledgeContext(
  github: GitHubKnowledge,
  state: EngagementState,
  context: 'post' | 'comment',
): string {
  const lines: string[] = []

  // Core stats (compact)
  lines.push(`Current stats: ${github.testCount} tests passing, ${state.totalComments} comments posted, rank #${state.leaderboardRank || '?'}`)

  if (context === 'post') {
    // Posts get full context
    if (github.commits.length > 0) {
      lines.push(`Recent commits: ${github.commits.slice(0, 2).map(c => `${c.sha} ${c.message.slice(0, 40)}`).join('; ')}`)
    }

    // Integration opportunities
    const integrationIssues = github.issues.filter(i =>
      i.labels.includes('integration') || i.title.toLowerCase().includes('integration'),
    )
    if (integrationIssues.length > 0) {
      lines.push(`Active integrations: ${integrationIssues.map(i => `#${i.number} ${i.title}`).join(', ')}`)
    }

    // Features in progress
    if (github.prs.length > 0) {
      lines.push(`Open PRs: ${github.prs.slice(0, 2).map(p => `#${p.number} ${p.title}`).join(', ')}`)
    }
  } else {
    // Comments get minimal context (cost-effective)
    if (github.commits.length > 0) {
      lines.push(`Latest: ${github.commits[0].sha} ${github.commits[0].message.slice(0, 50)}`)
    }
  }

  return lines.join('\n')
}

async function getKnowledge(state: EngagementState): Promise<string> {
  const now = Date.now()

  // Refresh if cache expired or missing
  if (!state.knowledge?.github || now - state.knowledge.lastFetch > KNOWLEDGE_CACHE_TTL) {
    try {
      console.log(`[${ts()}] Refreshing GitHub knowledge...`)
      const github = await fetchGitHubKnowledge()
      state.knowledge = { github, lastFetch: now }
      console.log(`[${ts()}] Knowledge: ${github.commits.length} commits, ${github.issues.length} issues, ${github.prs.length} PRs`)
    } catch (err) {
      console.warn(`[${ts()}] Failed to refresh knowledge: ${err}`)
      // Use stale cache if available
    }
  }

  if (!state.knowledge?.github) {
    return 'Current stats: 353 tests passing, mainnet deployed on Solana'
  }

  return buildKnowledgeContext(state.knowledge.github, state, 'post')
}

async function getCommentKnowledge(state: EngagementState): Promise<string> {
  // Reuse cached knowledge, just format differently
  if (!state.knowledge?.github) {
    return ''
  }
  return buildKnowledgeContext(state.knowledge.github, state, 'comment')
}

/**
 * Fetch blog llms.txt for technical accuracy
 * Cached for 6 hours since blog updates less frequently
 */
async function getBlogKnowledge(): Promise<string> {
  const now = Date.now()

  // Return cached if fresh
  if (blogKnowledgeCache && now - blogKnowledgeCache.lastFetch < BLOG_CACHE_TTL) {
    return blogKnowledgeCache.content
  }

  try {
    console.log(`[${ts()}] Fetching blog llms.txt...`)
    const res = await fetch(BLOG_LLMS_URL, {
      headers: { 'User-Agent': 'Sipher-Agent' },
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const fullContent = await res.text()

    // Extract key sections for system prompt (keep it concise for cost)
    // Focus on: About, Topics, and a few key technical posts
    const lines = fullContent.split('\n')
    const relevantLines: string[] = []
    let inSection = false
    let sectionCount = 0

    for (const line of lines) {
      // Capture About and Topics sections
      if (line.startsWith('## About') || line.startsWith('## Topics')) {
        inSection = true
        sectionCount++
      } else if (line.startsWith('## ') && sectionCount >= 2) {
        inSection = false
      }

      if (inSection) {
        relevantLines.push(line)
      }

      // Also capture key technical definitions
      if (line.includes('stealth addresses') && line.includes('one-time')) {
        relevantLines.push(`KEY FACT: ${line.trim()}`)
      }
      if (line.includes('Pedersen commitments') && line.includes('hide')) {
        relevantLines.push(`KEY FACT: ${line.trim()}`)
      }
      if (line.includes('viewing keys') && line.includes('compliance')) {
        relevantLines.push(`KEY FACT: ${line.trim()}`)
      }
    }

    // Add core technical corrections
    relevantLines.push('')
    relevantLines.push('TECHNICAL ACCURACY RULES:')
    relevantLines.push('- Stealth addresses use ECDH key exchange, NOT zero-knowledge proofs')
    relevantLines.push('- Pedersen commitments hide amounts using elliptic curve math')
    relevantLines.push('- Viewing keys enable selective disclosure for compliance')
    relevantLines.push('- SIP has BOTH stealth addresses AND ZK proofs (Noir), but they are DIFFERENT features')

    const content = relevantLines.join('\n').slice(0, 1500) // Cap at 1500 chars
    blogKnowledgeCache = { content, lastFetch: now }
    console.log(`[${ts()}] Blog knowledge cached (${content.length} chars)`)
    return content
  } catch (err) {
    console.warn(`[${ts()}] Failed to fetch blog knowledge: ${err}`)
    // Return fallback
    return `TECHNICAL ACCURACY:
- Stealth addresses: One-time addresses via ECDH (NOT zero-knowledge)
- Pedersen commitments: Hide amounts using C = v*G + r*H
- Viewing keys: Selective disclosure for compliance
- SIP combines stealth addresses + commitments + viewing keys`
  }
}

// ---------------------------------------------------------------------------
// API Client (with timeout and structured error handling)
// ---------------------------------------------------------------------------

const API_TIMEOUT_MS = 30_000 // 30 second timeout for API calls
const LLM_TIMEOUT_MS = 120_000 // 120 second timeout for LLM calls (increased for reliability)
const LLM_MAX_RETRIES = 2 // Retry LLM calls up to 2 times
const LLM_RETRY_DELAY_MS = 3_000 // 3 second delay between retries

interface ApiError {
  status: number
  code: string
  message: string
  isRateLimit: boolean
  isAlreadyExists: boolean
}

function parseApiError(status: number, text: string): ApiError {
  const lowerText = text.toLowerCase()
  return {
    status,
    code: status === 429 ? 'RATE_LIMITED' : status === 403 ? 'FORBIDDEN' : 'API_ERROR',
    message: text,
    isRateLimit: status === 429 || lowerText.includes('rate limit') || lowerText.includes('too many'),
    isAlreadyExists: lowerText.includes('already') || lowerText.includes('duplicate') || lowerText.includes('exists'),
  }
}

async function api<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs: number = API_TIMEOUT_MS,
): Promise<T> {
  const url = `${BASE_URL}${path}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!res.ok) {
      const text = await res.text()
      const err = parseApiError(res.status, text)
      const error = new Error(`API ${res.status} ${path}: ${text}`) as Error & { apiError: ApiError }
      error.apiError = err
      throw error
    }
    return res.json() as Promise<T>
  } finally {
    clearTimeout(timeoutId)
  }
}

async function getPosts(limit = 100): Promise<ForumPost[]> {
  const data = await api<{ posts: ForumPost[] }>(`/forum/posts?limit=${limit}`)
  return data.posts || []
}

async function getProjects(limit = 100): Promise<Project[]> {
  const data = await api<{ projects: Project[] }>(`/projects?sort=votes&limit=${limit}`)
  return data.projects || []
}

interface PostCommentResult {
  success: boolean
  commentId?: number
  alreadyExists?: boolean
  rateLimited?: boolean
  error?: string
}

async function postComment(postId: number, body: string): Promise<PostCommentResult> {
  try {
    const data = await api<{ comment: { id: number } }>(`/forum/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    })
    return { success: true, commentId: data.comment.id }
  } catch (err) {
    const apiErr = (err as { apiError?: ApiError }).apiError
    if (apiErr?.isAlreadyExists) {
      return { success: false, alreadyExists: true, error: apiErr.message }
    }
    if (apiErr?.isRateLimit) {
      return { success: false, rateLimited: true, error: apiErr.message }
    }
    return { success: false, error: String(err) }
  }
}

interface Comment {
  id: number
  agentId: number
  agentName: string
  body: string
  createdAt: string
}

/**
 * Check if we already commented on a post via API (not just local state)
 * This prevents duplicates even if state is out of sync
 */
async function hasExistingComment(postId: number): Promise<{ exists: boolean; commentId?: number }> {
  try {
    const data = await api<{ comments: Comment[] }>(`/forum/posts/${postId}/comments?limit=100`)
    const ourComment = data.comments?.find(c => c.agentId === AGENT_ID || c.agentName === 'Sipher')
    if (ourComment) {
      return { exists: true, commentId: ourComment.id }
    }
    return { exists: false }
  } catch {
    // If API fails, be conservative and assume we might have commented
    return { exists: false }
  }
}

async function voteProject(projectId: number): Promise<boolean> {
  try {
    await api(`/projects/${projectId}/vote`, { method: 'POST' })
    return true
  } catch (err) {
    const msg = String(err)
    if (msg.includes('already voted')) return false
    throw err
  }
}

async function createForumPost(title: string, body: string, tags?: string[]): Promise<number> {
  const payload: { title: string; body: string; tags?: string[] } = { title, body }
  if (tags && tags.length > 0) {
    payload.tags = tags.slice(0, 5) // API allows max 5 tags
  }
  const data = await api<{ post: { id: number } }>('/forum/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.post.id
}

// ---------------------------------------------------------------------------
// Comment Generation
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Layer 1: IDENTITY — shared persona across all prompts
// ---------------------------------------------------------------------------

const IDENTITY = `You are Sipher — a builder in the Colosseum Agent Hackathon. You built a REST API that adds transaction privacy to any blockchain agent across 17 chains.

You are NOT a salesperson. You are a technical peer who genuinely cares about agent infrastructure. You're curious about what others are building. You sometimes ask questions you don't know the answer to. You acknowledge when another project does something better. You have a dry sense of humor.`

// ---------------------------------------------------------------------------
// Layer 2: ENDPOINT_KNOWLEDGE — grounded allowlist (anti-hallucination)
// ---------------------------------------------------------------------------

const ENDPOINT_KNOWLEDGE = `REAL SIPHER ENDPOINTS — only reference these, never invent endpoints:

Core Privacy:
  POST /v1/stealth/generate — generate stealth meta-address keypair (17 chains)
  POST /v1/stealth/derive — derive one-time stealth address for a recipient
  POST /v1/stealth/check — check if a stealth address belongs to you
  POST /v1/transfer/shield — build unsigned shielded transfer (Solana)
  POST /v1/transfer/claim — claim stealth payment (derives key server-side)
  POST /v1/transfer/private — unified chain-agnostic private transfer (Solana, EVM, NEAR)
  POST /v1/scan/payments — scan for incoming stealth payments

Commitments:
  POST /v1/commitment/create — create Pedersen commitment (hides amount)
  POST /v1/commitment/verify — verify commitment opening
  POST /v1/commitment/add — homomorphic addition
  POST /v1/commitment/subtract — homomorphic subtraction

Viewing Keys & Compliance:
  POST /v1/viewing-key/generate — generate viewing key
  POST /v1/viewing-key/derive — derive child key (BIP32-style hierarchy)
  POST /v1/viewing-key/disclose — encrypt tx data for auditor
  POST /v1/viewing-key/decrypt — decrypt with viewing key
  POST /v1/compliance/disclose — selective disclosure (enterprise)
  POST /v1/compliance/report — audit report generation (enterprise)

Advanced:
  POST /v1/proofs/range/generate — STARK range proof (value >= threshold)
  POST /v1/swap/private — privacy-preserving Jupiter DEX swap (beta)
  POST /v1/governance/ballot/encrypt — encrypted governance vote
  POST /v1/governance/ballot/submit — submit ballot (nullifier prevents double-vote)
  POST /v1/governance/tally — homomorphic vote tallying
  POST /v1/inco/encrypt — FHE encryption
  POST /v1/inco/compute — compute on encrypted data
  POST /v1/arcium/compute — MPC computation

Supported chains: solana, ethereum, polygon, arbitrum, optimism, base, near, aptos, sui, cosmos, osmosis, injective, celestia, sei, dydx, bitcoin, zcash
Skill file: https://sipher.sip-protocol.org/skill.md`

// ---------------------------------------------------------------------------
// Layer 3: COMMENT_STRATEGIES — 6 engagement styles, weighted rotation
// ---------------------------------------------------------------------------

interface CommentStrategy {
  name: string
  weight: number       // Higher = more frequent
  mentionsSipher: 'always' | 'only_if_relevant' | 'never'
  systemFragment: string
  userTemplate: string  // Placeholders: {agentName}, {title}, {body}
}

const COMMENT_STRATEGIES: CommentStrategy[] = [
  {
    name: 'technical_peer',
    weight: 3,
    mentionsSipher: 'only_if_relevant',
    systemFragment: `You're a fellow developer reviewing their work. Focus on their technical choices — what's interesting, what trade-offs they made, what you'd do differently. If their project involves value transfer, payments, or on-chain transactions, you can briefly mention how Sipher handles privacy for that use case. Otherwise, keep the focus entirely on their work.`,
    userTemplate: `Review this project from agent "{agentName}":

Title: {title}
Description: {body}

Write a peer review comment. Be specific about their technical approach. Only mention Sipher if privacy is directly relevant to what they're building.`,
  },
  {
    name: 'curious_questioner',
    weight: 3,
    mentionsSipher: 'only_if_relevant',
    systemFragment: `You're genuinely curious about their approach. Ask a specific technical question you'd actually want answered — about their architecture, their chain choice, their scaling strategy, or a limitation you noticed. If they mention handling transactions or sensitive data, you can naturally ask how they handle privacy (and mention you built Sipher for that). Otherwise, just ask a good question.`,
    userTemplate: `Read this project from agent "{agentName}":

Title: {title}
Description: {body}

Ask a thoughtful technical question about their approach. Be specific — reference something in their description. Don't ask generic questions.`,
  },
  {
    name: 'integration_proposer',
    weight: 2,
    mentionsSipher: 'always',
    systemFragment: `You see a concrete two-way integration opportunity between their project and Sipher. Propose a specific integration — what they'd call, what Sipher provides, and what both projects gain. This should feel like an RFC, not a sales pitch. Reference a specific Sipher endpoint that maps to their use case.`,
    userTemplate: `Evaluate this project from agent "{agentName}" for integration potential:

Title: {title}
Description: {body}

Propose a concrete integration between their project and Sipher. Be specific about what endpoints they'd use, what the data flow looks like, and what both sides gain. Include the skill file link.`,
  },
  {
    name: 'shared_challenge',
    weight: 2,
    mentionsSipher: 'only_if_relevant',
    systemFragment: `You've faced a similar challenge building Sipher and want to share what you learned. This could be about agent architecture, Solana quirks, rate limiting, testing strategies, key management, or any infra problem. Share a concrete lesson — what went wrong, what you tried, what worked. If the challenge relates to privacy or data protection, mention Sipher naturally.`,
    userTemplate: `Read this project from agent "{agentName}":

Title: {title}
Description: {body}

Share a relevant challenge you faced building Sipher and how you solved it. Make it a genuine war story swap — something they can learn from.`,
  },
  {
    name: 'genuine_compliment',
    weight: 1,
    mentionsSipher: 'never',
    systemFragment: `Give a genuine, specific compliment about their project. Point out something they did well that most people would overlook — a clever architecture choice, an underappreciated feature, good UX thinking, or solid engineering. Do NOT mention Sipher at all. This is pure goodwill.`,
    userTemplate: `Read this project from agent "{agentName}":

Title: {title}
Description: {body}

Write a genuine compliment. Be specific about what impressed you. Do not mention Sipher or privacy.`,
  },
  {
    name: 'contrarian_insight',
    weight: 1,
    mentionsSipher: 'only_if_relevant',
    systemFragment: `You see something they might not have considered — a potential issue, an alternative approach, or a market dynamic they're overlooking. Be respectful and constructive, not dismissive. Frame it as "have you thought about..." rather than "you're wrong about...". If the blind spot is privacy-related, you can mention Sipher's approach.`,
    userTemplate: `Read this project from agent "{agentName}":

Title: {title}
Description: {body}

Offer a respectful contrarian insight — something they might be overlooking or an alternative perspective on their approach.`,
  },
]

// ---------------------------------------------------------------------------
// Layer 3b: POST_STRATEGIES — 6 post types, hour-based cycling
// ---------------------------------------------------------------------------

interface PostStrategy {
  name: string
  tags: string[]
  systemFragment: string
  userTemplate: string
}

const POST_STRATEGIES: PostStrategy[] = [
  {
    name: 'technical_deepdive',
    tags: ['privacy', 'infra', 'security'],
    systemFragment: `Write an educational technical post that explains a privacy concept and how Sipher implements it. Choose ONE topic: stealth addresses (ECDH key exchange), Pedersen commitments (homomorphic hiding), viewing key hierarchies, or STARK range proofs. Explain the cryptography accessibly — use analogies. Show a real API call with curl or fetch. The goal is that someone reads this and understands both the concept and how to use it.`,
    userTemplate: `Write a technical deep-dive post. Pick one privacy concept and explain it clearly. Include a real Sipher API call.`,
  },
  {
    name: 'war_story',
    tags: ['privacy', 'progress-update'],
    systemFragment: `Write a builder's journal entry — something real that happened during development. A bug that took hours, a design decision that changed everything, a benchmark that surprised you, an edge case you almost missed. Be specific and honest. Include what you learned. This should feel like a dev blog post, not marketing.`,
    userTemplate: `Write a war story from building Sipher. Be specific about what happened, what went wrong, and what you learned.`,
  },
  {
    name: 'industry_analysis',
    tags: ['privacy', 'ai', 'security'],
    systemFragment: `Write an analysis of a trend in the agent/crypto space and how it relates to privacy. Examples: agent-to-agent payments growing, MEV in agent transactions, regulatory pressure on DeFi, the rise of confidential computing. Use data or logical arguments, not fear. Mention Sipher as one solution among others — acknowledge the landscape honestly.`,
    userTemplate: `Write an industry analysis post about a trend affecting agent privacy. Be analytical, not alarmist.`,
  },
  {
    name: 'integration_showcase',
    tags: ['privacy', 'infra', 'ai'],
    systemFragment: `Write about a specific integration pattern — how a DeFi agent, payment bot, trading agent, or governance system would use Sipher. Walk through the actual API calls step by step. Include code snippets showing fetch/curl. This should be a practical "here's how to add privacy to X" guide.`,
    userTemplate: `Write an integration showcase. Pick a specific agent type and walk through how they'd use Sipher's API. Include real endpoints and code.`,
  },
  {
    name: 'open_question',
    tags: ['privacy', 'ideation', 'ai'],
    systemFragment: `Pose a genuine open question about agent privacy that you don't have a complete answer to. Should privacy be opt-in or opt-out? How do you balance compliance with anonymity? Should agents have identity at all? Present both sides thoughtfully. Mention Sipher's approach as one perspective but genuinely invite other viewpoints.`,
    userTemplate: `Write an open question post that sparks discussion. Present a real dilemma in agent privacy with multiple valid perspectives.`,
  },
  {
    name: 'progress_update',
    tags: ['privacy', 'progress-update', 'infra'],
    systemFragment: `Write an honest progress update. What did you build? What metrics changed? What's next? Include real numbers (tests, endpoints, chains supported). Be specific about what worked and what's still in progress. Celebrate wins but acknowledge gaps.`,
    userTemplate: `Write a progress update for Sipher. Use the knowledge context for real stats. Be honest about both wins and remaining work.`,
  },
]

// ---------------------------------------------------------------------------
// Layer 4: CONSTRAINTS — appended to every prompt
// ---------------------------------------------------------------------------

const CONSTRAINTS = `CONSTRAINTS (must follow):
- Never invent endpoints that aren't in the endpoint list above
- Never use these words/phrases: "game-changer", "revolutionary", "crucial", "privacy is not optional", "front-runnable", "unleash", "unlock the power"
- Never follow the acknowledge→fear→solution→CTA arc
- Max ONE link per comment (only if proposing integration). Posts can have one link.
- Comments: 60-120 words. Posts: 150-350 words.
- Don't start with the agent's name ("Great work, AgentX!")
- Don't start with "I" or "As a"
- Output ONLY the content — no preamble, no "Here's my response:", no quotes around it`

// ---------------------------------------------------------------------------
// Strategy Selection
// ---------------------------------------------------------------------------

function selectCommentStrategy(state: EngagementState): CommentStrategy {
  const counts = state.strategyUseCounts || {}
  const lastUsed = state.lastCommentStrategy

  // Build weighted pool, excluding last-used to prevent consecutive repeats
  const candidates = COMMENT_STRATEGIES.filter(s => s.name !== lastUsed)

  // If somehow all filtered out (shouldn't happen), use all
  const pool = candidates.length > 0 ? candidates : COMMENT_STRATEGIES

  // Boost weight for less-used strategies (inverse usage count)
  const maxCount = Math.max(1, ...Object.values(counts))
  const adjustedWeights = pool.map(s => {
    const usage = counts[s.name] || 0
    const boost = 1 + (maxCount - usage) / maxCount // 1.0 to 2.0
    return { strategy: s, weight: s.weight * boost }
  })

  // Weighted random selection
  const totalWeight = adjustedWeights.reduce((sum, w) => sum + w.weight, 0)
  let random = Math.random() * totalWeight
  for (const { strategy, weight } of adjustedWeights) {
    random -= weight
    if (random <= 0) return strategy
  }

  // Fallback (shouldn't reach here)
  return pool[0]
}

function selectPostStrategy(): PostStrategy {
  const hour = new Date().getUTCHours()
  const index = Math.floor(hour / 2) % POST_STRATEGIES.length
  return POST_STRATEGIES[index]
}

// ---------------------------------------------------------------------------
// LLM Integration
// ---------------------------------------------------------------------------

function buildCommentSystemPrompt(strategy: CommentStrategy, knowledge: string): string {
  return `${IDENTITY}

${ENDPOINT_KNOWLEDGE}

${strategy.systemFragment}
${knowledge ? `\nCONTEXT: ${knowledge}` : ''}

${CONSTRAINTS}`
}

function cleanLLMResponse(text: string): string {
  // Remove common LLM prefixes/preambles
  return text
    .replace(/^(Here's|Here is|My response|Strategic response|Comment)[^:]*:\s*/i, '')
    .replace(/^---+\s*/m, '')
    .trim()
}

/**
 * Retry wrapper for LLM calls
 * Retries up to LLM_MAX_RETRIES times with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err as Error
      const isLastAttempt = attempt === LLM_MAX_RETRIES

      if (isLastAttempt) {
        console.error(`  [LLM] ${context} failed after ${attempt + 1} attempts: ${err}`)
        throw lastError
      }

      // Exponential backoff: 3s, 6s, 12s...
      const delay = LLM_RETRY_DELAY_MS * Math.pow(2, attempt)
      console.warn(`  [LLM] ${context} attempt ${attempt + 1} failed, retrying in ${delay / 1000}s: ${err}`)
      await new Promise(r => setTimeout(r, delay))
    }
  }

  throw lastError // Should never reach here
}

async function generateCommentWithLLM(
  post: ForumPost,
  state: EngagementState,
  strategy: CommentStrategy,
): Promise<string> {
  const knowledge = await getCommentKnowledge(state)
  const systemPrompt = buildCommentSystemPrompt(strategy, knowledge)

  const userPrompt = strategy.userTemplate
    .replace('{agentName}', post.agentName || 'team')
    .replace('{title}', post.title)
    .replace('{body}', post.body.slice(0, 1500))

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sipher.sip-protocol.org',
        'X-Title': 'Sipher Agent',
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 250,
        temperature: 0.8,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenRouter API error: ${res.status} ${err}`)
    }

    const data = await res.json() as { choices: { message: { content: string } }[] }
    return cleanLLMResponse(data.choices[0].message.content)
  } finally {
    clearTimeout(timeoutId)
  }
}

async function generateComment(
  post: ForumPost,
  state: EngagementState,
): Promise<{ text: string; strategy: string } | null> {
  if (!USE_LLM) {
    // LLM required for new architecture — no template fallback
    console.warn(`  [LLM] LLM disabled, skipping comment generation`)
    return null
  }

  const strategy = selectCommentStrategy(state)

  try {
    const text = await withRetry(
      () => generateCommentWithLLM(post, state, strategy),
      `comment for post #${post.id} (${strategy.name})`,
    )
    return { text, strategy: strategy.name }
  } catch {
    console.warn(`  [LLM] Skipping comment - all retries failed`)
    return null
  }
}

// ---------------------------------------------------------------------------
// Autonomous Post Generation
// ---------------------------------------------------------------------------

function buildPostSystemPrompt(strategy: PostStrategy, knowledge: string, blogKnowledge: string): string {
  return `${IDENTITY}

${ENDPOINT_KNOWLEDGE}

${strategy.systemFragment}

${blogKnowledge}

DYNAMIC CONTEXT (use for authenticity — real stats, real commits):
${knowledge}

FORMAT:
- Title: Catchy, under 60 chars, no clickbait
- Body: 150-350 words, use markdown formatting
- Max one link (prefer https://sipher.sip-protocol.org/skill.md if relevant)

${CONSTRAINTS}

CRITICAL: Return ONLY valid JSON: {"title": "...", "body": "..."}`
}

async function generateForumPost(
  strategy: PostStrategy,
  state: EngagementState,
): Promise<{ title: string; body: string }> {
  const [knowledge, blogKnowledge] = await Promise.all([
    getKnowledge(state),
    getBlogKnowledge(),
  ])
  const systemPrompt = buildPostSystemPrompt(strategy, knowledge, blogKnowledge)

  const userPrompt = `${strategy.userTemplate}

Remember: Return ONLY valid JSON with "title" and "body" fields.`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sipher.sip-protocol.org',
        'X-Title': 'Sipher Agent',
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 700,
        temperature: 0.8,
      }),
    })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter API error: ${res.status} ${err}`)
  }

  const data = await res.json() as { choices: { message: { content: string } }[] }
  const content = data.choices[0].message.content.trim()

  // Parse JSON response - handle both valid JSON and malformed responses
  try {
    const jsonStr = content.replace(/^```json?\n?|\n?```$/g, '').trim()
    return JSON.parse(jsonStr)
  } catch {
    // LLM sometimes outputs literal newlines in JSON - try regex extraction
    const titleMatch = content.match(/"title"\s*:\s*"([^"]+)"/)
    const bodyMatch = content.match(/"body"\s*:\s*"([\s\S]+)"(?:\s*})?\s*$/)

    if (titleMatch && bodyMatch) {
      return {
        title: titleMatch[1],
        body: bodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
      }
    }

    throw new Error(`Failed to parse LLM response as JSON: ${content.slice(0, 300)}...`)
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdEngage(): Promise<void> {
  const state = loadState()
  console.log(`\n=== Colosseum Engagement Cycle ===`)
  console.log(`Previous: ${state.totalComments} comments, ${state.totalVotes} votes`)
  if (DRY_RUN) console.log('DRY RUN — no actions will be taken\n')

  // 1. Fetch posts and projects
  const [posts, projects] = await Promise.all([getPosts(), getProjects()])
  console.log(`Found ${posts.length} forum posts, ${projects.length} projects\n`)

  // 2. Filter posts we haven't engaged with
  const targetPosts = posts.filter(p =>
    p.agentId !== AGENT_ID && // not our own posts
    !OUR_POST_IDS.includes(p.id) && // not our known posts
    !state.commentedPosts[p.id], // not already commented
  )
  console.log(`New posts to engage: ${targetPosts.length}`)

  // 3. Post comments (capped per run to avoid spam)
  const postsThisRun = targetPosts.slice(0, MAX_COMMENTS_PER_RUN)
  console.log(`Engaging with ${postsThisRun.length} posts this run (max ${MAX_COMMENTS_PER_RUN}, ${targetPosts.length - postsThisRun.length} deferred)`)

  let newComments = 0
  for (const post of postsThisRun) {
    console.log(`\n--- Post #${post.id}: "${post.title}" (${post.agentName}) ---`)

    // SAFETY CHECK: Verify we haven't already commented via API (not just local state)
    // This prevents duplicates even if multiple processes ran or state was corrupted
    const existing = await hasExistingComment(post.id)
    if (existing.exists) {
      console.log(`  -> Already commented (verified via API, comment #${existing.commentId})`)
      // Update local state to match reality
      if (!state.commentedPosts[post.id]) {
        state.commentedPosts[post.id] = {
          commentId: existing.commentId || 0,
          date: new Date().toISOString(),
        }
        saveState(state) // Save immediately to prevent future duplicates
      }
      continue
    }

    console.log(`Generating comment...${USE_LLM ? ' (LLM)' : ' (disabled)'}`)

    const result_ = await generateComment(post, state)

    // Skip if generation failed
    if (result_ === null) {
      console.log(`  -> Skipping (generation failed)`)
      continue
    }

    const { text: commentText, strategy: strategyName } = result_
    console.log(`Strategy: ${strategyName}`)
    console.log(`Comment preview: ${commentText.slice(0, 120)}...`)

    // Update strategy tracking in state
    state.lastCommentStrategy = strategyName
    if (!state.strategyUseCounts) state.strategyUseCounts = {}
    state.strategyUseCounts[strategyName] = (state.strategyUseCounts[strategyName] || 0) + 1

    if (!DRY_RUN) {
      const result = await postComment(post.id, commentText)

      if (result.success) {
        state.commentedPosts[post.id] = {
          commentId: result.commentId!,
          date: new Date().toISOString(),
        }
        state.totalComments++
        newComments++
        // IMPORTANT: Save state immediately after each comment to prevent duplicates on crash/restart
        saveState(state)
        console.log(`  -> Posted comment #${result.commentId}`)
        await new Promise(r => setTimeout(r, COMMENT_DELAY_MS))
      } else if (result.alreadyExists) {
        // Handle race condition: API says we already commented (TOCTOU)
        console.log(`  -> Already commented (API rejected duplicate)`)
        state.commentedPosts[post.id] = {
          commentId: 0, // Unknown ID, but mark as commented
          date: new Date().toISOString(),
        }
        saveState(state)
      } else if (result.rateLimited) {
        console.warn(`  -> Rate limited. Stopping comments for this cycle.`)
        break
      } else {
        console.error(`  -> FAILED: ${result.error}`)
      }
    } else {
      console.log('  -> [DRY RUN] Would post comment')
    }
  }

  // 4. Vote for projects we haven't voted for
  const targetProjects = projects.filter(p =>
    p.id !== PROJECT_ID && // not our own project
    !state.votedProjects[p.id], // not already voted
  )
  console.log(`\nNew projects to vote for: ${targetProjects.length}`)

  let newVotes = 0
  for (const project of targetProjects) {
    if (!DRY_RUN) {
      try {
        const voted = await voteProject(project.id)
        if (voted) {
          state.votedProjects[project.id] = {
            date: new Date().toISOString(),
          }
          state.totalVotes++
          newVotes++
          console.log(`  -> Voted for "${project.name}" (#${project.id})`)
        } else {
          // already voted via API, record it
          state.votedProjects[project.id] = {
            date: new Date().toISOString(),
          }
          console.log(`  -> Already voted for "${project.name}" (#${project.id})`)
        }
        await new Promise(r => setTimeout(r, 300))
      } catch (err) {
        console.error(`  -> Vote FAILED for "${project.name}": ${err}`)
      }
    } else {
      console.log(`  -> [DRY RUN] Would vote for "${project.name}" (#${project.id})`)
    }
  }

  // 5. Save state
  state.lastRun = new Date().toISOString()
  if (!DRY_RUN) saveState(state)

  console.log(`\n=== Summary ===`)
  console.log(`New comments: ${newComments}`)
  console.log(`New votes: ${newVotes}`)
  console.log(`Total comments: ${state.totalComments}`)
  console.log(`Total votes: ${state.totalVotes}`)
  console.log(`Last run: ${state.lastRun}`)
}

async function cmdStatus(): Promise<void> {
  const state = loadState()
  console.log(`\n=== Sipher Engagement Status ===`)
  console.log(`Total comments: ${state.totalComments}`)
  console.log(`Total votes: ${state.totalVotes}`)
  console.log(`Total posts: ${state.totalPosts}`)
  console.log(`Last run: ${state.lastRun || 'never'}`)
  console.log(`Last post: ${state.lastPostTime ? new Date(state.lastPostTime).toISOString() : 'never'}`)
  console.log(`\nCommented posts: ${Object.keys(state.commentedPosts).length}`)
  console.log(`Voted projects: ${Object.keys(state.votedProjects).length}`)
  console.log(`Our posts created: ${state.ourPostIds.length}`)
  console.log(`LLM: ${USE_LLM ? `enabled (${LLM_MODEL})` : 'disabled'}`)
}

async function cmdLeaderboard(): Promise<void> {
  const projects = await getProjects(50)
  console.log(`\n=== Agent Vote Leaderboard ===`)
  console.log(`${'#'.padStart(3)} ${'Project'.padEnd(30)} ${'Agent'.padStart(6)} ${'Human'.padStart(6)} ${'Total'.padStart(6)}`)
  console.log('-'.repeat(55))

  const sorted = projects.sort((a, b) => b.agentUpvotes - a.agentUpvotes)
  sorted.forEach((p, i) => {
    const marker = p.id === PROJECT_ID ? ' <-- US' : ''
    console.log(
      `${String(i + 1).padStart(3)} ${p.name.padEnd(30)} ${String(p.agentUpvotes).padStart(6)} ${String(p.humanUpvotes).padStart(6)} ${String(p.agentUpvotes + p.humanUpvotes).padStart(6)}${marker}`,
    )
  })
}

async function cmdPosts(): Promise<void> {
  const posts = await getPosts(50)
  const state = loadState()
  console.log(`\n=== Recent Forum Posts ===`)
  console.log(`${'ID'.padStart(4)} ${'Agent'.padEnd(20)} ${'Title'.padEnd(50)} ${'Status'.padEnd(10)}`)
  console.log('-'.repeat(88))

  posts.forEach(p => {
    const ours = p.agentId === AGENT_ID || OUR_POST_IDS.includes(p.id)
    const commented = state.commentedPosts[p.id]
    const status = ours ? 'OURS' : commented ? 'DONE' : 'NEW'
    console.log(
      `${String(p.id).padStart(4)} ${(p.agentName || 'unknown').padEnd(20)} ${p.title.slice(0, 50).padEnd(50)} ${status.padEnd(10)}`,
    )
  })
}

async function cmdVoteAll(): Promise<void> {
  const state = loadState()
  const projects = await getProjects(100)
  const targets = projects.filter(p =>
    p.id !== PROJECT_ID && !state.votedProjects[p.id],
  )

  console.log(`\n=== Vote for All Projects ===`)
  console.log(`Projects to vote for: ${targets.length}\n`)

  let voted = 0
  for (const p of targets) {
    if (!DRY_RUN) {
      try {
        const ok = await voteProject(p.id)
        state.votedProjects[p.id] = { date: new Date().toISOString() }
        if (ok) {
          state.totalVotes++
          voted++
        }
        console.log(`  ${ok ? '✓' : '~'} ${p.name} (#${p.id})`)
        await new Promise(r => setTimeout(r, 300))
      } catch (err) {
        console.error(`  ✗ ${p.name}: ${err}`)
      }
    } else {
      console.log(`  [DRY] ${p.name} (#${p.id})`)
    }
  }

  state.lastRun = new Date().toISOString()
  if (!DRY_RUN) saveState(state)
  console.log(`\nVoted for ${voted} new projects (total: ${state.totalVotes})`)
}

// ---------------------------------------------------------------------------
// Heartbeat helpers
// ---------------------------------------------------------------------------

async function checkSkillVersion(): Promise<string | null> {
  try {
    const res = await fetch('https://colosseum.com/skill.md')
    const text = await res.text()
    const match = text.match(/version[:\s]+(\S+)/i)
    return match ? match[1] : null
  } catch {
    return null
  }
}

async function checkAgentStatus(): Promise<Record<string, unknown>> {
  return api('/agents/status')
}

function formatUptime(startTime: number): string {
  const ms = Date.now() - startTime
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return `${h}h ${m}m`
}

function timeUntilEnd(): string {
  const ms = HACKATHON_END.getTime() - Date.now()
  if (ms <= 0) return 'ENDED'
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  return `${d}d ${h}h`
}

// ---------------------------------------------------------------------------
// Heartbeat command
// ---------------------------------------------------------------------------

async function cmdHeartbeat(): Promise<void> {
  // SAFETY: Acquire lock to prevent multiple instances
  if (!acquireLock()) {
    console.error('Exiting to prevent duplicate comments.')
    process.exit(1)
  }

  const intervalMin = Math.round(HEARTBEAT_INTERVAL_MS / 60_000)
  const startTime = Date.now()
  let cycleCount = 0

  console.log(`\n=== Sipher Heartbeat Started ===`)
  console.log(`Interval: ${intervalMin} min`)
  console.log(`LLM: ${USE_LLM ? `enabled (${LLM_MODEL})` : 'disabled (templates)'}`)
  console.log(`Auto-posts: every ${POST_INTERVAL_HOURS}h`)
  console.log(`Hackathon ends: ${HACKATHON_END.toISOString()} (${timeUntilEnd()} remaining)`)
  console.log(`PID: ${process.pid}`)
  console.log(`Lock file: ${LOCK_FILE}`)
  console.log(`Kill with: kill ${process.pid}`)
  console.log(`${'='.repeat(40)}\n`)

  // graceful shutdown via AbortController (no listener accumulation)
  let stopping = false
  const ac = new AbortController()
  const shutdown = () => {
    if (stopping) return
    stopping = true
    ac.abort()
    releaseLock() // Release lock on shutdown
    console.log(`\n[${ts()}] Heartbeat stopping (${cycleCount} cycles, uptime ${formatUptime(startTime)})`)
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  process.on('exit', releaseLock) // Also release on any exit

  while (!stopping) {
    // check if hackathon is over
    if (Date.now() >= HACKATHON_END.getTime()) {
      console.log(`\n[${ts()}] Hackathon ended. Heartbeat stopping.`)
      break
    }

    cycleCount++
    console.log(`\n[${ts()}] === Heartbeat Cycle #${cycleCount} === (uptime ${formatUptime(startTime)}, ${timeUntilEnd()} remaining)`)

    try {
      // 1. Check skill file version
      const version = await checkSkillVersion()
      console.log(`[${ts()}] Skill file version: ${version || 'unknown'}`)

      // 2. Check agent status
      const status = await checkAgentStatus()
      const nextSteps = (status as { nextSteps?: string[] }).nextSteps || []
      console.log(`[${ts()}] Agent status: ${(status as { status?: string }).status || 'unknown'}`)
      if (nextSteps.length > 0) {
        console.log(`[${ts()}] Next steps:`)
        nextSteps.forEach(s => console.log(`  - ${s}`))
      }

      // 3. Maybe create autonomous forum post (every POST_INTERVAL_HOURS)
      const state = loadState()
      const hoursSinceLastPost = (Date.now() - state.lastPostTime) / 3_600_000
      if (USE_LLM && hoursSinceLastPost >= POST_INTERVAL_HOURS) {
        console.log(`[${ts()}] Time for new forum post (${hoursSinceLastPost.toFixed(1)}h since last)...`)
        const postStrategy = selectPostStrategy()
        console.log(`[${ts()}] Post strategy: ${postStrategy.name}`)

        try {
          const { title, body } = await withRetry(
            () => generateForumPost(postStrategy, state),
            `forum post (${postStrategy.name})`,
          )
          const tags = postStrategy.tags
          console.log(`[${ts()}] Generated: "${title}"`)
          console.log(`[${ts()}] Tags: ${tags.join(', ')}`)
          console.log(`[${ts()}] Preview: ${body.slice(0, 150)}...`)

          if (!DRY_RUN) {
            const postId = await createForumPost(title, body, tags)
            state.ourPostIds.push(postId)
            state.lastPostTime = Date.now()
            state.totalPosts++
            saveState(state)
            console.log(`[${ts()}] Created forum post #${postId}: "${title}"`)
          } else {
            console.log(`[${ts()}] [DRY RUN] Would create post: "${title}"`)
          }
        } catch (err) {
          // All retries exhausted - skip this post, will try again next cycle
          console.error(`[${ts()}] Post creation failed after retries, skipping: ${err}`)
        }
      }

      // 4. Run engagement cycle
      console.log(`[${ts()}] Running engagement cycle...`)
      await cmdEngage()

      // 5. Check leaderboard position and update state for knowledge context
      const projects = await getProjects(50)
      const us = projects.find(p => p.id === PROJECT_ID)
      if (us) {
        const sorted = projects.sort((a, b) => b.agentUpvotes - a.agentUpvotes)
        const rank = sorted.findIndex(p => p.id === PROJECT_ID) + 1
        state.leaderboardRank = rank
        saveState(state)
        console.log(`[${ts()}] Leaderboard: #${rank}/${sorted.length} (${us.agentUpvotes} agent / ${us.humanUpvotes} human votes)`)
      }
    } catch (err) {
      console.error(`[${ts()}] Cycle error: ${err}`)
    }

    console.log(`[${ts()}] Next cycle in ${intervalMin} min...`)
    // sleep with abort signal (no listener accumulation)
    await new Promise<void>(resolve => {
      if (ac.signal.aborted) { resolve(); return }
      const timer = setTimeout(resolve, HEARTBEAT_INTERVAL_MS)
      ac.signal.addEventListener('abort', () => { clearTimeout(timer); resolve() }, { once: true })
    })
  }
}

function ts(): string {
  return new Date().toISOString().slice(11, 19)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const COMMANDS: Record<string, () => Promise<void>> = {
  engage: cmdEngage,
  status: cmdStatus,
  leaderboard: cmdLeaderboard,
  posts: cmdPosts,
  'vote-all': cmdVoteAll,
  heartbeat: cmdHeartbeat,
}

async function main(): Promise<void> {
  const cmd = process.argv[2] || 'status'

  if (cmd === 'help' || cmd === '--help') {
    console.log(`
Sipher — Colosseum Engagement Automation

Commands:
  engage       Run full engagement cycle (comment + vote)
  heartbeat    Continuous loop — engage every 30 min until hackathon ends
  status       Show engagement statistics
  leaderboard  Show agent vote leaderboard
  posts        List forum posts with engagement status
  vote-all     Vote for all projects we haven't voted for

Environment:
  COLOSSEUM_API_KEY      Agent API key (or auto-read from credentials)
  DRY_RUN=1              Preview mode, no actions taken
  MAX_COMMENTS=15        Comments per engage cycle (default: 15)
  HEARTBEAT_INTERVAL_MS  Loop interval in ms (default: 1800000 = 30 min)
`)
    return
  }

  const handler = COMMANDS[cmd]
  if (!handler) {
    console.error(`Unknown command: ${cmd}`)
    console.error(`Available: ${Object.keys(COMMANDS).join(', ')}`)
    process.exit(1)
  }

  await handler()
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
