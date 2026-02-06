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
  timeoutMiddleware,
  sessionMiddleware,
} from './middleware/index.js'
import router from './routes/index.js'
import { openApiSpec } from './openapi/spec.js'
import { initRedis, closeRedis, isRedisEnabled, isRedisConnected } from './services/redis.js'

// Initialize Redis (async, non-blocking)
initRedis().catch((err) => {
  logger.warn({ err }, 'Redis initialization failed — using in-memory fallback')
})

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
app.use(timeoutMiddleware)  // Per-endpoint timeouts (15-90s)
app.use(express.json({ limit: '1mb' }))
app.use(compression())
app.use(requestLogger)
app.use(auditLog)
app.use(sessionMiddleware)

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
        generateBatch: 'POST /v1/stealth/generate/batch',
      },
      transfer: {
        shield: 'POST /v1/transfer/shield',
        claim: 'POST /v1/transfer/claim',
      },
      scan: {
        payments: 'POST /v1/scan/payments',
        paymentsBatch: 'POST /v1/scan/payments/batch',
      },
      commitment: {
        create: 'POST /v1/commitment/create',
        verify: 'POST /v1/commitment/verify',
        add: 'POST /v1/commitment/add',
        subtract: 'POST /v1/commitment/subtract',
        createBatch: 'POST /v1/commitment/create/batch',
      },
      viewingKey: {
        generate: 'POST /v1/viewing-key/generate',
        derive: 'POST /v1/viewing-key/derive',
        verifyHierarchy: 'POST /v1/viewing-key/verify-hierarchy',
        disclose: 'POST /v1/viewing-key/disclose',
        decrypt: 'POST /v1/viewing-key/decrypt',
      },
      privacy: {
        score: 'POST /v1/privacy/score',
      },
      rpc: {
        providers: 'GET /v1/rpc/providers',
      },
      backends: {
        list: 'GET /v1/backends',
        health: 'GET /v1/backends/:id/health',
        select: 'POST /v1/backends/select',
        compare: 'POST /v1/backends/compare',
      },
      proofs: {
        fundingGenerate: 'POST /v1/proofs/funding/generate',
        fundingVerify: 'POST /v1/proofs/funding/verify',
        validityGenerate: 'POST /v1/proofs/validity/generate',
        validityVerify: 'POST /v1/proofs/validity/verify',
        fulfillmentGenerate: 'POST /v1/proofs/fulfillment/generate',
        fulfillmentVerify: 'POST /v1/proofs/fulfillment/verify',
        rangeGenerate: 'POST /v1/proofs/range/generate',
        rangeVerify: 'POST /v1/proofs/range/verify',
      },
      cspl: {
        wrap: 'POST /v1/cspl/wrap',
        unwrap: 'POST /v1/cspl/unwrap',
        transfer: 'POST /v1/cspl/transfer',
      },
      arcium: {
        compute: 'POST /v1/arcium/compute',
        status: 'GET /v1/arcium/compute/:id/status',
        decrypt: 'POST /v1/arcium/decrypt',
      },
      inco: {
        encrypt: 'POST /v1/inco/encrypt',
        compute: 'POST /v1/inco/compute',
        decrypt: 'POST /v1/inco/decrypt',
      },
      swap: {
        private: 'POST /v1/swap/private',
      },
      sessions: {
        create: 'POST /v1/sessions',
        get: 'GET /v1/sessions/:id',
        update: 'PATCH /v1/sessions/:id',
        delete: 'DELETE /v1/sessions/:id',
      },
      compliance: {
        disclose: 'POST /v1/compliance/disclose',
        report: 'POST /v1/compliance/report',
        getReport: 'GET /v1/compliance/report/:id',
      },
      admin: {
        listKeys: 'GET /v1/admin/keys',
        createKey: 'POST /v1/admin/keys',
        getKey: 'GET /v1/admin/keys/:id',
        revokeKey: 'DELETE /v1/admin/keys/:id',
        listTiers: 'GET /v1/admin/tiers',
      },
    },
    security: {
      authentication: isAuthEnabled() ? 'enabled' : 'disabled',
      rateLimit: 'tiered (free: 100/hr, pro: 10K/hr, enterprise: 100K/hr)',
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
