import type { Agent, AgentEvent } from '@mariozechner/pi-agent-core'

// ─────────────────────────────────────────────────────────────────────────────
// Tool execution guard
//
// Pi's agent loop has no built-in iteration cap. Without a guard, a
// misbehaving model could call tools indefinitely — a fund-safety risk given
// SIPHER's tool surface includes deposit, send, swap, sweep, and consolidate.
//
// attachToolGuard subscribes to tool_execution_end events, increments a
// counter, and calls agent.abort() once MAX_TOOLS_PER_RUN is reached.
//
// Usage:
//   const unsub = attachToolGuard(agent)
//   try {
//     await agent.prompt(message)
//   } finally {
//     unsub()
//   }
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_TOOLS_PER_RUN = 10

/**
 * Subscribe a tool-iteration guard to a Pi Agent. Counts tool_execution_end
 * events and calls agent.abort() when MAX_TOOLS_PER_RUN is reached.
 *
 * Returns the unsubscribe function — the caller must invoke it in `finally`
 * to clean up the subscription regardless of normal exit or error.
 */
export function attachToolGuard(agent: Agent): () => void {
  let toolCount = 0
  return agent.subscribe((event: AgentEvent) => {
    if ((event as { type: string }).type === 'tool_execution_end') {
      toolCount++
      if (toolCount >= MAX_TOOLS_PER_RUN) {
        try {
          agent.abort()
        } catch {
          // abort() may be a no-op if the run has already finished — safe to ignore
        }
      }
    }
  })
}
