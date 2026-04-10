import express from 'express'
import helmet from 'helmet'
import compression from 'compression'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import swaggerUi from 'swagger-ui-express'
import { env } from './config.js'
import {
  authenticate,
  isAuthEnabled,
  secureCors,
  rateLimiter,
  requestIdMiddleware,
  errorHandler,
  notFoundHandler,
  auditLog,
  shutdownMiddleware,
  timeoutMiddleware,
  sessionMiddleware,
  meteringMiddleware,
} from './middleware/index.js'
import router from './routes/index.js'
import { openApiSpec } from './openapi/spec.js'
import { requestLogger } from './logger.js'

// ─────────────────────────────────────────────────────────────────────────────
// Express app — Mode 2 REST API (71 endpoints)
// Exported WITHOUT calling listen() so it can be mounted into the agent server.
// ─────────────────────────────────────────────────────────────────────────────

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
app.use(meteringMiddleware)
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
    tagline: 'Privacy-as-a-Skill for Multi-Chain Agents',
    description: 'REST API + OpenClaw skill giving any autonomous agent stealth addresses, hidden amounts, and compliance viewing keys across 17 chains.',
    program: {
      id: 'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at',
      network: 'mainnet-beta',
      configPDA: 'BVawZkppFewygA5nxdrLma4ThKx8Th7bW4KTCkcWTZwZ',
      feeCollector: 'S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd',
    },
    stats: { endpoints: 71, tests: 573, chains: 17, sdks: 4 },
    cryptography: [
      'Ed25519 stealth addresses (Solana/NEAR/Move)',
      'secp256k1 stealth addresses (EVM/Cosmos/Bitcoin)',
      'Pedersen commitments (homomorphic)',
      'XChaCha20-Poly1305 encryption',
      'BIP32 hierarchical key derivation',
      'Noir/Groth16 ZK verification (SunspotVerifier)',
    ],
    sdk: '@sip-protocol/sdk v0.7.4',
    demo: '/v1/demo',
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
      cspl: {
        wrap: 'POST /v1/cspl/wrap',
        unwrap: 'POST /v1/cspl/unwrap',
        transfer: 'POST /v1/cspl/transfer',
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
      governance: {
        encryptBallot: 'POST /v1/governance/ballot/encrypt',
        submitBallot: 'POST /v1/governance/ballot/submit',
        tally: 'POST /v1/governance/tally',
        getTally: 'GET /v1/governance/tally/:id',
      },
      billing: {
        usage: 'GET /v1/billing/usage',
        subscription: 'GET /v1/billing/subscription',
        subscribe: 'POST /v1/billing/subscribe',
        invoices: 'GET /v1/billing/invoices',
        portal: 'POST /v1/billing/portal',
        webhook: 'POST /v1/billing/webhook',
      },
      admin: {
        listKeys: 'GET /v1/admin/keys',
        createKey: 'POST /v1/admin/keys',
        getKey: 'GET /v1/admin/keys/:id',
        revokeKey: 'DELETE /v1/admin/keys/:id',
        listTiers: 'GET /v1/admin/tiers',
      },
      jito: {
        relay: 'POST /v1/jito/relay',
        bundleStatus: 'GET /v1/jito/bundle/:id',
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

// ─── Markdown demo ──────────────────────────────────────────────────────────

app.get('/demo', async (_req, res) => {
  try {
    const base = `${_req.protocol}://${_req.get('host')}`
    const resp = await fetch(`${base}/v1/demo`)
    const json = await resp.json() as any
    if (!json.success) throw new Error('Demo failed')
    const d = json.data
    const lines: string[] = [
      `# ${d.title}`,
      '',
      `> ${d.subtitle}`,
      '',
      `**Executed:** ${d.executedAt}  `,
      `**Duration:** ${d.durationMs}ms  `,
      `**Program:** \`${d.program.id}\` (${d.program.network})  `,
      '',
      '## Summary',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Steps Completed | ${d.summary.stepsCompleted} |`,
      `| Endpoints Exercised | ${d.summary.endpointsExercised} |`,
      `| Crypto Operations | ${d.summary.cryptoOperations} |`,
      `| All Passed | ${d.summary.allPassed ? 'YES' : 'NO'} |`,
      `| Chains | ${d.summary.chainsDemo.join(', ')} |`,
      '',
      '## Cryptographic Primitives Used',
      '',
      ...d.summary.realCrypto.map((c: string) => `- ${c}`),
      '',
      '## Steps',
      '',
    ]
    for (const step of d.steps) {
      lines.push(`### ${step.step}. ${step.name}`)
      lines.push('')
      lines.push(`- **Category:** ${step.category}`)
      lines.push(`- **Crypto:** ${step.crypto}`)
      lines.push(`- **Duration:** ${step.durationMs}ms`)
      lines.push(`- **Passed:** ${step.passed ? 'YES' : 'NO'}`)
      lines.push(`- **Result:** \`${JSON.stringify(step.result)}\``)
      lines.push('')
    }
    lines.push('---')
    lines.push('')
    lines.push(`*Powered by [@sip-protocol/sdk](https://www.npmjs.com/package/@sip-protocol/sdk) v0.7.4*`)
    res.type('text/markdown').send(lines.join('\n'))
  } catch {
    res.status(500).type('text/markdown').send('# Demo Error\n\nFailed to run demo. Try `/v1/demo` for JSON format.')
  }
})

// ─── API routes ─────────────────────────────────────────────────────────────

app.use('/v1', router)

// ─── Error handling ─────────────────────────────────────────────────────────

app.use(notFoundHandler)
app.use(errorHandler)

export default app
