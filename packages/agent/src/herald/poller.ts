import { executeReadMentions } from './tools/read-mentions.js'
import { executeReadDMs } from './tools/read-dms.js'
import { classifyIntent } from './intent.js'
import { getReadyToPublish, markPublished } from './approval.js'
import { publishTweet } from './tools/post-tweet.js'
import { getBudgetStatus } from './budget.js'
import { guardianBus } from '../coordination/event-bus.js'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PollerState {
  mentionInterval: number
  dmInterval: number
  emptyStreaks: number
  lastMentionId: string | null
  lastDmId: string | null
  running: boolean
}

// Backoff multiplier applied after EMPTY_STREAK_THRESHOLD consecutive empty polls
const EMPTY_STREAK_THRESHOLD = 3
const BACKOFF_MULTIPLIER = 3

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create initial poller state.
 * Base interval from HERALD_POLL_INTERVAL env (default 600000ms = 10min).
 */
export function createPollerState(): PollerState {
  const base = Number(process.env.HERALD_POLL_INTERVAL ?? '600000')
  return {
    mentionInterval: base,
    dmInterval: base,
    emptyStreaks: 0,
    lastMentionId: null,
    lastDmId: null,
    running: false,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Adaptive interval
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return backed-off interval (3x) after 3+ empty polls, normal otherwise.
 * Uses mentionInterval as the canonical base interval.
 */
export function getNextInterval(state: PollerState): number {
  if (state.emptyStreaks >= EMPTY_STREAK_THRESHOLD) {
    return state.mentionInterval * BACKOFF_MULTIPLIER
  }
  return state.mentionInterval
}

// ─────────────────────────────────────────────────────────────────────────────
// Poll functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Poll for new @SipProtocol mentions.
 * Skips if budget gate is 'paused' or 'dm-only' (mentions_read is blocked).
 * Updates lastMentionId on results; increments emptyStreaks on empty.
 */
export async function pollMentions(state: PollerState): Promise<void> {
  const { gate } = getBudgetStatus()
  if (gate === 'paused' || gate === 'dm-only') return

  const result = await executeReadMentions(
    state.lastMentionId ? { since_id: state.lastMentionId } : {}
  )

  if (result.mentions.length === 0) {
    state.emptyStreaks += 1
    return
  }

  // Reset streak — there's activity
  state.emptyStreaks = 0
  state.lastMentionId = result.mentions[0].id

  for (const mention of result.mentions) {
    const intent = classifyIntent(mention.text)

    guardianBus.emit({
      source: 'herald',
      type: 'herald:mention',
      level: intent.intent === 'command' ? 'important' : 'routine',
      data: {
        mentionId: mention.id,
        authorId: mention.author_id ?? null,
        text: mention.text,
        intent: intent.intent,
        tool: intent.tool ?? null,
        needsExecLink: intent.needsExecLink ?? false,
        confidence: intent.confidence,
      },
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Poll for DM events.
 * Skips if budget gate is 'paused' (dm_read is blocked).
 */
export async function pollDMs(state: PollerState): Promise<void> {
  const { gate } = getBudgetStatus()
  if (gate === 'paused') return

  const result = await executeReadDMs()

  if (result.dms.length === 0) return

  // Update cursor to newest DM id
  state.lastDmId = result.dms[0].id

  for (const dm of result.dms) {
    const text = dm.text ?? ''
    const intent = classifyIntent(text)

    guardianBus.emit({
      source: 'herald',
      type: 'herald:dm',
      level: intent.intent === 'command' ? 'important' : 'routine',
      data: {
        dmId: dm.id,
        senderId: dm.sender_id ?? null,
        text,
        intent: intent.intent,
        tool: intent.tool ?? null,
        needsExecLink: intent.needsExecLink ?? false,
        confidence: intent.confidence,
      },
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Check for approved/scheduled posts ready to publish and post them.
 * Stops on first error (budget exceeded or X API failure).
 */
export async function checkScheduledPosts(): Promise<void> {
  const posts = getReadyToPublish()
  if (posts.length === 0) return

  for (const post of posts) {
    try {
      const result = await publishTweet(post.content as string)
      markPublished(post.id as string, result.tweet_id)

      guardianBus.emit({
        source: 'herald',
        type: 'herald:post-published',
        level: 'routine',
        data: { id: post.id, tweetId: result.tweet_id },
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)

      guardianBus.emit({
        source: 'herald',
        type: 'herald:post-failed',
        level: 'important',
        data: { id: post.id, error: message },
        timestamp: new Date().toISOString(),
      })

      // Stop publishing on error — may indicate budget exceeded or rate limit
      break
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

export type PollerTimers = {
  mentionsTimer: ReturnType<typeof setTimeout>
  dmsTimer: ReturnType<typeof setInterval>
  scheduledTimer: ReturnType<typeof setInterval>
}

/**
 * Schedule next mention poll using recursive setTimeout.
 * Each tick computes the correct interval (with backoff), executes,
 * then schedules the next tick — preventing the permanent-stop bug
 * that occurred with setInterval + clearInterval.
 */
function scheduleMentionPoll(state: PollerState, timers: PollerTimers): void {
  const interval = getNextInterval(state)
  timers.mentionsTimer = setTimeout(() => {
    pollMentions(state).catch((err) => {
      guardianBus.emit({
        source: 'herald',
        type: 'herald:poller-error',
        level: 'important',
        data: { poller: 'mentions', error: err instanceof Error ? err.message : String(err) },
        timestamp: new Date().toISOString(),
      })
    }).finally(() => {
      if (state.running) scheduleMentionPoll(state, timers)
    })
  }, interval)
  timers.mentionsTimer.unref()
}

/**
 * Start 3 timers: mentions (recursive setTimeout), DMs + scheduled (setInterval).
 * All timers are unref'd so they don't prevent process exit.
 * Returns handles for cleanup via stopPoller().
 */
export function startPoller(state: PollerState): PollerTimers {
  state.running = true

  const timers: PollerTimers = {
    mentionsTimer: null as unknown as ReturnType<typeof setTimeout>,
    dmsTimer: null as unknown as ReturnType<typeof setInterval>,
    scheduledTimer: null as unknown as ReturnType<typeof setInterval>,
  }

  // Mentions: recursive setTimeout for adaptive backoff
  scheduleMentionPoll(state, timers)

  // DMs: fixed interval (no backoff needed)
  timers.dmsTimer = setInterval(() => {
    pollDMs(state).catch((err) => {
      guardianBus.emit({
        source: 'herald',
        type: 'herald:poller-error',
        level: 'important',
        data: { poller: 'dms', error: err instanceof Error ? err.message : String(err) },
        timestamp: new Date().toISOString(),
      })
    })
  }, state.dmInterval)

  // Scheduled posts checked every minute regardless of mention backoff
  timers.scheduledTimer = setInterval(() => {
    checkScheduledPosts().catch((err) => {
      guardianBus.emit({
        source: 'herald',
        type: 'herald:poller-error',
        level: 'important',
        data: { poller: 'scheduled', error: err instanceof Error ? err.message : String(err) },
        timestamp: new Date().toISOString(),
      })
    })
  }, 60_000)

  timers.dmsTimer.unref()
  timers.scheduledTimer.unref()

  return timers
}

/**
 * Stop all poller timers and mark state as not running.
 */
export function stopPoller(state: PollerState, timers: PollerTimers): void {
  clearTimeout(timers.mentionsTimer)
  clearInterval(timers.dmsTimer)
  clearInterval(timers.scheduledTimer)
  state.running = false
}
