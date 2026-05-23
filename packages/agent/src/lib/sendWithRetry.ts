import type { Connection } from '@solana/web3.js'

const RESUBMIT_INTERVAL_MS = 2000

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
 * Ported from app/src/lib/sendWithRetry.ts — see sipher#297 for why the
 * broadcast moved server-side.
 */
export interface SendAndConfirmDeps {
  /** Delay between background resubmits. Override in tests for speed. */
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
      // Extra microtask yield: gives the confirmTransaction resolution a chance
      // to set stopped=true before we fire a resubmit. This prevents spurious
      // extra sends when the sleep is an immediate Promise (e.g. in tests).
      await Promise.resolve()
      if (stopped) return
      submitOnce().catch(() => {})
    }
  }
  const resubmitPromise = resubmit()

  try {
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed',
    )
    return signature
  } finally {
    stopped = true
    await resubmitPromise.catch(() => {})
  }
}
