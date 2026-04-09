import { fileURLToPath } from 'node:url'
import path from 'node:path'
import express, { type Request, type Response } from 'express'
import { chat, chatStream, TOOLS, executeTool } from './agent.js'
import { startCrank, stopCrank } from './crank.js'
import { getDb, closeDb, expireStaleLinks, getActivity } from './db.js'
import { resolveSession, activeSessionCount, purgeStale } from './session.js'
import { payRouter } from './routes/pay.js'
import { adminRouter } from './routes/admin.js'
import { authRouter, verifyJwt, requireOwner } from './routes/auth.js'
import { streamHandler } from './routes/stream.js'
import { commandHandler } from './routes/command.js'
import { confirmRouter } from './routes/confirm.js'
import { vaultRouter } from './routes/vault-api.js'
import { squadRouter, isKillSwitchActive } from './routes/squad-api.js'
import { heraldRouter } from './routes/herald-api.js'
import { guardianBus } from './coordination/event-bus.js'
import { attachLogger } from './coordination/activity-logger.js'
import { AgentPool } from './agents/pool.js'
import { SentinelWorker } from './sentinel/sentinel.js'

// ─────────────────────────────────────────────────────────────────────────────
// Database & session initialization
// ─────────────────────────────────────────────────────────────────────────────

getDb()
console.log('  Database: SQLite initialized')

// Wire EventBus → ActivityLogger (persists events to DB)
attachLogger(guardianBus)
console.log('  EventBus: guardianBus + activity logger attached')

// Initialize AgentPool (max 100 agents, 30 min idle timeout)
const agentPool = new AgentPool({ maxSize: 100, idleTimeoutMs: 30 * 60 * 1000 })
console.log('  AgentPool: initialized (max=100, idle=30m)')

// Evict idle agents every 5 minutes
setInterval(() => {
  const evicted = agentPool.evictIdle()
  if (evicted > 0) console.log(`[pool] evicted ${evicted} idle agent(s)`)
}, 5 * 60 * 1000).unref()

// Start crank worker (60s interval for scheduled operations)
const crankTimer = startCrank((action, params) => executeTool(action, params))
console.log('  Crank:   60s interval (scheduled ops)')

// Initialize and start SENTINEL (blockchain monitor — no LLM, pure event emitter)
const sentinel = new SentinelWorker()
sentinel.start()
console.log('  SENTINEL: started (blockchain monitor, no wallets yet)')

// Purge stale in-memory conversations every 5 minutes
setInterval(() => {
  const purged = purgeStale()
  if (purged > 0) console.log(`[session] purged ${purged} stale sessions`)
  const expired = expireStaleLinks()
  if (expired > 0) console.log(`[links] expired ${expired} stale payment links`)
}, 5 * 60 * 1000).unref()

// ─────────────────────────────────────────────────────────────────────────────
// Express server — Sipher Agent API
// ─────────────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(express.json({ limit: '1mb' }))

// ─── Pay and Admin routes ────────────────────────────────────────────────────

app.use('/pay', payRouter)
app.use('/admin', adminRouter)

// ─── Phase 2 — Guardian Command infrastructure ───────────────────────────────

// Auth (nonce + JWT verify) — no auth required on these two
app.use('/api/auth', authRouter)

// Activity SSE stream — JWT required (EventSource passes ?token=)
app.get('/api/stream', verifyJwt, streamHandler)

// Command bar → SIPHER agent — JWT required (kill switch blocks execution)
app.post('/api/command', verifyJwt, (req, res, next) => {
  if (isKillSwitchActive()) {
    res.status(503).json({ error: 'operations paused — kill switch active' })
    return
  }
  commandHandler(req, res).catch(next)
})

// Fund-movement confirmation resolution — JWT required
app.use('/api/confirm', verifyJwt, confirmRouter)

// Vault activity feed (per-wallet) — JWT required
app.use('/api/vault', verifyJwt, vaultRouter)

// Squad dashboard + kill switch — JWT + owner required
app.use('/api/squad', verifyJwt, requireOwner, squadRouter)

// HERALD approval queue + budget dashboard — JWT + owner required
app.use('/api/herald', verifyJwt, requireOwner, heraldRouter)

// Activity stream (per-wallet history from DB) — JWT required
app.get('/api/activity', verifyJwt, (req: Request, res: Response) => {
  const wallet = (req as unknown as Record<string, unknown>).wallet as string
  const activity = getActivity(wallet)
  res.json({ activity })
})

// Serve web chat UI (static files from app/dist)
// In production: packages/agent/dist/ -> ../../../app/dist
// Resolved via __dirname so it works regardless of cwd
const webRoot = path.resolve(__dirname, '../../../app/dist')
app.use(express.static(webRoot))

// ─── Chat endpoint ──────────────────────────────────────────────────────────

app.post('/api/chat', verifyJwt, async (req, res) => {
  if (isKillSwitchActive()) {
    res.status(503).json({ error: 'operations paused — kill switch active' })
    return
  }

  const wallet = (req as unknown as Record<string, unknown>).wallet as string
  const { messages } = req.body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({
      error: 'messages is required and must be a non-empty array',
    })
    return
  }

  // Resolve session context from JWT-authenticated wallet
  const session = resolveSession(wallet)
  if (session) {
    console.log(`[session] resolved ${session.id.slice(0, 8)}… for ${wallet.slice(0, 4)}…${wallet.slice(-4)}`)
  }

  try {
    const response = await chat(messages)
    res.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[agent] chat error:', message)
    res.status(500).json({ error: message })
  }
})

// ─── SSE streaming chat endpoint ────────────────────────────────────────────

app.post('/api/chat/stream', verifyJwt, async (req, res) => {
  if (isKillSwitchActive()) {
    res.status(503).json({ error: 'operations paused — kill switch active' })
    return
  }

  const wallet = (req as unknown as Record<string, unknown>).wallet as string
  const { messages } = req.body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({
      error: 'messages is required and must be a non-empty array',
    })
    return
  }

  // Resolve session context from JWT-authenticated wallet
  const session = resolveSession(wallet)
  if (session) {
    console.log(`[session] resolved ${session.id.slice(0, 8)}… for ${wallet.slice(0, 4)}…${wallet.slice(-4)}`)
  }

  // SSE headers — keep the connection open for streaming
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  let aborted = false
  res.on('close', () => { aborted = true })

  try {
    for await (const event of chatStream(messages)) {
      // Check if client disconnected
      if (aborted || res.writableEnded) break
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[agent] stream error:', message)

    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
    }
  } finally {
    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
})

// ─── Tool execution endpoint (for direct tool calls from the UI) ────────────

// Fund-moving tools blocked from direct execution — must go through /api/command confirmation flow
const BLOCKED_TOOLS = new Set(['send', 'deposit', 'refund', 'sweep', 'consolidate', 'swap', 'splitSend', 'scheduleSend', 'drip', 'recurring'])

app.post('/api/tools/:name', verifyJwt, async (req, res) => {
  const { name } = req.params

  if (BLOCKED_TOOLS.has(name)) {
    res.status(403).json({ success: false, error: `tool '${name}' requires confirmation flow — use /api/command instead` })
    return
  }

  const wallet = (req as unknown as Record<string, unknown>).wallet as string
  const input = { ...req.body, wallet }

  try {
    const result = await executeTool(name, input)
    res.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool execution failed'
    res.status(400).json({ success: false, error: message })
  }
})

// ─── Meta endpoints ─────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    agent: 'sipher',
    version: '0.1.0',
    tools: TOOLS.map((t) => t.name),
    uptime: process.uptime(),
    activeSessions: activeSessionCount(),
  })
})

app.get('/api/tools', (_req, res) => {
  res.json({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
    })),
  })
})

// ─── Mount Mode 2 REST API (71 endpoints at /v1/*) ─────────────────────────
// The Mode 2 app is built by tsup to dist/app.js (root level).
// From packages/agent/dist/index.js the relative path is ../../../dist/app.js.
// Dynamic import ensures Mode 2 failures are non-fatal — agent keeps running.

const PORT = parseInt(process.env.PORT ?? '5006', 10)

try {
  const mode2Path = path.resolve(__dirname, '../../../dist/app.js')
  const { default: mode2App } = await import(mode2Path)
  app.use(mode2App)
  console.log('  Mode 2:  /v1/* (REST API - 71 endpoints)')
} catch (err) {
  console.warn('  Mode 2:  unavailable -', (err as Error).message)
}

// ─── Start server ───────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`Sipher agent listening on port ${PORT}`)
  console.log(`  Health:  http://localhost:${PORT}/api/health`)
  console.log(`  Chat:    POST http://localhost:${PORT}/api/chat`)
  console.log(`  Stream:  POST http://localhost:${PORT}/api/chat/stream`)
  console.log(`  Tools:   http://localhost:${PORT}/api/tools`)
  console.log(`  Pay:     http://localhost:${PORT}/pay/:id`)
  console.log(`  Admin:   http://localhost:${PORT}/admin/`)
  console.log(`  Auth:    POST http://localhost:${PORT}/api/auth/nonce|verify`)
  console.log(`  SSE:     GET  http://localhost:${PORT}/api/stream`)
  console.log(`  Command: POST http://localhost:${PORT}/api/command`)
  console.log(`  Confirm: POST http://localhost:${PORT}/api/confirm/:id`)
  console.log(`  Vault:   GET  http://localhost:${PORT}/api/vault`)
  console.log(`  Squad:   http://localhost:${PORT}/api/squad`)
  console.log(`  Herald:  http://localhost:${PORT}/api/herald`)

  // Start HERALD poller only when X API credentials are present
  if (process.env.X_BEARER_TOKEN && process.env.X_CONSUMER_KEY) {
    import('./herald/poller.js').then(({ createPollerState, startPoller }) => {
      const heraldState = createPollerState()
      startPoller(heraldState)
      console.log('  HERALD:  poller started (mentions + DMs + scheduled posts)')
    }).catch(err => {
      console.warn('  HERALD:  poller not started:', (err as Error).message)
    })
  }
})

// ─── Graceful shutdown ─────────────────────────────────────────────────────

function shutdown(signal: string) {
  console.log(`[shutdown] ${signal} received — shutting down gracefully`)

  // Stop accepting new connections
  sentinel.stop()
  stopCrank(crankTimer)

  server.close(() => {
    closeDb()
    console.log('[shutdown] complete')
    process.exit(0)
  })

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error('[shutdown] forced exit after timeout')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

export { app }
