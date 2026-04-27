import { randomUUID } from 'crypto'

interface PendingFlag {
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

export function _setTimeoutMsForTests(ms: number): void {
  TIMEOUT_MS = ms
}

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

export function resolvePending(flagId: string): boolean {
  const entry = pending.get(flagId)
  if (!entry) return false
  clearTimeout(entry.timeoutHandle)
  pending.delete(flagId)
  entry.resolver()
  return true
}

export function rejectPending(flagId: string, reason: string): boolean {
  const entry = pending.get(flagId)
  if (!entry) return false
  clearTimeout(entry.timeoutHandle)
  pending.delete(flagId)
  entry.rejecter(new Error(reason))
  return true
}

export function clearAll(sessionId: string): void {
  for (const [flagId, entry] of pending.entries()) {
    if (entry.sessionId === sessionId) {
      clearTimeout(entry.timeoutHandle)
      pending.delete(flagId)
      entry.rejecter(new Error('client_disconnected'))
    }
  }
}

export function getPending(flagId: string): PendingFlag | undefined {
  return pending.get(flagId)
}
