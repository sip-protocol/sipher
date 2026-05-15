import { randomUUID } from 'crypto'

/**
 * In-flight pending signing flag. Lives in the in-memory Map until the
 * client POSTs /api/tool-signing/:flagId/confirm (or /reject), or the
 * TIMEOUT_MS timer fires.
 */
export interface PendingSigningFlag {
  sessionId: string
  toolName: 'send' | 'swap'
  /** Wallet that initiated — must match JWT wallet on callback */
  wallet: string
  /** Base64-encoded unsigned transaction */
  serializedTx: string
  network: 'mainnet-beta' | 'devnet'
  toolInput: unknown
  createdAt: number
  resolver: (signature: string) => void
  rejecter: (reason: Error) => void
  timeoutHandle: NodeJS.Timeout
}

let TIMEOUT_MS = 5 * 60 * 1000
const pending = new Map<string, PendingSigningFlag>()

export function _setTimeoutMsForTests(ms: number): void {
  TIMEOUT_MS = ms
}

export interface CreatePendingSigningParams {
  sessionId: string
  toolName: 'send' | 'swap'
  wallet: string
  serializedTx: string
  network: 'mainnet-beta' | 'devnet'
  toolInput: unknown
  /**
   * Optional callback invoked once when the TTL fires, BEFORE the awaiting
   * promise is rejected. Used to emit a `tool_signing_expired` SSE event
   * so the active client SSE stream can transition its SignTxCard to an
   * expired state. Throws are suppressed — emission failure must not block
   * the reject path.
   */
  onExpire?: (flagId: string) => void
}

export function createPendingSigning(
  params: CreatePendingSigningParams,
): { flagId: string; promise: Promise<string> } {
  const flagId = randomUUID()
  let resolver!: (signature: string) => void
  let rejecter!: (reason: Error) => void
  const promise = new Promise<string>((resolve, reject) => {
    resolver = resolve
    rejecter = reject
  })
  const timeoutHandle = setTimeout(() => {
    if (pending.has(flagId)) {
      pending.delete(flagId)
      if (params.onExpire) {
        try {
          params.onExpire(flagId)
        } catch (err) {
          console.warn(
            `[signing] onExpire callback threw (suppressed): ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      }
      rejecter(new Error('operation timed out'))
    }
  }, TIMEOUT_MS)
  pending.set(flagId, {
    sessionId: params.sessionId,
    toolName: params.toolName,
    wallet: params.wallet,
    serializedTx: params.serializedTx,
    network: params.network,
    toolInput: params.toolInput,
    createdAt: Date.now(),
    resolver,
    rejecter,
    timeoutHandle,
  })
  return { flagId, promise }
}

export function resolvePendingSigning(flagId: string, signature: string): boolean {
  const entry = pending.get(flagId)
  if (!entry) return false
  clearTimeout(entry.timeoutHandle)
  pending.delete(flagId)
  entry.resolver(signature)
  return true
}

export function rejectPendingSigning(flagId: string, reason: string): boolean {
  const entry = pending.get(flagId)
  if (!entry) return false
  clearTimeout(entry.timeoutHandle)
  pending.delete(flagId)
  entry.rejecter(new Error(reason))
  return true
}

export function clearAllSigning(sessionId: string): void {
  for (const [flagId, entry] of pending.entries()) {
    if (entry.sessionId === sessionId) {
      clearTimeout(entry.timeoutHandle)
      pending.delete(flagId)
      entry.rejecter(new Error('client_disconnected'))
    }
  }
}

export function getPendingSigning(flagId: string): PendingSigningFlag | undefined {
  return pending.get(flagId)
}
