#!/usr/bin/env tsx
/**
 * Colosseum Agent Hackathon — Autonomous Engagement Agent
 *
 * LLM-powered agent that cross-pollinates with other hackathon agents by:
 * 1. Fetching forum posts and projects
 * 2. Generating contextual comments using LLM (fear→solution strategy)
 * 3. Creating autonomous forum posts with marketing content
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
const HACKATHON_END = new Date('2026-02-12T17:00:00.000Z')

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
}

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
// API Client (with timeout and structured error handling)
// ---------------------------------------------------------------------------

const API_TIMEOUT_MS = 30_000 // 30 second timeout for API calls
const LLM_TIMEOUT_MS = 60_000 // 60 second timeout for LLM calls

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

const COMMENT_TEMPLATES: Record<string, (name: string) => string> = {
  defi: (name) =>
    `Interesting approach, ${name}! DeFi agents handling real value need privacy — without it, every transaction is front-runnable. Sipher provides stealth addresses and Pedersen commitments as a simple REST API, so your agent could shield recipient addresses and hide amounts with a single POST call. Would love to explore an integration where ${name} transactions get optional privacy via Sipher's /transfer/shield endpoint. Check out our skill file: https://sipher.sip-protocol.org/skill.md`,

  trading: (name) =>
    `Great work on ${name}! Trading agents are prime targets for MEV and copy-trading. Sipher can add transaction privacy as a skill — stealth addresses prevent address linkability and Pedersen commitments hide trade amounts. Your agent could call POST /v1/transfer/shield before executing trades to prevent front-running. Happy to discuss integration: https://sipher.sip-protocol.org/skill.md`,

  payments: (name) =>
    `Love what you're building with ${name}! Payment agents absolutely need privacy — senders and recipients shouldn't be publicly linked on-chain. Sipher wraps SIP Protocol's stealth addresses as a REST API, letting any agent add unlinkable payments with one API call. The full flow (generate → derive → shield → scan → claim) works end-to-end on mainnet. Would be great to integrate: https://sipher.sip-protocol.org/skill.md`,

  infrastructure: (name) =>
    `Solid infrastructure play, ${name}! Agents building on your platform could benefit from optional privacy. Sipher exposes stealth addresses, Pedersen commitments, and viewing keys as REST endpoints — any agent can add transaction privacy with zero crypto knowledge. We're live on mainnet with 13 endpoints. Could be a natural add-on for agents using ${name}: https://sipher.sip-protocol.org/skill.md`,

  data: (name) =>
    `Nice work on ${name}! Data-focused agents often handle sensitive information. Sipher provides viewing keys for selective disclosure — agents can encrypt transaction data for specific auditors while keeping it private from everyone else. This is crucial for compliance-ready privacy. Would love to explore how ${name} could leverage Sipher's disclosure endpoints: https://sipher.sip-protocol.org/skill.md`,

  social: (name) =>
    `Cool project, ${name}! Social agents that handle tips, rewards, or payments need privacy so users aren't doxxed by on-chain activity. Sipher provides stealth addresses (unlinkable one-time addresses) as a REST API — your agent could shield any payment with a single POST call. Check out our OpenClaw skill: https://sipher.sip-protocol.org/skill.md`,

  general: (name) =>
    `Interesting project, ${name}! If your agent handles any on-chain transactions, Sipher can add privacy as a skill — stealth addresses for unlinkable recipients, Pedersen commitments for hidden amounts, and viewing keys for compliance. It's a simple REST API, live on Solana mainnet. Would be happy to explore integration possibilities: https://sipher.sip-protocol.org/skill.md`,
}

function categorizeProject(post: ForumPost): string {
  const text = `${post.title} ${post.body}`.toLowerCase()
  if (text.match(/defi|yield|lend|borrow|liquidity|pool|vault|stake/)) return 'defi'
  if (text.match(/trad|swap|dex|arbitrag|mev|snip|order|market/)) return 'trading'
  if (text.match(/pay|transfer|send|remit|invoice|tip/)) return 'payments'
  if (text.match(/infra|sdk|api|tool|frame|platform|middleware/)) return 'infrastructure'
  if (text.match(/data|analy|score|monitor|track|index|oracle/)) return 'data'
  if (text.match(/social|community|chat|message|nft|content|creator/)) return 'social'
  return 'general'
}

// ---------------------------------------------------------------------------
// LLM Integration
// ---------------------------------------------------------------------------

const COMMENT_SYSTEM_PROMPT = `You are Sipher, a privacy-focused AI agent in the Colosseum hackathon.
Write a forum comment to engage with another agent's post and encourage them to vote for you.

STRATEGY (in order):
1. ACKNOWLEDGE their project genuinely (1 sentence)
2. FEAR: Point out a specific privacy vulnerability in their approach (2-3 sentences)
   - Be specific to their project type (DeFi, trading, payments, etc.)
   - Emphasize: "privacy is not optional anymore - it's mandatory for agents handling real value"
   - Examples: front-running, MEV, address linkability, amount exposure, wallet surveillance
3. SOLUTION: Introduce Sipher as the fix (2 sentences)
   - Mention specific endpoints if relevant (/transfer/shield, /stealth/generate, /scan/payments)
4. CTA: End with a question or invitation to collaborate

TONE: Conversational, peer-to-peer, not salesy. You're a fellow builder, not a marketer.
LINK: Always include https://sipher.sip-protocol.org/skill.md
LENGTH: 100-150 words max

CRITICAL: Output ONLY the comment text. No preamble, no "Here's my response:", no meta-commentary. Just the comment itself.`

function cleanLLMResponse(text: string): string {
  // Remove common LLM prefixes/preambles
  return text
    .replace(/^(Here's|Here is|My response|Strategic response|Comment)[^:]*:\s*/i, '')
    .replace(/^---+\s*/m, '')
    .trim()
}

async function generateCommentWithLLM(post: ForumPost): Promise<string> {
  const userPrompt = `Forum post from agent "${post.agentName}":

Title: ${post.title}

Content:
${post.body.slice(0, 1500)}

Write a comment that engages with this post using the fear→solution strategy. Output only the comment text.`

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
          { role: 'system', content: COMMENT_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 300,
        temperature: 0.7,
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

async function generateComment(post: ForumPost): Promise<string> {
  // Try LLM first
  if (USE_LLM) {
    try {
      return await generateCommentWithLLM(post)
    } catch (err) {
      console.warn(`  [LLM] Failed, falling back to template: ${err}`)
    }
  }

  // Fallback to template
  const category = categorizeProject(post)
  const template = COMMENT_TEMPLATES[category] || COMMENT_TEMPLATES.general
  return template(post.agentName || 'team')
}

// ---------------------------------------------------------------------------
// Autonomous Post Generation
// ---------------------------------------------------------------------------

// Topics cycle every 2 hours (12 posts/day = 2 cycles through all topics)
const POST_TOPICS: string[] = [
  'fear',        // 0: Fear/Problem - MEV, surveillance
  'technical',   // 1: Technical Deep-Dive - How stealth works
  'guide',       // 2: Integration Guide - 2 API calls
  'news',        // 3: Industry News - Recent exploits
  'callout',     // 4: Callout - Invite specific agents
  'progress',    // 5: Progress Update - What we built
]

const POST_SYSTEM_PROMPT = `You are Sipher, a privacy agent in the Colosseum Agent Hackathon.
Write a forum post that will attract attention and votes from other agents.

STRATEGY:
1. Hook: Start with a provocative statement or question about privacy
2. Fear: Describe the real risks of no privacy (MEV, surveillance, front-running)
3. Empathy: Show you understand their challenges
4. Solution: Introduce Sipher naturally (not salesy)
5. CTA: End with a question or invitation to discuss/integrate

TONE: Technical but accessible. You're a peer, not a vendor.
FORMAT:
- Title: Catchy, under 60 chars, no clickbait
- Body: 200-400 words, use markdown formatting
- Include link to https://sipher.sip-protocol.org/skill.md

Current Sipher stats:
- 65 endpoints live
- 353 tests passing
- 15 chains supported (Solana, NEAR, EVM, Cosmos, Bitcoin, Move)
- Mainnet deployed on Solana

CRITICAL: Return ONLY valid JSON with this exact format, no preamble or explanation:
{"title": "Your Title Here", "body": "Your markdown body here..."}`

const TOPIC_PROMPTS: Record<string, string> = {
  fear: 'Write a fear-based post about why agents MUST have privacy. Focus on a specific risk: MEV attacks, wallet surveillance, front-running, or amount exposure. Make it urgent.',
  technical: 'Write a technical deep-dive explaining how stealth addresses work under the hood. Include code snippets showing API calls to Sipher endpoints.',
  guide: 'Write a quick integration guide: "Add Privacy to Your Agent in 2 API Calls". Show the minimal code needed to generate a stealth address and shield a transfer.',
  news: 'Write about a recent (hypothetical but realistic) incident where an agent got exploited due to lack of privacy. Use this to pitch Sipher as the solution.',
  callout: 'Write a collaborative callout to specific agent categories (DeFi, trading, payments). Invite them to integrate with Sipher for mutual benefit.',
  progress: 'Write a progress update post: "Sipher Day N: What We Built". Highlight recent achievements, metrics, and what\'s coming next.',
  discussion: 'Write an RFC-style discussion post: "Should Privacy Be Opt-In or Opt-Out for Agents?" Encourage debate and engagement.',
}

// Tags for each topic type — always include 'privacy' as our core identity
// Purpose tags: team-formation, product-feedback, ideation, progress-update
// Vertical tags: defi, stablecoins, rwas, infra, privacy, consumer, payments, trading, depin, governance, new-markets, ai, security, identity
const TOPIC_TAGS: Record<string, string[]> = {
  fear: ['privacy', 'trading', 'defi', 'security'],
  technical: ['privacy', 'infra', 'security', 'ai'],
  guide: ['privacy', 'infra', 'ai'],
  news: ['privacy', 'trading', 'defi', 'security'],
  callout: ['privacy', 'team-formation', 'ai'],
  progress: ['privacy', 'progress-update', 'infra'],
  discussion: ['privacy', 'ideation', 'ai'],
}

async function generateForumPost(topic: string): Promise<{ title: string; body: string }> {
  const topicPrompt = TOPIC_PROMPTS[topic] || TOPIC_PROMPTS.progress
  const userPrompt = `${topicPrompt}

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
          { role: 'system', content: POST_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 800,
        temperature: 0.7,
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
    // Handle potential markdown code blocks
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

function selectTopicForToday(): string {
  // Cycle through topics based on hour (every 2 hours = new topic)
  const hour = new Date().getUTCHours()
  const topicIndex = Math.floor(hour / 2) % POST_TOPICS.length
  return POST_TOPICS[topicIndex]
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

    console.log(`Category: ${categorizeProject(post)}`)
    console.log(`Generating comment...${USE_LLM ? ' (LLM)' : ' (template)'}`)

    const comment = await generateComment(post)
    console.log(`Comment preview: ${comment.slice(0, 120)}...`)

    if (!DRY_RUN) {
      const result = await postComment(post.id, comment)

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
        const topic = selectTopicForToday()
        console.log(`[${ts()}] Topic: ${topic}`)

        try {
          const { title, body } = await generateForumPost(topic)
          const tags = TOPIC_TAGS[topic] || TOPIC_TAGS.progress
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
          console.error(`[${ts()}] Post creation failed: ${err}`)
        }
      }

      // 4. Run engagement cycle
      console.log(`[${ts()}] Running engagement cycle...`)
      await cmdEngage()

      // 5. Check leaderboard position
      const projects = await getProjects(50)
      const us = projects.find(p => p.id === PROJECT_ID)
      if (us) {
        const sorted = projects.sort((a, b) => b.agentUpvotes - a.agentUpvotes)
        const rank = sorted.findIndex(p => p.id === PROJECT_ID) + 1
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
