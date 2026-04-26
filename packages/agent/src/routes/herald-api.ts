import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { getPendingPosts, approvePost, rejectPost, getQueueItem, updateContent, NotFoundError } from '../herald/approval.js'
import { getBudgetStatus } from '../herald/budget.js'
import { getDb } from '../db.js'
import { guardianBus } from '../coordination/event-bus.js'

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

// PATCH /api/herald/queue/:id — update content of any queue item (admin only via mount middleware)
const updateSchema = z.object({
  content: z.string().trim().min(1).max(280),
})

heraldRouter.patch('/queue/:id', (req: Request, res: Response): void => {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'INVALID_CONTENT',
        message: parsed.error.issues[0]?.message ?? 'invalid content',
      },
    })
    return
  }

  const id = req.params.id as string
  const oldItem = getQueueItem(id)

  try {
    const updated = updateContent(id, parsed.data.content)
    if (oldItem) {
      const wallet = (req as unknown as Record<string, unknown>).wallet as string
      guardianBus.emit({
        source: 'herald',
        type: 'herald:edited',
        level: 'important',
        data: {
          id: updated.id,
          oldContent: oldItem.content,
          newContent: updated.content,
          editedBy: wallet,
        },
        wallet,
        timestamp: new Date().toISOString(),
      })
    }
    res.status(200).json(updated)
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } })
      return
    }
    throw err
  }
})

// POST /api/herald/approve/:id — approve or reject a queued post
heraldRouter.post('/approve/:id', (req: Request, res: Response) => {
  const id = req.params.id as string
  const { action } = req.body as { action?: string }

  const post = getDb()
    .prepare("SELECT * FROM herald_queue WHERE id = ? AND status IN ('pending', 'approved')")
    .get(id)

  if (!post) {
    res.status(404).json({ error: 'post not found or not pending' })
    return
  }

  const wallet = (req as unknown as Record<string, unknown>).wallet as string

  switch (action) {
    case 'approve':
      approvePost(id, wallet)
      res.json({ status: 'approved', id })
      break

    case 'reject':
      rejectPost(id)
      res.json({ status: 'rejected', id })
      break

    default:
      res.status(400).json({ error: 'action must be approve or reject' })
  }
})
