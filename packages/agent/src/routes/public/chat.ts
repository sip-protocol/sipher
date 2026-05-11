import { Router, type NextFunction, type Request, type Response } from 'express'
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
 * Assumes the input has already passed `validateChatBody` — the array shape
 * and per-message structure are guaranteed at this point.
 */
function extractLastUserMessage(messages: InboundMessage[]): string | null {
  const userMessages = messages.filter((m) => m.role === 'user')
  if (userMessages.length === 0) return null
  const last = userMessages[userMessages.length - 1]?.content
  return typeof last === 'string' && last.length > 0 ? last : null
}

/**
 * Validate the chat body BEFORE the rate-limit middleware runs.
 *
 * Why before rate-limit: malformed requests must not consume a 5/24h slot.
 * If validation ran after rate-limiting, an attacker who can spoof IPs could
 * deplete a victim's budget with junk payloads. Behind nginx with trust
 * proxy=1 the IP-spoof surface is small, but the Vercel migration changes
 * the exposure profile, so we lock the safer order in now.
 */
function validateChatBody(req: Request, res: Response, next: NextFunction): void {
  const messages = req.body?.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'messages array is required and must contain at least one user message',
      },
    })
    return
  }
  for (const m of messages) {
    if (!m || typeof m !== 'object' || typeof m.role !== 'string' || typeof m.content !== 'string') {
      res.status(400).json({
        error: { code: 'VALIDATION_FAILED', message: 'invalid message shape' },
      })
      return
    }
  }
  const lastUserMsg = extractLastUserMessage(messages as InboundMessage[])
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
  next()
}

async function handleChatStream(req: Request, res: Response): Promise<void> {
  // validateChatBody guarantees a non-empty user message — extractLastUserMessage
  // cannot return null here.
  const lastUserMsg = extractLastUserMessage(req.body.messages as InboundMessage[])!

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
    // Sanitize before writing to the stream. Anonymous clients receive a
    // generic message; the raw error stays in server logs (operator
    // visibility) so we don't leak OpenRouter/model/infra details into
    // the assistant bubble where the FE paints SSE error events.
    console.error('[public/chat] chatStream error:', err)
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Service temporarily unavailable' })}\n\n`)
    }
  }

  if (!res.writableEnded) {
    res.write('data: [DONE]\n\n')
    res.end()
  }
}

export const chatRouter = Router()

// Middleware order matters: validateChatBody → rate-limit → handler.
// Malformed requests return 400 without consuming a rate-limit slot.
chatRouter.post(
  '/stream',
  validateChatBody,
  ipRateLimitMiddleware('chat', 5, 24 * 60 * 60 * 1000),
  handleChatStream,
)
