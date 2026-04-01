import { env, logConfigWarnings } from './config.js'
import { logger } from './logger.js'
import { setupGracefulShutdown } from './shutdown.js'
import { isAuthEnabled, getCorsConfig } from './middleware/index.js'
import { initRedis, closeRedis, isRedisEnabled, isRedisConnected } from './services/redis.js'
import app from './app.js'

// Initialize Redis (async, non-blocking)
initRedis().catch((err) => {
  logger.warn({ err }, 'Redis initialization failed — using in-memory fallback')
})

// ─── Start server ───────────────────────────────────────────────────────────

const server = app.listen(env.PORT, () => {
  logConfigWarnings(logger)

  logger.info({
    port: env.PORT,
    environment: env.NODE_ENV,
    auth: isAuthEnabled() ? 'enabled' : 'disabled',
    redis: isRedisEnabled() ? (isRedisConnected() ? 'connected' : 'connecting') : 'disabled',
    corsOrigins: getCorsConfig().origins.length,
  }, 'Sipher started')

  if (env.isDevelopment) {
    console.log(`
╔════════════════════════════════════════════════════╗
║  Sipher — Privacy-as-a-Skill for Solana Agents     ║
║  Version: 0.1.0                                    ║
╠════════════════════════════════════════════════════╣
║  Port: ${String(env.PORT).padEnd(43)}║
║  Auth: ${(isAuthEnabled() ? 'ENABLED' : 'disabled').padEnd(44)}║
║  Solana: ${env.SOLANA_RPC_URL.slice(0, 42).padEnd(42)}║
╠════════════════════════════════════════════════════╣
║  Docs: http://localhost:${String(env.PORT)}/docs${' '.repeat(18)}║
║  Skill: http://localhost:${String(env.PORT)}/skill.md${' '.repeat(13)}║
║  API:   http://localhost:${String(env.PORT)}/v1/openapi.json${' '.repeat(5)}║
╚════════════════════════════════════════════════════╝
    `)
  }
})

setupGracefulShutdown(server, async () => {
  await closeRedis()
  logger.info('Cleanup complete')
})

export default app
