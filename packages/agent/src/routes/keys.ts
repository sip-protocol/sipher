import { Router, type Request, type Response } from 'express'
import { executeViewingKey } from '../tools/viewing-key.js'

export const keysRouter: Router = Router()

/**
 * Generate a fresh viewing keypair.
 *
 * Stateless wrapper around executeViewingKey('generate'). The response is
 * the only artifact — no DB writes, no session updates, no audit log entries.
 * The FE persists the encrypted blob client-side; the server never holds the
 * raw key material (Decision D1, PR 7 spec).
 *
 * @auth verifyJwt (mounted at app-level)
 * @returns 200 { hash, downloadData: { blob, filename } } | 500 { error }
 */
keysRouter.post('/generate', async (_req: Request, res: Response) => {
  try {
    const result = await executeViewingKey({ action: 'generate' })
    res.json({
      hash: result.details.viewingKeyHash,
      downloadData: result.downloadData,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'generate failed'
    res.status(500).json({ error: message })
  }
})
