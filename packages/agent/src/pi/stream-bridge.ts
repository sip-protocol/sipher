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
 * Optional injection points for external producers (e.g. the chatStream
 * sentinel pause loop) that need to interleave events into the bridge's
 * output stream WITHOUT waiting for a Pi event to arrive.
 *
 * Why this exists: when a tool executor blocks on a user-driven approval
 * (sentinel pause), the executor is awaited inside Pi's tool loop — Pi
 * can't emit events until the executor returns. Without this hook the
 * pause notification can't reach the SSE client until tool_execution_end,
 * which deadlocks the system (client never sees pause → never approves →
 * executor never resolves).
 *
 * The chatStream wrapper pushes pause events onto `externalQueue` and
 * calls the wake function (received via `attachWake`) to make the
 * generator drain its queues.
 *
 * Generic `T` lets callers extend the yielded event union with their own
 * variants (e.g. SSESentinelPause from agent.ts) without forcing this
 * module to import them.
 */
export interface StreamBridgeOptions<T = SSEEvent> {
  externalQueue?: Array<T>
  attachWake?: (wake: () => void) => void
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
 *
 * Optional `options.externalQueue` + `options.attachWake` allow callers to
 * inject events from outside the Pi event stream (used by chatStream's
 * sentinel pause loop — see chatStream in agent.ts).
 */
export async function* streamPiAgent<T = SSEEvent>(
  agent: Agent,
  userMessage: string,
  options?: StreamBridgeOptions<T>,
): AsyncGenerator<SSEEvent | T, void, unknown> {
  const queue: SSEEvent[] = []
  const externalQueue: Array<T> = options?.externalQueue ?? []
  let resolveNext: (() => void) | null = null
  let done = false
  let errorEvent: SSEError | null = null

  const wake = (): void => {
    if (resolveNext) {
      resolveNext()
      resolveNext = null
    }
  }

  // Hand the wake function back to the caller so external producers can push
  // into externalQueue and trigger a drain.
  if (options?.attachWake) options.attachWake(wake)

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
    while (!done || queue.length > 0 || externalQueue.length > 0) {
      // Drain externally-injected events first so pause notifications reach
      // the client BEFORE the corresponding tool_result.
      while (externalQueue.length > 0) {
        const evt = externalQueue.shift()
        if (evt) yield evt
      }
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
    // Abort the Pi run before awaiting settlement. If the consumer broke out of
    // the generator early (e.g. SSE client disconnect), this signals Pi to stop
    // the active LLM request and tool loop so we don't burn tokens or broadcast
    // on-chain transactions for an abandoned session. If the run already finished
    // normally, abort() is a no-op.
    try {
      agent.abort()
    } catch {
      // abort() may throw if called outside an active run — safe to ignore
    }
    await runPromise
  }
}
