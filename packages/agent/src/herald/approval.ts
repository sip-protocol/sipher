import { getDb } from '../db.js'

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

/**
 * Typed row from herald_queue.
 * Note: schema has no updated_at column — created_at reflects creation time only.
 * Last-edit timestamp tracking is deferred to a future migration.
 */
export interface QueueItem {
  id: string
  type: string
  content: string
  status: string
  scheduled_at?: string | null
  reply_to?: string | null
  approved_by?: string | null
  approved_at?: string | null
  posted_at?: string | null
  tweet_id?: string | null
  metrics?: string | null
  created_at: string
}

/**
 * Fetch a single queue item by id. Returns undefined if not found.
 */
export function getQueueItem(id: string): QueueItem | undefined {
  const row = getDb().prepare('SELECT * FROM herald_queue WHERE id = ?').get(id)
  return row as QueueItem | undefined
}

/**
 * Update the content of any queue item regardless of status (admin-level access).
 * Unlike editQueuedPost, this has no status restriction — the route layer enforces
 * any business rules about which statuses allow edits.
 * Returns the canonical post-update row.
 */
export function updateContent(id: string, content: string): QueueItem {
  const existing = getQueueItem(id)
  if (!existing) throw new NotFoundError(`queue item ${id} not found`)
  getDb().prepare('UPDATE herald_queue SET content = ? WHERE id = ?').run(content, id)
  const updated = getQueueItem(id)
  if (!updated) throw new NotFoundError(`queue item ${id} disappeared after update`)
  return updated
}

/**
 * Get all pending posts from herald_queue, ordered by created_at ascending.
 */
export function getPendingPosts(): Array<Record<string, unknown>> {
  return getDb().prepare(
    'SELECT * FROM herald_queue WHERE status = ? ORDER BY created_at ASC'
  ).all('pending') as Array<Record<string, unknown>>
}

/**
 * Get posts ready to publish: approved posts + auto-approved if enabled.
 * Returns approved posts where scheduled_at is NULL or <= now, or auto-approved pending posts.
 *
 * Auto-approve uses a transaction with a CAS guard (WHERE status = 'pending')
 * to prevent TOCTOU races when multiple callers invoke this concurrently.
 */
export function getReadyToPublish(): Array<Record<string, unknown>> {
  const db = getDb()

  // Get already-approved posts
  const approved = db.prepare(
    "SELECT * FROM herald_queue WHERE status = 'approved' AND (scheduled_at IS NULL OR scheduled_at <= ?) ORDER BY created_at ASC"
  ).all(new Date().toISOString()) as Array<Record<string, unknown>>

  if (process.env.HERALD_AUTO_APPROVE_POSTS !== 'true') return approved

  const timeoutSec = Number(process.env.HERALD_AUTO_APPROVE_TIMEOUT ?? '1800')
  const cutoff = new Date(Date.now() - timeoutSec * 1000).toISOString()
  const now = new Date().toISOString()

  // Atomically select-and-update in a transaction to prevent race conditions
  const autoApproved = db.transaction(() => {
    const pending = db.prepare(
      "SELECT * FROM herald_queue WHERE status = 'pending' AND created_at <= ? ORDER BY created_at ASC"
    ).all(cutoff) as Array<Record<string, unknown>>

    for (const post of pending) {
      db.prepare(
        'UPDATE herald_queue SET status = ?, approved_by = ?, approved_at = ? WHERE id = ? AND status = ?'
      ).run('approved', 'auto', now, post.id, 'pending')
    }

    return pending
  })()

  return [...approved, ...autoApproved]
}

/**
 * Approve a post: set status to approved, set approved_by, and set approved_at.
 */
export function approvePost(id: string, approvedBy: string): void {
  getDb().prepare(
    'UPDATE herald_queue SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?'
  ).run('approved', approvedBy, new Date().toISOString(), id)
}

/**
 * Reject a post: set status to rejected.
 */
export function rejectPost(id: string): void {
  getDb().prepare('UPDATE herald_queue SET status = ? WHERE id = ?').run('rejected', id)
}

/**
 * Mark a post as published: set status to posted, set tweet_id, and set posted_at.
 */
export function markPublished(id: string, tweetId: string): void {
  getDb().prepare(
    'UPDATE herald_queue SET status = ?, tweet_id = ?, posted_at = ? WHERE id = ?'
  ).run('posted', tweetId, new Date().toISOString(), id)
}

/**
 * Edit a queued post's content. Only works for pending or approved posts.
 */
export function editQueuedPost(id: string, newContent: string): void {
  getDb().prepare(
    'UPDATE herald_queue SET content = ? WHERE id = ? AND status IN (?, ?)'
  ).run(newContent, id, 'pending', 'approved')
}
