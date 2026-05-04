import { randomUUID } from 'crypto'

// Reference: docs/sentinel/rest-api.md (promise-gate routes)

/**
 * Shape of an in-flight pending flag stored in the Map.
 * Carries the session context, tool call details, and the promise control handles.
 * The `timeoutHandle` fires after `TIMEOUT_MS` to auto-reject abandoned flags.
 */
export interface PendingFlag {
  sessionId: string
  toolName: string
  toolInput: unknown
  createdAt: number
  resolver: (value: void) => void
  rejecter: (reason: Error) => void
  timeoutHandle: NodeJS.Timeout
}

let TIMEOUT_MS = 120_000
const pending = new Map<string, PendingFlag>()

/**
 * Override the pending-flag timeout for unit tests.
 * Not for production use — internal test seam only.
 * @param ms - timeout in milliseconds (replaces the 120s default)
 */
export function _setTimeoutMsForTests(ms: number): void {
  TIMEOUT_MS = ms
}

/**
 * Create an in-memory pending flag awaiting admin approval or denial.
 * Used by the pause/resume flow when SentinelCore returns a `flag` verdict in advisory mode.
 * The returned `promise` resolves on `resolvePending(flagId)` or rejects on `rejectPending(flagId)`
 * or after `TIMEOUT_MS` (120 s by default).
 * @param sessionId - active SSE session identifier (used by `clearAll` on disconnect)
 * @param toolName - name of the tool call being gated (forwarded to the admin UI)
 * @param toolInput - full tool input payload (forwarded to the admin UI for review)
 * @returns `{ flagId, promise }` — emit `flagId` in the SSE `sentinel_pause` event;
 *   await `promise` in the tool executor until the admin resolves or rejects the flag.
 * @see docs/sentinel/rest-api.md#post-apisentinelpromise-gateflagidresolve
 */
export function createPending(
  sessionId: string,
  toolName: string,
  toolInput: unknown,
): { flagId: string; promise: Promise<void> } {
  const flagId = randomUUID()
  let resolver!: (value: void) => void
  let rejecter!: (reason: Error) => void
  const promise = new Promise<void>((resolve, reject) => {
    resolver = resolve
    rejecter = reject
  })
  const timeoutHandle = setTimeout(() => {
    if (pending.has(flagId)) {
      pending.delete(flagId)
      rejecter(new Error('operation timed out'))
    }
  }, TIMEOUT_MS)
  pending.set(flagId, {
    sessionId,
    toolName,
    toolInput,
    createdAt: Date.now(),
    resolver,
    rejecter,
    timeoutHandle,
  })
  return { flagId, promise }
}

/**
 * Resolve a pending flag — admin approval path.
 * Mapped to `POST /api/sentinel/promise-gate/:flagId/resolve`.
 * Clears the auto-timeout, removes the flag from the Map, and calls the promise resolver.
 * @param flagId - flag identifier returned by `createPending`
 * @returns `true` if the flag existed and was resolved; `false` if not found or already settled.
 * @see docs/sentinel/rest-api.md#post-apisentinelpromise-gateflagidresolve
 */
export function resolvePending(flagId: string): boolean {
  const entry = pending.get(flagId)
  if (!entry) return false
  clearTimeout(entry.timeoutHandle)
  pending.delete(flagId)
  entry.resolver()
  return true
}

/**
 * Reject a pending flag — admin denial path.
 * Mapped to `POST /api/sentinel/promise-gate/:flagId/reject`.
 * Clears the auto-timeout, removes the flag from the Map, and rejects the promise with `reason`.
 * @param flagId - flag identifier returned by `createPending`
 * @param reason - rejection reason string (e.g. `'cancelled_by_user'`), wrapped in an Error
 * @returns `true` if the flag existed and was rejected; `false` if not found or already settled.
 * @see docs/sentinel/rest-api.md#post-apisentinelpromise-gateflagidreject
 */
export function rejectPending(flagId: string, reason: string): boolean {
  const entry = pending.get(flagId)
  if (!entry) return false
  clearTimeout(entry.timeoutHandle)
  pending.delete(flagId)
  entry.rejecter(new Error(reason))
  return true
}

/**
 * Reject and remove all pending flags belonging to a session.
 * Called when the SSE client disconnects so gated tool calls don't hang indefinitely.
 * Each flag is rejected with `'client_disconnected'`.
 * @param sessionId - session whose flags should be cleared
 */
export function clearAll(sessionId: string): void {
  for (const [flagId, entry] of pending.entries()) {
    if (entry.sessionId === sessionId) {
      clearTimeout(entry.timeoutHandle)
      pending.delete(flagId)
      entry.rejecter(new Error('client_disconnected'))
    }
  }
}

/**
 * Look up a pending flag by its identifier.
 * Used by REST handlers to validate that a flag exists before resolving or rejecting it.
 * @param flagId - flag identifier returned by `createPending`
 * @returns the `PendingFlag` entry, or `undefined` if not found or already settled.
 */
export function getPending(flagId: string): PendingFlag | undefined {
  return pending.get(flagId)
}
