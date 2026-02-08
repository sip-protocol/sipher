import { Router, Request, Response } from 'express'
import { checkSolanaHealth } from '../services/solana.js'
import { isServerShuttingDown } from '../shutdown.js'
import { isRedisEnabled, isRedisConnected, redisPing } from '../services/redis.js'

const router = Router()
const startTime = Date.now()

router.get('/health', async (_req: Request, res: Response) => {
  const solana = await checkSolanaHealth()
  const shuttingDown = isServerShuttingDown()
  const mem = process.memoryUsage()

  // Redis health check
  const redisEnabled = isRedisEnabled()
  const redisConnected = isRedisConnected()
  const redisPingOk = redisEnabled ? await redisPing() : false
  const redis = {
    enabled: redisEnabled,
    connected: redisConnected,
    ping: redisPingOk,
  }

  // Status: healthy if Solana connected (Redis is optional)
  const status = shuttingDown
    ? 'shutting_down'
    : solana.connected
      ? 'healthy'
      : 'unhealthy'

  res.status(status === 'healthy' ? 200 : 503).json({
    success: status === 'healthy',
    data: {
      status,
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      solana,
      redis,
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
        rssMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
      },
      endpoints: 70,
      program: {
        id: 'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at',
        network: 'mainnet-beta',
        configPDA: 'BVawZkppFewygA5nxdrLma4ThKx8Th7bW4KTCkcWTZwZ',
      },
      sdk: '@sip-protocol/sdk v0.7.4',
      chains: 17,
      sdks: 4,
    },
  })
})

router.get('/ready', async (_req: Request, res: Response) => {
  const solana = await checkSolanaHealth()
  const shuttingDown = isServerShuttingDown()

  // Redis is optional — don't fail readiness if Redis is down
  const redisEnabled = isRedisEnabled()
  const redisOk = !redisEnabled || isRedisConnected()

  const ready = !shuttingDown && solana.connected

  res.status(ready ? 200 : 503).json({
    success: ready,
    data: {
      ready,
      checks: {
        solana: solana.connected,
        redis: redisOk,
        shutdown: !shuttingDown,
      },
    },
  })
})

export default router
