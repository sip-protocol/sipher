import { getDb } from '../db.js'

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
 */
export function getReadyToPublish(): Array<Record<string, unknown>> {
  const db = getDb()
  const approved = db.prepare(
    "SELECT * FROM herald_queue WHERE status = 'approved' AND (scheduled_at IS NULL OR scheduled_at <= ?) ORDER BY created_at ASC"
  ).all(new Date().toISOString()) as Array<Record<string, unknown>>

  if (process.env.HERALD_AUTO_APPROVE_POSTS === 'true') {
    const timeoutSec = Number(process.env.HERALD_AUTO_APPROVE_TIMEOUT ?? '1800')
    const cutoff = new Date(Date.now() - timeoutSec * 1000).toISOString()
    const autoApprove = db.prepare(
      "SELECT * FROM herald_queue WHERE status = 'pending' AND created_at <= ? ORDER BY created_at ASC"
    ).all(cutoff) as Array<Record<string, unknown>>

    // Auto-approve each pending post that's old enough
    for (const post of autoApprove) {
      approvePost(post.id as string, 'auto')
    }

    return [...approved, ...autoApprove]
  }

  return approved
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
