import { type Request, type Response } from 'express'

/**
 * POST /api/command
 * Command bar → SIPHER agent.
 * Placeholder until wired to the Pi agent in Task 14.
 */
export async function commandHandler(req: Request, res: Response): Promise<void> {
  const wallet = (req as unknown as Record<string, unknown>).wallet as string
  const { message } = req.body as { message?: string }

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'message is required' })
    return
  }

  // Placeholder — Task 14 wires this to the Pi agent loop
  res.json({ status: 'received', wallet, message })
}
