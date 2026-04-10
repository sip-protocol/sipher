import type { MsgContext, ResponseChunk, AgentResponse } from './types.js'
import { chat, chatStream } from '../agent.js'
import {
  resolveSession,
  getConversation,
  appendConversation,
} from '../session.js'

// ─────────────────────────────────────────────────────────────────────────────
// AgentCore — platform-agnostic message processing
//
// Wraps the LLM chat/stream functions with session management and
// conversation persistence. Any platform adapter (web, Telegram, X)
// constructs a MsgContext and hands it to AgentCore.
// ─────────────────────────────────────────────────────────────────────────────

export class AgentCore {
  /**
   * Process a message synchronously (non-streaming).
   *
   * Resolves the user's session, loads conversation history, calls the LLM,
   * extracts text + tool usage, persists the conversation turn, and returns.
   */
  async processMessage(ctx: MsgContext): Promise<AgentResponse> {
    const session = resolveSession(ctx.userId)
    const history = getConversation(session.id)

    // Build messages: existing history + the new user message
    const messages = [
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content as string })),
      { role: 'user' as const, content: ctx.message },
    ]

    const response = await chat(messages)

    // Extract text from text blocks
    const textBlocks = response.content.filter(
      (b: { type: string }) => b.type === 'text'
    ) as { type: 'text'; text: string }[]
    const text = textBlocks.map((b) => b.text).join('')

    // Extract tool names from tool_use blocks
    const toolUseBlocks = response.content.filter(
      (b: { type: string }) => b.type === 'tool_use'
    ) as { type: 'tool_use'; name: string }[]
    const toolsUsed = toolUseBlocks.map((b) => b.name)

    // Persist the conversation turn
    appendConversation(session.id, [
      { role: 'user', content: ctx.message },
      { role: 'assistant', content: text },
    ])

    return { text, toolsUsed }
  }

  /**
   * Process a message with streaming.
   *
   * Same session/history resolution, but yields ResponseChunk objects as
   * SSE events arrive from the LLM. Persists the conversation after the
   * stream completes, then yields a final 'done' chunk.
   */
  async *streamMessage(ctx: MsgContext): AsyncGenerator<ResponseChunk> {
    const session = resolveSession(ctx.userId)
    const history = getConversation(session.id)

    const messages = [
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content as string })),
      { role: 'user' as const, content: ctx.message },
    ]

    let fullText = ''

    for await (const event of chatStream(messages)) {
      switch (event.type) {
        case 'content_block_delta':
          yield { type: 'text', text: event.text }
          break

        case 'tool_use':
          yield { type: 'tool_start', toolName: event.name, toolId: event.id }
          break

        case 'tool_result':
          yield {
            type: 'tool_end',
            toolName: event.name,
            toolId: event.id,
            success: event.success,
          }
          break

        case 'error':
          yield { type: 'error', text: event.message }
          break

        case 'message_complete':
          fullText = event.content
          break
      }
    }

    // Persist the completed conversation turn
    appendConversation(session.id, [
      { role: 'user', content: ctx.message },
      { role: 'assistant', content: fullText },
    ])

    yield { type: 'done', text: fullText }
  }
}
