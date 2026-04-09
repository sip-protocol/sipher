import { type Request, type Response } from 'express'
import { chat } from '../agent.js'

/**
 * POST /api/command
 * Command bar → SIPHER agent.
 */
export async function commandHandler(req: Request, res: Response): Promise<void> {
  const wallet = (req as unknown as Record<string, unknown>).wallet as string
  const { message } = req.body as { message?: string }

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'message is required' })
    return
  }

  try {
    const response = await chat([{ role: 'user', content: message }])
    res.json({ status: 'ok', wallet, response })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Command execution failed'
    res.status(500).json({ error: msg })
  }
}
