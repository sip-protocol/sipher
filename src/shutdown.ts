import { Server } from 'http'
import { logger } from './logger.js'
import { env } from './config.js'

let isShuttingDown = false

export function isServerShuttingDown(): boolean {
  return isShuttingDown
}

export function setupGracefulShutdown(
  server: Server,
  cleanup?: () => Promise<void>
): void {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return
    isShuttingDown = true
    logger.info({ signal }, 'Graceful shutdown started')

    server.close(async (err) => {
      if (err) {
        logger.error({ err }, 'Error closing HTTP server')
        process.exit(1)
      }
      logger.info('HTTP server closed')

      if (cleanup) {
        try {
          await cleanup()
        } catch (cleanupErr) {
          logger.error({ err: cleanupErr }, 'Error during cleanup')
        }
      }

      logger.info('Shutdown complete')
      process.exit(0)
    })

    setTimeout(() => {
      logger.error({ timeoutMs: env.SHUTDOWN_TIMEOUT_MS }, 'Shutdown timeout — forcing exit')
      process.exit(1)
    }, env.SHUTDOWN_TIMEOUT_MS)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception')
    shutdown('uncaughtException')
  })
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection')
    shutdown('unhandledRejection')
  })
}

export function shutdownMiddleware(
  req: { path: string },
  res: { status: (code: number) => { json: (body: unknown) => void } },
  next: () => void
): void {
  if (isShuttingDown) {
    if (req.path === '/v1/health' || req.path === '/v1/ready') return next()
    res.status(503).json({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Server is shutting down' },
    })
    return
  }
  next()
}
