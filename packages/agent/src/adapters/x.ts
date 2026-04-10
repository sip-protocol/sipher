import type { Tool } from '@mariozechner/pi-ai'
import type Anthropic from '@anthropic-ai/sdk'
import type { GuardianEvent } from '../coordination/event-bus.js'
import { AgentCore } from '../core/agent-core.js'
import { HERALD_SYSTEM_PROMPT, HERALD_TOOLS, HERALD_TOOL_EXECUTORS } from '../herald/herald.js'
import { getBudgetStatus } from '../herald/budget.js'
import { guardianBus } from '../coordination/event-bus.js'

// ─────────────────────────────────────────────────────────────────────────────
// X Adapter — subscribes to herald:mention / herald:dm events on guardianBus
// and routes them through AgentCore for LLM-powered responses.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert Pi SDK Tool[] to Anthropic Tool[] format.
 * Pi SDK uses `parameters`, Anthropic expects `input_schema`.
 */
export function toAnthropicTools(piTools: Tool[]): Anthropic.Tool[] {
  return piTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters as Anthropic.Tool['input_schema'],
  }))
}

/**
 * Build a tool executor that dispatches to HERALD_TOOL_EXECUTORS by name.
 * Throws if the tool is not registered.
 */
function heraldToolExecutor(name: string, input: Record<string, unknown>): Promise<unknown> {
  const executor = HERALD_TOOL_EXECUTORS[name]
  if (!executor) {
    throw new Error(`Unknown HERALD tool: ${name}`)
  }
  return executor(input)
}

/**
 * Create the X adapter — HERALD's LLM brain for mentions and DMs.
 *
 * Subscribes to `herald:mention` and `herald:dm` events on the guardianBus,
 * processes them through AgentCore, and auto-replies when the LLM doesn't
 * already use `replyTweet` or `sendDM` tools.
 */
export function createXAdapter() {
  const core = new AgentCore({
    systemPrompt: HERALD_SYSTEM_PROMPT,
    tools: toAnthropicTools(HERALD_TOOLS),
    toolExecutor: heraldToolExecutor,
    model: process.env.HERALD_MODEL ?? 'anthropic/claude-sonnet-4-6',
  })

  // ───────────────────────────────────────────────────────────────────────
  // herald:mention handler
  // ───────────────────────────────────────────────────────────────────────

  async function handleMention(event: GuardianEvent): Promise<void> {
    const { mentionId, authorId, text, intent } = event.data as {
      mentionId: string
      authorId: string | null
      text: string
      intent: string
    }

    if (intent === 'spam') return

    const { gate } = getBudgetStatus()
    if (gate === 'paused' || gate === 'dm-only') return

    const response = await core.processMessage({
      platform: 'x',
      userId: authorId ?? 'unknown',
      message: text,
      metadata: { mentionId, intent },
    })

    // Auto-reply if the LLM produced text but didn't already call replyTweet
    if (response.text && !response.toolsUsed.includes('replyTweet')) {
      await heraldToolExecutor('replyTweet', {
        tweet_id: mentionId,
        text: response.text.slice(0, 280),
      })
    }

    guardianBus.emit({
      source: 'herald',
      type: 'herald:reply-sent',
      level: 'routine',
      data: { mentionId, toolsUsed: response.toolsUsed },
      timestamp: new Date().toISOString(),
    })
  }

  // ───────────────────────────────────────────────────────────────────────
  // herald:dm handler
  // ───────────────────────────────────────────────────────────────────────

  async function handleDM(event: GuardianEvent): Promise<void> {
    const { dmId, senderId, text, intent } = event.data as {
      dmId: string
      senderId: string | null
      text: string
      intent: string
    }

    if (intent === 'spam') return

    const { gate } = getBudgetStatus()
    if (gate === 'paused') return

    const response = await core.processMessage({
      platform: 'x',
      userId: senderId ?? 'unknown',
      message: text,
      metadata: { dmId, intent, isDM: true },
    })

    // Auto-reply if the LLM produced text but didn't already call sendDM
    if (response.text && !response.toolsUsed.includes('sendDM')) {
      await heraldToolExecutor('sendDM', {
        user_id: senderId,
        text: response.text,
      })
    }

    guardianBus.emit({
      source: 'herald',
      type: 'herald:dm-replied',
      level: 'routine',
      data: { dmId, toolsUsed: response.toolsUsed },
      timestamp: new Date().toISOString(),
    })
  }

  // ───────────────────────────────────────────────────────────────────────
  // Wrapped handlers — try/catch to never crash the event bus
  // ───────────────────────────────────────────────────────────────────────

  guardianBus.on('herald:mention', (event: GuardianEvent) => {
    handleMention(event).catch((err) => {
      const message = err instanceof Error ? err.message : String(err)
      guardianBus.emit({
        source: 'herald',
        type: 'herald:reply-failed',
        level: 'important',
        data: {
          mentionId: (event.data as Record<string, unknown>).mentionId,
          error: message,
        },
        timestamp: new Date().toISOString(),
      })
    })
  })

  guardianBus.on('herald:dm', (event: GuardianEvent) => {
    handleDM(event).catch((err) => {
      const message = err instanceof Error ? err.message : String(err)
      guardianBus.emit({
        source: 'herald',
        type: 'herald:dm-reply-failed',
        level: 'important',
        data: {
          dmId: (event.data as Record<string, unknown>).dmId,
          error: message,
        },
        timestamp: new Date().toISOString(),
      })
    })
  })

  return { core, handleMention, handleDM }
}
