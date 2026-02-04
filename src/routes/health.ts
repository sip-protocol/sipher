import { Router, Request, Response } from 'express'
import { checkSolanaHealth } from '../services/solana.js'
import { isServerShuttingDown } from '../shutdown.js'

const router = Router()
const startTime = Date.now()

router.get('/health', async (_req: Request, res: Response) => {
  const solana = await checkSolanaHealth()
  const shuttingDown = isServerShuttingDown()
  const mem = process.memoryUsage()

  const status = shuttingDown ? 'shutting_down' : solana.connected ? 'healthy' : 'unhealthy'

  res.status(status === 'healthy' ? 200 : 503).json({
    success: status === 'healthy',
    data: {
      status,
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      solana,
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
        rssMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
      },
      endpoints: 19,
    },
  })
})

router.get('/ready', async (_req: Request, res: Response) => {
  const solana = await checkSolanaHealth()
  const shuttingDown = isServerShuttingDown()

  const ready = !shuttingDown && solana.connected

  res.status(ready ? 200 : 503).json({
    success: ready,
    data: {
      ready,
      checks: {
        solana: solana.connected,
        shutdown: !shuttingDown,
      },
    },
  })
})

export default router
