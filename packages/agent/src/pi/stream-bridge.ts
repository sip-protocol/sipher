import type { Agent, AgentEvent, AgentMessage } from '@mariozechner/pi-agent-core'
import { attachToolGuard } from './tool-guard.js'

// ─────────────────────────────────────────────────────────────────────────────
// Stream Bridge — Pi AgentEvent → SSEEvent async generator
// ─────────────────────────────────────────────────────────────────────────────
// Pi SDK uses an event-subscriber model (agent.subscribe((event) => ...)).
// agent.ts's existing chatStream yields SSEEvent objects consumed by AgentCore.
// This module bridges those two models so Task 6 can be a drop-in replacement:
//   - mapPiEventToSSE: pure, synchronous, easily tested in isolation
//   - streamPiAgent: wraps a Pi Agent run as an async generator using a
//     queue + Promise pattern to convert push events into pull iteration

/**
 * SSE event types yielded by the stream bridge.
 * Mirrors the existing SSEEvent shape from agent.ts so AgentCore.streamMessage
 * consumes Pi-backed output identically to the legacy Anthropic loop.
 */
export interface SSEContentDelta { type: 'content_block_delta'; text: string }
export interface SSEToolUse { type: 'tool_use'; name: string; id: string }
export interface SSEToolResult { type: 'tool_result'; name: string; id: string; success: boolean }
export interface SSEMessageComplete { type: 'message_complete'; content: string }
export interface SSEError { type: 'error'; message: string }

export type SSEEvent =
  | SSEContentDelta
  | SSEToolUse
  | SSEToolResult
  | SSEMessageComplete
  | SSEError

// Internal view of an AssistantMessage for content extraction at agent_end.
interface MessageLike {
  role: string
  content?: Array<{ type: string; text?: string }>
}

/**
 * Map a single Pi AgentEvent to zero or more SSEEvents.
 *
 * Pure function — no IO, no side effects. Every supported event type has
 * explicit handling; unrecognised events return [].
 *
 * Note on tool_execution_end: the real Pi SDK emits `isError` directly on
 * the event object. Test fixtures cast via `as unknown` and place it inside
 * `result.isError`. We check the top-level field first (real SDK path) and
 * fall back to `result.isError` (test fixture path) for full compatibility.
 */
export function mapPiEventToSSE(event: AgentEvent): SSEEvent[] {
  // ── Text streaming ────────────────────────────────────────────────────────
  if (event.type === 'message_update') {
    const e = event as {
      type: 'message_update'
      assistantMessageEvent: { type: string; delta?: string }
    }
    if (e.assistantMessageEvent?.type === 'text_delta' && e.assistantMessageEvent.delta) {
      return [{ type: 'content_block_delta', text: e.assistantMessageEvent.delta }]
    }
    return []
  }

  // ── Tool lifecycle ────────────────────────────────────────────────────────
  if (event.type === 'tool_execution_start') {
    const e = event as { type: 'tool_execution_start'; toolCallId: string; toolName: string }
    return [{ type: 'tool_use', name: e.toolName, id: e.toolCallId }]
  }

  if (event.type === 'tool_execution_end') {
    const e = event as {
      type: 'tool_execution_end'
      toolCallId: string
      toolName: string
      isError?: boolean
      result?: { isError?: boolean }
    }
    const failed =
      typeof e.isError === 'boolean' ? e.isError : (e.result?.isError ?? false)
    return [{ type: 'tool_result', name: e.toolName, id: e.toolCallId, success: !failed }]
  }

  // ── Agent finished — emit final assistant text as message_complete ────────
  if (event.type === 'agent_end') {
    const e = event as { type: 'agent_end'; messages: AgentMessage[] }
    const lastAssistant = [...e.messages]
      .reverse()
      .find((m) => (m as MessageLike).role === 'assistant') as MessageLike | undefined
    const content =
      lastAssistant?.content
        ?.filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('') ?? ''
    return [{ type: 'message_complete', content }]
  }

  return []
}

/**
 * Wrap a Pi Agent run as an async generator of SSEEvents.
 *
 * The agent must have its tools, model, and system prompt configured before
 * calling this. Any prior conversation history must already be present in
 * `agent.state.messages`.
 *
 * Uses a queue + Promise pattern to convert Pi's push-based event subscription
 * into a pull-based async generator:
 * - Events arrive synchronously via the subscriber callback
 * - They are enqueued and a pending Promise is resolved to wake the generator
 * - The generator yields from the queue and waits when empty
 * - Cleanup via unsubscribe() in finally, regardless of early return or throw
 */
export async function* streamPiAgent(
  agent: Agent,
  userMessage: string,
): AsyncGenerator<SSEEvent, void, unknown> {
  const queue: SSEEvent[] = []
  let resolveNext: (() => void) | null = null
  let done = false
  let errorEvent: SSEError | null = null

  const wake = (): void => {
    if (resolveNext) {
      resolveNext()
      resolveNext = null
    }
  }

  const guardUnsub = attachToolGuard(agent)

  const unsubscribe = agent.subscribe((event) => {
    // Guard against post-completion events
    if (done) return

    try {
      const events = mapPiEventToSSE(event)
      for (const evt of events) queue.push(evt)
      if (event.type === 'agent_end') done = true
    } catch (err) {
      errorEvent = {
        type: 'error',
        message: err instanceof Error ? err.message : 'Unknown event handler error',
      }
      done = true
    }
    wake()
  })

  // Kick off the run without awaiting — events drive the generator.
  // Errors here become an error event rather than unhandled rejections.
  const runPromise = agent.prompt(userMessage).catch((err: unknown) => {
    errorEvent = {
      type: 'error',
      message: err instanceof Error ? err.message : 'Agent run failed',
    }
    done = true
    // The loop's `!done` guard catches the missed-wake case if resolveNext is null.
    wake()
  })

  try {
    while (!done || queue.length > 0) {
      while (queue.length > 0) {
        const evt = queue.shift()
        if (evt) yield evt
      }
      if (!done) {
        await new Promise<void>((resolve) => {
          resolveNext = resolve
        })
      }
    }
    if (errorEvent) yield errorEvent
  } finally {
    guardUnsub()
    unsubscribe()
    await runPromise
  }
}
