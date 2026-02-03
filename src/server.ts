import express from 'express'
import helmet from 'helmet'
import compression from 'compression'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { env, logConfigWarnings } from './config.js'
import { logger, requestLogger } from './logger.js'
import { setupGracefulShutdown } from './shutdown.js'
import {
  authenticate,
  isAuthEnabled,
  secureCors,
  getCorsConfig,
  rateLimiter,
  requestIdMiddleware,
  errorHandler,
  notFoundHandler,
  shutdownMiddleware,
} from './middleware/index.js'
import router from './routes/index.js'

const app = express()

// Trust proxy
const trustProxy = env.TRUST_PROXY
if (trustProxy !== 'false') {
  const parsed = /^\d+$/.test(trustProxy) ? parseInt(trustProxy, 10) : trustProxy
  app.set('trust proxy', parsed)
}

// Middleware stack (order matters)
app.use(shutdownMiddleware as any)
app.use(requestIdMiddleware)
app.use(helmet())
app.use(secureCors)
app.use(rateLimiter)
app.use(authenticate)
app.use(express.json({ limit: '1mb' }))
app.use(compression())
app.use(requestLogger)

// ─── Root endpoint ──────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({
    name: 'sipher',
    version: '0.1.0',
    description: 'Privacy-as-a-Skill REST API for Solana Agents — powered by SIP Protocol',
    documentation: '/skill.md',
    endpoints: {
      health: 'GET /v1/health',
      stealth: {
        generate: 'POST /v1/stealth/generate',
        derive: 'POST /v1/stealth/derive',
        check: 'POST /v1/stealth/check',
      },
      transfer: {
        shield: 'POST /v1/transfer/shield',
        claim: 'POST /v1/transfer/claim',
      },
      scan: 'POST /v1/scan/payments',
      commitment: {
        create: 'POST /v1/commitment/create',
        verify: 'POST /v1/commitment/verify',
      },
      viewingKey: {
        generate: 'POST /v1/viewing-key/generate',
        disclose: 'POST /v1/viewing-key/disclose',
      },
    },
    security: {
      authentication: isAuthEnabled() ? 'enabled' : 'disabled',
      rateLimit: 'enabled',
    },
  })
})

// ─── skill.md ───────────────────────────────────────────────────────────────

app.get('/skill.md', (_req, res) => {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const skillPath = join(__dirname, '..', 'skill.md')
    const content = readFileSync(skillPath, 'utf-8')
    res.type('text/markdown').send(content)
  } catch {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'skill.md not found' },
    })
  }
})

// ─── API routes ─────────────────────────────────────────────────────────────

app.use('/v1', router)

// ─── Error handling ─────────────────────────────────────────────────────────

app.use(notFoundHandler)
app.use(errorHandler)

// ─── Start server ───────────────────────────────────────────────────────────

const server = app.listen(env.PORT, () => {
  logConfigWarnings(logger)

  logger.info({
    port: env.PORT,
    environment: env.NODE_ENV,
    auth: isAuthEnabled() ? 'enabled' : 'disabled',
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
║  Docs: http://localhost:${String(env.PORT).padEnd(26)}║
║  Skill: http://localhost:${String(env.PORT)}/skill.md${' '.repeat(13)}║
╚════════════════════════════════════════════════════╝
    `)
  }
})

setupGracefulShutdown(server, async () => {
  logger.info('Cleanup complete')
})

export default app
