import { ulid } from 'ulid'
import { getDb } from '../../db.js'
import { guardianBus } from '../../coordination/event-bus.js'

export interface EnqueueResult {
  id: string
}

/**
 * Validate, insert a content post into herald_queue with type='content',
 * and emit a herald:approval-needed event for the admin dashboard.
 *
 * Uses type='content' (distinct from 'post') so hasGeneratedToday() can
 * dedupe daily generated content without conflating with reply/post queues.
 */
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

/**
 * Returns true if at least one content post has been enqueued today (UTC).
 * Used as a same-day guard to prevent duplicate daily content generation.
 */
export function hasGeneratedToday(): boolean {
  const row = getDb().prepare(
    `SELECT 1 AS one FROM herald_queue WHERE type = 'content' AND date(created_at) = date('now') LIMIT 1`,
  ).get() as { one: number } | undefined
  return row !== undefined
}
