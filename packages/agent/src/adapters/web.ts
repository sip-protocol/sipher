import type { Request, Response } from 'express'
import type { ResponseChunk } from '../core/types.js'
import { AgentCore } from '../core/agent-core.js'

// ─────────────────────────────────────────────────────────────────────────────
// Web Adapter — maps Express HTTP requests to AgentCore
//
// createWebAdapter() returns handlers for:
//   POST /api/command   → handleCommand  (single-turn, JSON response)
//   POST /api/chat      → handleChat     (multi-turn, JSON response)
//   POST /api/chat/stream → handleChatStream (multi-turn, SSE stream)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 4000

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * Map a ResponseChunk to the SSE event format the frontend expects.
 */
function chunkToSSE(chunk: ResponseChunk): Record<string, unknown> {
  switch (chunk.type) {
    case 'text':
      return { type: 'content_block_delta', text: chunk.text }
    case 'tool_start':
      return { type: 'tool_use', name: chunk.toolName, id: chunk.toolId }
    case 'tool_end':
      return {
        type: 'tool_result',
        name: chunk.toolName,
        id: chunk.toolId,
        success: chunk.success,
      }
    case 'error':
      return { type: 'error', message: chunk.text }
    case 'done':
      return { type: 'message_complete', content: chunk.text }
  }
}

/**
 * Extract the wallet address set by JWT middleware.
 */
function getWallet(req: Request): string {
  return (req as unknown as Record<string, unknown>).wallet as string
}

/**
 * Validate the messages array from a chat request body.
 * Returns the last user message content or null if invalid.
 */
function extractLastUserMessage(
  messages: unknown,
): string | null {
  if (!Array.isArray(messages) || messages.length === 0) return null
  const userMessages = (messages as ChatMessage[]).filter(
    (m) => m.role === 'user',
  )
  if (userMessages.length === 0) return null
  return userMessages[userMessages.length - 1].content
}

export function createWebAdapter() {
  const core = new AgentCore()

  // ───────────────────────────────────────────────────────────────────────
  // POST /api/command — single-turn command execution
  // ───────────────────────────────────────────────────────────────────────

  async function handleCommand(req: Request, res: Response) {
    const wallet = getWallet(req)
    const { message } = req.body as { message?: string }

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required' })
      return
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: 'message exceeds 4000 character limit' })
      return
    }

    const response = await core.processMessage({
      platform: 'web',
      userId: wallet,
      message,
    })

    res.json({ status: 'ok', wallet, response })
  }

  // ───────────────────────────────────────────────────────────────────────
  // POST /api/chat — multi-turn chat (JSON response)
  // ───────────────────────────────────────────────────────────────────────

  async function handleChat(req: Request, res: Response) {
    const wallet = getWallet(req)
    const lastUserMsg = extractLastUserMessage(req.body?.messages)

    if (!lastUserMsg) {
      res.status(400).json({
        error: 'messages array is required and must not be empty',
      })
      return
    }

    const response = await core.processMessage({
      platform: 'web',
      userId: wallet,
      message: lastUserMsg,
    })

    res.json(response)
  }

  // ───────────────────────────────────────────────────────────────────────
  // POST /api/chat/stream — multi-turn chat (SSE stream)
  // ───────────────────────────────────────────────────────────────────────

  async function handleChatStream(req: Request, res: Response) {
    const wallet = getWallet(req)
    const lastUserMsg = extractLastUserMessage(req.body?.messages)

    if (!lastUserMsg) {
      res.status(400).json({
        error: 'messages array is required and must not be empty',
      })
      return
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    // Track client disconnect
    let aborted = false
    res.on('close', () => {
      aborted = true
    })

    try {
      const ctx = { platform: 'web' as const, userId: wallet, message: lastUserMsg }
      for await (const chunk of core.streamMessage(ctx)) {
        if (aborted || res.writableEnded) break
        res.write(`data: ${JSON.stringify(chunkToSSE(chunk))}\n\n`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error'
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
    }

    res.write('data: [DONE]\n\n')
    res.end()
  }

  return { handleCommand, handleChat, handleChatStream, core }
}
