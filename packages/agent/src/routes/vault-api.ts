import { Router, type Request, type Response } from 'express'
import { getActivity } from '../db.js'

export const vaultRouter = Router()

/**
 * GET /api/vault
 * Returns the authenticated wallet's recent activity (last 20 entries).
 * Requires verifyJwt middleware upstream — wallet is attached to req by it.
 */
vaultRouter.get('/', (req: Request, res: Response) => {
  const wallet = (req as unknown as Record<string, unknown>).wallet as string
  const activity = getActivity(wallet, { limit: 20 })
  res.json({ wallet, activity })
})
