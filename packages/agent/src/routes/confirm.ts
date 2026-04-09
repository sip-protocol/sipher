import { Router, type Request, type Response } from 'express'

// ─────────────────────────────────────────────────────────────────────────────
// In-memory pending confirmations
// Each entry holds the promise resolver + a cleanup timer.
// On confirmation or cancellation the timer is cleared and the entry removed.
// Timed-out entries auto-resolve to false.
// ─────────────────────────────────────────────────────────────────────────────

const pending = new Map<string, { resolve: (confirmed: boolean) => void; timer: NodeJS.Timeout; wallet: string }>()

export const confirmRouter = Router()

/**
 * POST /api/confirm/:id
 * Resolves a pending confirmation created by requestConfirmation().
 * Body: { action: 'confirm' | 'cancel' }
 */
confirmRouter.post('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const { action } = req.body as { action?: 'confirm' | 'cancel' }

  const entry = pending.get(id)
  if (!entry) {
    res.status(404).json({ error: 'confirmation not found or expired' })
    return
  }

  const wallet = (req as unknown as Record<string, unknown>).wallet as string
  if (entry.wallet !== wallet) {
    res.status(403).json({ error: 'confirmation belongs to a different wallet' })
    return
  }

  clearTimeout(entry.timer)
  pending.delete(id)
  entry.resolve(action === 'confirm')

  res.json({ status: action === 'confirm' ? 'confirmed' : 'cancelled' })
})

/**
 * Register a pending confirmation keyed by id.
 * Resolves true when the user confirms, false on cancel or timeout.
 * The timer is unref'd so it doesn't block process exit.
 */
const MAX_PENDING_CONFIRMATIONS = 1000

export function requestConfirmation(id: string, wallet: string, timeoutMs = 120_000): Promise<boolean> {
  if (pending.size >= MAX_PENDING_CONFIRMATIONS) {
    return Promise.resolve(false)
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      resolve(false)
    }, timeoutMs)
    timer.unref()
    pending.set(id, { resolve, timer, wallet })
  })
}
