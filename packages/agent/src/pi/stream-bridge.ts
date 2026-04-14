import type { Agent, AgentEvent, AgentMessage } from '@mariozechner/pi-agent-core'

// ─────────────────────────────────────────────────────────────────────────────
// Stream Bridge — Pi AgentEvent → ResponseChunk async generator
// ─────────────────────────────────────────────────────────────────────────────
// Pi SDK uses an event-subscriber model (agent.subscribe((event) => ...)).
// Sipher's adapters (web.ts, x.ts) consume async generators of ResponseChunks.
// This module bridges those two models:
//   - mapPiEventToChunks: pure, synchronous, easily tested in isolation
//   - streamPiAgent: wraps a Pi Agent run as an async generator using a
//     queue + Promise pattern to convert push events into pull iteration

/**
 * Stream chunk format consumed by web/x adapters.
 * Mirrors the legacy Anthropic-based agent.ts output exactly.
 */
export interface ResponseChunk {
  type: 'text' | 'tool_use' | 'tool_result' | 'message_complete' | 'error'
  text?: string
  toolName?: string
  toolId?: string
  success?: boolean
}

// Internal view of an AssistantMessage for content extraction at agent_end.
// We only need role and content — don't import the full type to avoid coupling.
interface MessageLike {
  role: string
  content?: Array<{ type: string; text?: string }>
}

/**
 * Map a single Pi AgentEvent to zero or more ResponseChunks.
 *
 * Pure function — no IO, no side effects. Every supported event type has
 * explicit handling; unrecognised events return [].
 *
 * Note on tool_execution_end: the real Pi SDK emits `isError` directly on
 * the event object. Test fixtures cast via `as unknown` and place it inside
 * `result.isError`. We check the top-level field first (real SDK path) and
 * fall back to `result.isError` (test fixture path) for full compatibility.
 */
export function mapPiEventToChunks(event: AgentEvent): ResponseChunk[] {
  // ── Text streaming ────────────────────────────────────────────────────────
  if (event.type === 'message_update') {
    const e = event as {
      type: 'message_update'
      assistantMessageEvent: { type: string; delta?: string }
    }
    if (e.assistantMessageEvent?.type === 'text_delta' && e.assistantMessageEvent.delta) {
      return [{ type: 'text', text: e.assistantMessageEvent.delta }]
    }
    return []
  }

  // ── Tool lifecycle ────────────────────────────────────────────────────────
  if (event.type === 'tool_execution_start') {
    const e = event as { type: 'tool_execution_start'; toolCallId: string; toolName: string }
    return [{ type: 'tool_use', toolName: e.toolName, toolId: e.toolCallId }]
  }

  if (event.type === 'tool_execution_end') {
    const e = event as {
      type: 'tool_execution_end'
      toolCallId: string
      toolName: string
      isError?: boolean
      result?: { isError?: boolean }
    }
    // Real Pi SDK: isError is a top-level boolean on the event.
    // Test fixtures: isError is nested inside result.isError (cast via as unknown).
    const failed =
      typeof e.isError === 'boolean' ? e.isError : (e.result?.isError ?? false)
    return [{ type: 'tool_result', toolName: e.toolName, toolId: e.toolCallId, success: !failed }]
  }

  // ── Agent finished — emit final assistant text ────────────────────────────
  if (event.type === 'agent_end') {
    const e = event as { type: 'agent_end'; messages: AgentMessage[] }
    // Find the last assistant message in the transcript.
    // Cast to MessageLike after the find — no type predicate needed since
    // AgentMessage is a union that may not include MessageLike directly.
    const lastAssistant = [...e.messages]
      .reverse()
      .find((m) => (m as MessageLike).role === 'assistant') as MessageLike | undefined
    const text =
      lastAssistant?.content
        ?.filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('') ?? ''
    return [{ type: 'message_complete', text }]
  }

  return []
}

/**
 * Wrap a Pi Agent run as an async generator of ResponseChunks.
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
): AsyncGenerator<ResponseChunk, void, unknown> {
  const queue: ResponseChunk[] = []
  let resolveNext: (() => void) | null = null
  let done = false
  let errorChunk: ResponseChunk | null = null

  const wake = (): void => {
    if (resolveNext) {
      resolveNext()
      resolveNext = null
    }
  }

  const unsubscribe = agent.subscribe((event) => {
    try {
      const chunks = mapPiEventToChunks(event)
      for (const chunk of chunks) queue.push(chunk)
      if (event.type === 'agent_end') done = true
    } catch (err) {
      errorChunk = {
        type: 'error',
        text: err instanceof Error ? err.message : 'Unknown event handler error',
      }
      done = true
    }
    wake()
  })

  // Kick off the run without awaiting — events drive the generator.
  // Errors here (network failures, model errors) are caught and emitted as an
  // error chunk rather than propagating as unhandled rejections.
  const runPromise = agent.prompt(userMessage).catch((err: unknown) => {
    errorChunk = {
      type: 'error',
      text: err instanceof Error ? err.message : 'Agent run failed',
    }
    done = true
    wake()
  })

  try {
    while (!done || queue.length > 0) {
      // Drain the queue before waiting
      while (queue.length > 0) {
        const chunk = queue.shift()
        if (chunk) yield chunk
      }
      // Block until the next event wakes us, or until done
      if (!done) {
        await new Promise<void>((resolve) => {
          resolveNext = resolve
        })
      }
    }

    // Emit any error that occurred during the run
    if (errorChunk) yield errorChunk
  } finally {
    unsubscribe()
    // Ensure the underlying run promise settles before the generator returns.
    // This prevents teardown races where the agent is still mid-execution.
    await runPromise
  }
}
