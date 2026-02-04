import express from 'express'
import helmet from 'helmet'
import compression from 'compression'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import swaggerUi from 'swagger-ui-express'
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
  auditLog,
  shutdownMiddleware,
} from './middleware/index.js'
import router from './routes/index.js'
import { openApiSpec } from './openapi/spec.js'

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
app.use(auditLog)

// ─── OpenAPI / Swagger ─────────────────────────────────────────────────────

app.get('/v1/openapi.json', (_req, res) => {
  res.json(openApiSpec)
})

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  customSiteTitle: 'Sipher API Docs',
  customCss: '.swagger-ui .topbar { display: none }',
}))

// ─── Root endpoint ──────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({
    name: 'sipher',
    version: '0.1.0',
    description: 'Privacy-as-a-Skill REST API for Solana Agents — powered by SIP Protocol',
    documentation: '/skill.md',
    docs: '/docs',
    openapi: '/v1/openapi.json',
    endpoints: {
      health: 'GET /v1/health',
      ready: 'GET /v1/ready',
      errors: 'GET /v1/errors',
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
        add: 'POST /v1/commitment/add',
        subtract: 'POST /v1/commitment/subtract',
      },
      viewingKey: {
        generate: 'POST /v1/viewing-key/generate',
        disclose: 'POST /v1/viewing-key/disclose',
        decrypt: 'POST /v1/viewing-key/decrypt',
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
║  Docs: http://localhost:${String(env.PORT)}/docs${' '.repeat(18)}║
║  Skill: http://localhost:${String(env.PORT)}/skill.md${' '.repeat(13)}║
║  API:   http://localhost:${String(env.PORT)}/v1/openapi.json${' '.repeat(5)}║
╚════════════════════════════════════════════════════╝
    `)
  }
})

setupGracefulShutdown(server, async () => {
  logger.info('Cleanup complete')
})

export default app
