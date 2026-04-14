import type Anthropic from '@anthropic-ai/sdk'
import type { Tool as PiTool } from '@mariozechner/pi-ai'

/** Configuration for an agent identity (tools, prompt, model) */
export interface AgentConfig {
  systemPrompt?: string
  /** Tools in either Anthropic format (input_schema) or Pi format (parameters). Auto-detected. */
  tools?: Anthropic.Tool[] | PiTool[]
  toolExecutor?: (name: string, input: Record<string, unknown>) => Promise<unknown>
  model?: string
}

/** Platform a message originated from */
export type Platform = 'web' | 'telegram' | 'x'

/**
 * Unified inbound message context — platform-agnostic.
 * Every adapter constructs this from its native format.
 */
export interface MsgContext {
  /** Platform the message came from */
  platform: Platform
  /** User identifier — wallet address (web), telegram user ID, X user ID */
  userId: string
  /** The user's message text */
  message: string
  /** Optional metadata from the platform (thread ID, reply-to, etc.) */
  metadata?: Record<string, unknown>
}

/** A single response chunk for streaming */
export interface ResponseChunk {
  type: 'text' | 'tool_start' | 'tool_end' | 'error' | 'done'
  text?: string
  toolName?: string
  toolId?: string
  success?: boolean
}

/** Full (non-streaming) agent response */
export interface AgentResponse {
  text: string
  toolsUsed: string[]
}
