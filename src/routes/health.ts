import { Router, Request, Response } from 'express'
import { checkSolanaHealth } from '../services/solana.js'
import { isServerShuttingDown } from '../shutdown.js'
import type { HealthResponse } from '../types/api.js'

const router = Router()
const startTime = Date.now()

router.get('/health', async (_req: Request, res: Response) => {
  const solana = await checkSolanaHealth()
  const shuttingDown = isServerShuttingDown()

  const health: HealthResponse = {
    status: shuttingDown ? 'shutting_down' : solana.connected ? 'healthy' : 'unhealthy',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    solana,
  }

  res.status(health.status === 'healthy' ? 200 : 503).json({
    success: health.status === 'healthy',
    data: health,
  })
})

export default router
