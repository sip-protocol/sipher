import { fileURLToPath } from 'node:url'
import path from 'node:path'
import express from 'express'
import { chat, chatStream, SYSTEM_PROMPT, TOOLS, executeTool } from './agent.js'

// ─────────────────────────────────────────────────────────────────────────────
// Express server — Sipher Agent API
// ─────────────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(express.json({ limit: '1mb' }))

// Serve web chat UI (static files from app/dist)
// In production: packages/agent/dist/ -> ../../../app/dist
// Resolved via __dirname so it works regardless of cwd
const webRoot = path.resolve(__dirname, '../../../app/dist')
app.use(express.static(webRoot))

// ─── Chat endpoint ──────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({
      error: 'messages is required and must be a non-empty array',
    })
    return
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

app.post('/api/chat/stream', async (req, res) => {
  const { messages } = req.body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({
      error: 'messages is required and must be a non-empty array',
    })
    return
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

app.post('/api/tools/:name', async (req, res) => {
  const { name } = req.params
  const input = req.body

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
  })
})

app.get('/api/tools', (_req, res) => {
  res.json({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
    })),
    systemPrompt: SYSTEM_PROMPT,
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

app.listen(PORT, () => {
  console.log(`Sipher agent listening on port ${PORT}`)
  console.log(`  Health:  http://localhost:${PORT}/api/health`)
  console.log(`  Chat:    POST http://localhost:${PORT}/api/chat`)
  console.log(`  Stream:  POST http://localhost:${PORT}/api/chat/stream`)
  console.log(`  Tools:   http://localhost:${PORT}/api/tools`)
})

export { app }
