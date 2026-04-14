import type { MsgContext, ResponseChunk, AgentResponse, AgentConfig } from './types.js'
import { chat, chatStream } from '../agent.js'
import {
  resolveSession,
  getConversation,
  appendConversation,
} from '../session.js'
import { toAnthropicTools } from '../pi/tool-adapter.js'
import type Anthropic from '@anthropic-ai/sdk'
import type { Tool as PiTool } from '@mariozechner/pi-ai'

// ─────────────────────────────────────────────────────────────────────────────
// Tool format auto-detection
//
// AgentConfig.tools accepts either Anthropic.Tool[] (input_schema) or Pi
// Tool[] (parameters). We detect by sampling the first element and convert
// Pi tools to Anthropic format here — chat() and chatStream() both call
// createPiAgent which expects Anthropic.Tool[].
// ─────────────────────────────────────────────────────────────────────────────

function normalizeTools(
  tools: Anthropic.Tool[] | PiTool[] | undefined
): Anthropic.Tool[] | undefined {
  if (!tools || tools.length === 0) return tools as Anthropic.Tool[] | undefined
  // Detect by presence of `parameters` key (Pi) vs `input_schema` (Anthropic)
  const first = tools[0] as { parameters?: unknown; input_schema?: unknown }
  if (first.parameters !== undefined && first.input_schema === undefined) {
    return toAnthropicTools(tools as PiTool[])
  }
  return tools as Anthropic.Tool[]
}

// ─────────────────────────────────────────────────────────────────────────────
// AgentCore — platform-agnostic message processing
//
// Wraps the LLM chat/stream functions with session management and
// conversation persistence. Any platform adapter (web, Telegram, X)
// constructs a MsgContext and hands it to AgentCore.
// ─────────────────────────────────────────────────────────────────────────────

export class AgentCore {
  private config: AgentConfig
  private normalizedTools: Anthropic.Tool[] | undefined

  constructor(config: AgentConfig = {}) {
    this.config = config
    this.normalizedTools = normalizeTools(config.tools)
  }

  /**
   * Process a message synchronously (non-streaming).
   *
   * Resolves the user's session, loads conversation history, calls the Pi
   * agent loop, and persists the conversation turn before returning.
   */
  async processMessage(ctx: MsgContext): Promise<AgentResponse> {
    const session = resolveSession(ctx.userId)
    const history = getConversation(session.id)

    // Convert sipher ConversationMessage[] to Pi UserMessage/AssistantMessage format.
    // UserMessage requires a timestamp; we use 0 as a sentinel for synthetic history.
    const piHistory = history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content as string,
      timestamp: 0,
    }))

    const { text, toolsUsed } = await chat(ctx.message, {
      systemPrompt: this.config.systemPrompt,
      tools: this.normalizedTools,
      toolExecutor: this.config.toolExecutor,
      model: this.config.model,
      history: piHistory as never,
      sessionId: session.id,
    })

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
   * SSE events arrive from the Pi agent. Persists the conversation after the
   * stream completes, then yields a final 'done' chunk.
   */
  async *streamMessage(ctx: MsgContext): AsyncGenerator<ResponseChunk> {
    const session = resolveSession(ctx.userId)
    const history = getConversation(session.id)

    // Convert sipher ConversationMessage[] to Pi AgentMessage format.
    const piHistory = history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content as string,
      timestamp: 0,
    }))

    let fullText = ''

    for await (const event of chatStream(ctx.message, {
      systemPrompt: this.config.systemPrompt,
      tools: this.normalizedTools,
      toolExecutor: this.config.toolExecutor,
      model: this.config.model,
      history: piHistory as never,
      sessionId: session.id,
    })) {
      switch (event.type) {
        case 'content_block_delta':
          fullText += event.text
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
