import { Router, type Request, type Response } from 'express'
import { getPendingPosts, approvePost, rejectPost, editQueuedPost } from '../herald/approval.js'
import { getBudgetStatus } from '../herald/budget.js'
import { getDb } from '../db.js'

export const heraldRouter = Router()

// GET /api/herald — dashboard snapshot: queue, budget, dms, recentPosts
heraldRouter.get('/', (_req: Request, res: Response) => {
  const queue = getPendingPosts()
  const budget = getBudgetStatus()
  const dms = getDb()
    .prepare('SELECT * FROM herald_dms ORDER BY created_at DESC LIMIT 20')
    .all()
  const recentPosts = getDb()
    .prepare("SELECT * FROM herald_queue WHERE status = 'posted' ORDER BY posted_at DESC LIMIT 10")
    .all()
  res.json({ queue, budget, dms, recentPosts })
})

// POST /api/herald/approve/:id — approve, reject, or edit a queued post
heraldRouter.post('/approve/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const { action, content } = req.body as { action?: string; content?: string }

  const post = getDb()
    .prepare("SELECT * FROM herald_queue WHERE id = ? AND status IN ('pending', 'approved')")
    .get(id)

  if (!post) {
    res.status(404).json({ error: 'post not found or not pending' })
    return
  }

  switch (action) {
    case 'approve':
      approvePost(id, 'rector')
      res.json({ status: 'approved', id })
      break

    case 'reject':
      rejectPost(id)
      res.json({ status: 'rejected', id })
      break

    case 'edit':
      if (!content) {
        res.status(400).json({ error: 'content required for edit' })
        return
      }
      editQueuedPost(id, content)
      res.json({ status: 'edited', id })
      break

    default:
      res.status(400).json({ error: 'action must be approve, reject, or edit' })
  }
})
