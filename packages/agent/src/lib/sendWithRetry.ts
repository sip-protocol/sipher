import type { Connection } from '@solana/web3.js'

const RESUBMIT_INTERVAL_MS = 2000

/**
 * Thrown when a transaction lands on-chain but the program returns an error.
 *
 * Distinguishes "confirmed with program err" from "broadcast rejected" and
 * "blockheight expired". Lets /api/tx/broadcast return a structured 502
 * with the err payload instead of a 200 with a failed signature (or a CF 504
 * from hanging until edge timeout). See sipher#299.
 */
export class TransactionFailedOnChainError extends Error {
  readonly signature: string
  readonly err: unknown

  constructor(signature: string, err: unknown) {
    const detail = typeof err === 'object' ? JSON.stringify(err) : String(err)
    super(`Transaction ${signature} confirmed on-chain but the program returned an error: ${detail}`)
    this.name = 'TransactionFailedOnChainError'
    this.signature = signature
    this.err = err
  }
}

/**
 * Send a signed transaction and aggressively resubmit until confirmed or expired.
 *
 * Public Solana RPCs are rate-limited and drop transactions silently under load.
 * The default sendRawTransaction + confirmTransaction flow waits ~60-90s for
 * confirmation but does NOT resubmit if the first send was dropped — leading
 * to spurious "block height exceeded" errors when the tx never actually landed.
 *
 * This helper resubmits the same signed bytes every 2s in the background
 * (idempotent: Solana RPCs return the same signature for duplicate sends)
 * while polling for confirmation. First confirmation wins; the loop stops.
 *
 * A parallel getSignatureStatuses poll runs alongside confirmTransaction so a
 * confirmed-with-program-err tx surfaces within seconds even if the WS
 * subscription is slow to fire. Either path throws
 * TransactionFailedOnChainError when value.err is non-null.
 *
 * Ported from app/src/lib/sendWithRetry.ts — see sipher#297 for why the
 * broadcast moved server-side, sipher#299 for the bail-on-err addition.
 *
 * Exported for testing; injected interval/sleep keeps tests deterministic.
 */
export interface SendAndConfirmDeps {
  /** Delay between background resubmits and status polls. Override in tests for speed. */
  resubmitIntervalMs?: number
  /** Awaitable sleep. Override in tests with fake timers. */
  sleep?: (ms: number) => Promise<void>
}

export async function sendAndConfirmWithRetry(
  connection: Connection,
  signedTx: Uint8Array,
  blockhash: string,
  lastValidBlockHeight: number,
  deps: SendAndConfirmDeps = {},
): Promise<string> {
  const interval = deps.resubmitIntervalMs ?? RESUBMIT_INTERVAL_MS
  const sleep = deps.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)))

  const submitOnce = () =>
    connection.sendRawTransaction(signedTx, { skipPreflight: true, maxRetries: 0 })

  const signature = await submitOnce()

  let stopped = false
  const resubmit = async () => {
    while (!stopped) {
      await sleep(interval)
      if (stopped) return
      submitOnce().catch(() => {})
    }
  }
  const resubmitPromise = resubmit()

  // Defense-in-depth: if confirmTransaction's WS subscription is slow to fire
  // when value.err is non-null, this poll surfaces the err first. Resolves with
  // null on cleanup (stopped=true) so the race below sees a definitive winner.
  const pollForErr = async (): Promise<TransactionFailedOnChainError | null> => {
    while (!stopped) {
      await sleep(interval)
      if (stopped) return null
      try {
        const result = await connection.getSignatureStatuses([signature])
        const status = result?.value?.[0]
        if (status?.err) {
          return new TransactionFailedOnChainError(signature, status.err)
        }
      } catch {
        // RPC hiccup during poll — keep going. confirmTransaction handles
        // genuine expiry via TransactionExpiredBlockheightExceededError.
      }
    }
    return null
  }

  const confirmInspected = async (): Promise<string> => {
    let result
    try {
      result = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      )
    } catch (err) {
      // web3.js's WS-subscription path resolves with { value: { err } }, but the
      // getSignatureStatus polling fallback (Connection#getTransactionConfirmation
      // Promise in node_modules/@solana/web3.js) calls `reject(value.err)` — i.e.
      // it rejects with the bare TransactionError object (e.g.
      // { InstructionError: [0, { Custom: 3012 }] }), not a thrown Error.
      // Normalize so callers see a TransactionFailedOnChainError consistently
      // regardless of which path fired. See sipher#299 follow-up.
      if (err !== null && typeof err === 'object' && !(err instanceof Error)) {
        throw new TransactionFailedOnChainError(signature, err)
      }
      throw err
    }
    if (result?.value?.err) {
      throw new TransactionFailedOnChainError(signature, result.value.err)
    }
    return signature
  }

  const pollPromise = pollForErr()
  // Swallow any rejection so a poll error doesn't surface as an unhandled
  // rejection later. The race below will already have observed any err return.
  pollPromise.catch(() => {})

  try {
    // Race: confirmInspected returns signature (or throws); pollPromise returns
    // an err-or-null. The branch where pollPromise wins with null is structurally
    // unreachable here — pollForErr only returns null when stopped=true, which
    // is set in the finally block below. Treat that as an invariant violation.
    const winner = await Promise.race([
      confirmInspected().then((sig) => ({ kind: 'confirmed' as const, sig })),
      pollPromise.then((errOrNull) => ({ kind: 'polled' as const, errOrNull })),
    ])
    if (winner.kind === 'polled') {
      if (winner.errOrNull) throw winner.errOrNull
      throw new Error('invariant: pollForErr resolved null before sendAndConfirmWithRetry stopped')
    }
    return winner.sig
  } finally {
    stopped = true
    await resubmitPromise.catch(() => {})
    // pollPromise is left to exit on its own; it observes stopped=true on next
    // tick and returns null. Awaiting it here would add up to one `interval`
    // (default 2s) of cleanup latency to every successful broadcast.
  }
}
