import type { Tool } from '@mariozechner/pi-ai'
import { getDb } from '../../db.js'
import { ulid } from 'ulid'

// ─────────────────────────────────────────────────────────────────────────────
// schedulePost — LOCAL. Queues a post for a future time. No API call. No cost.
// The crank engine polls herald_queue for scheduled items and triggers approval.
// ─────────────────────────────────────────────────────────────────────────────

export interface SchedulePostParams {
  text: string
  scheduled_at: string // ISO 8601 timestamp
}

export interface SchedulePostResult {
  queued: boolean
  id: string
}

export const schedulePostTool: Tool = {
  name: 'schedulePost',
  description: 'Schedule a tweet to be queued for approval at a specific future time. Stored locally — no X API call is made. The crank engine will surface it for approval at the scheduled time.',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Tweet text (max 280 chars)',
      },
      scheduled_at: {
        type: 'string',
        description: 'ISO 8601 timestamp for when the post should go live (e.g. "2026-05-01T09:00:00Z")',
      },
    },
    required: ['text', 'scheduled_at'],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON Schema ↔ TypeBox TSchema bridge
  } as any,
}

export async function executeSchedulePost(params: SchedulePostParams): Promise<SchedulePostResult> {
  if (!params.text || params.text.trim().length === 0) {
    throw new Error('text is required')
  }
  if (!params.scheduled_at || params.scheduled_at.trim().length === 0) {
    throw new Error('scheduled_at is required')
  }

  const id = ulid()
  const now = new Date().toISOString()
  const conn = getDb()

  conn.prepare(`
    INSERT INTO herald_queue (id, type, content, reply_to, scheduled_at, status, created_at)
    VALUES (?, 'post', ?, null, ?, 'pending', ?)
  `).run(id, params.text, params.scheduled_at, now)

  return { queued: true, id }
}
