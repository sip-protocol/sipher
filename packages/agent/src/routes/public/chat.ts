import { Router, type Request, type Response } from 'express'
import { ipRateLimitMiddleware } from '../../lib/ip-rate-limit.js'
import { chatStream, type SSEEvent } from '../../agent.js'

// ─────────────────────────────────────────────────────────────────────────────
// Public, unauthenticated SSE chat endpoint (POST /api/public/chat/stream).
//
// Wave 2b D20 contract:
//   - 5 messages per IP per 24 hours (rate-limit key 'chat')
//   - No tools (empty array passed to chatStream — Pi runtime emits no
//     tool_use / tool_result events because the agent has no tools to call)
//   - Restricted system prompt (UNAUTHED_SYSTEM_PROMPT below) — model
//     refuses wallet/tool/balance queries and stays on privacy education
//   - SSE shape mirrors authed /api/chat/stream so the FE's existing parser
//     handles both modes. Only content_block_delta + error + message_complete
//     events are emitted in practice (no tools → no tool/sentinel events).
//
// Pattern selected: Strategy A from the implementation plan — call chatStream
// directly with `tools: []` and `systemPrompt: UNAUTHED_SYSTEM_PROMPT`. This
// keeps the blast radius surgical (no new agent loop, no AgentCore profile
// duplication, no chatStream signature drift). The Pi runtime cleanly
// degrades to a tool-less conversation when the tools array is empty.
// ─────────────────────────────────────────────────────────────────────────────

export const UNAUTHED_SYSTEM_PROMPT = `You are SIPHER's educational assistant. Answer concise general questions about: SIPHER (multi-chain privacy command center), shielded payments, stealth addresses, Pedersen commitments, viewing keys, and privacy tradeoffs on Solana and EVM chains.

If the user asks about their wallet, balances, transactions, prices, accounts, or anything that would require running a tool, politely refuse and suggest they connect their wallet to use SIPHER fully.

Never claim to do anything on-chain. You have no tools available in this mode. Keep answers under 200 words. If asked something off-topic, politely redirect to SIPHER topics.`

const MAX_MESSAGE_LENGTH = 4000

interface InboundMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * Extract the last user message from a chat-style messages array.
 * Mirrors the authed `extractLastUserMessage` helper in adapters/web.ts.
 */
function extractLastUserMessage(messages: unknown): string | null {
  if (!Array.isArray(messages) || messages.length === 0) return null
  const userMessages = (messages as InboundMessage[]).filter((m) => m?.role === 'user')
  if (userMessages.length === 0) return null
  const last = userMessages[userMessages.length - 1]?.content
  return typeof last === 'string' && last.length > 0 ? last : null
}

export const chatRouter = Router()

chatRouter.post(
  '/stream',
  ipRateLimitMiddleware('chat', 5, 24 * 60 * 60 * 1000),
  async (req: Request, res: Response) => {
    const lastUserMsg = extractLastUserMessage(req.body?.messages)
    if (!lastUserMsg) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'messages array is required and must contain at least one user message',
        },
      })
      return
    }
    if (lastUserMsg.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: `message exceeds ${MAX_MESSAGE_LENGTH} character limit`,
        },
      })
      return
    }

    // SSE headers — flushHeaders commits the X-RateLimit-* headers set by
    // ipRateLimitMiddleware so the FE can read remaining before the body
    // arrives, and prevents nginx buffering from delaying the first event.
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    let aborted = false
    res.on('close', () => {
      aborted = true
    })

    try {
      const stream: AsyncGenerator<SSEEvent> = chatStream(lastUserMsg, {
        systemPrompt: UNAUTHED_SYSTEM_PROMPT,
        tools: [],
      })
      for await (const event of stream) {
        if (aborted || res.writableEnded) break
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error'
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
      }
    }

    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n')
      res.end()
    }
  },
)
