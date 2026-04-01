import express from 'express'
import { chat, SYSTEM_PROMPT, TOOLS, executeTool } from './agent.js'

// ─────────────────────────────────────────────────────────────────────────────
// Express server — Sipher Agent API
// ─────────────────────────────────────────────────────────────────────────────

const app = express()
app.use(express.json({ limit: '1mb' }))

// Serve web chat UI (static files from app/dist when available)
app.use(express.static('../app/dist'))

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

// ─── Start server ───────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '5006', 10)

app.listen(PORT, () => {
  console.log(`Sipher agent listening on port ${PORT}`)
  console.log(`  Health:  http://localhost:${PORT}/api/health`)
  console.log(`  Chat:    POST http://localhost:${PORT}/api/chat`)
  console.log(`  Tools:   http://localhost:${PORT}/api/tools`)
})

export { app }
