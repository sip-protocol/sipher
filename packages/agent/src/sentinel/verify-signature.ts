import type { Connection } from '@solana/web3.js'
import type { PendingSigningFlag } from './pending-signing.js'

/**
 * Result of server-side signature verification.
 *
 * Discriminated union so the consumer (confirm route) can switch on `reason`
 * without losing type narrowing. The `assertNever` exhaustiveness guard added
 * in PR #277 applies here when the consumer dispatches on this union.
 */
export type VerifyResult =
  | { ok: true; slot: number }
  | {
      ok: false
      reason: 'not_confirmed' | 'wallet_mismatch' | 'rpc_error' | 'timeout'
      detail?: string
    }

export interface VerifyOptions {
  connection: Connection
  /** Total budget for verification. Default 3000ms. */
  timeoutMs?: number
}

/**
 * Verify that a signature submitted to /api/tool-signing/:flagId/confirm
 * corresponds to a real on-chain Solana transaction signed by the wallet
 * recorded in the pending entry.
 *
 * Two tiers:
 *  - T1: getSignatureStatuses — confirmed/finalized AND no err
 *  - T2: getTransaction — fee payer (accountKeys[0]) === entry.wallet
 *
 * T3 (instruction-match against entry.serializedTx) is deferred per spec.
 *
 * Returns a discriminated VerifyResult — caller decides how to act based on
 * the SIPHER_SIG_VERIFY mode.
 */
export async function verifySignature(
  signature: string,
  entry: PendingSigningFlag,
  opts: VerifyOptions,
): Promise<VerifyResult> {
  const timeoutMs = opts.timeoutMs ?? 3000
  return Promise.race([
    runVerification(signature, entry, opts.connection),
    new Promise<VerifyResult>((resolve) =>
      setTimeout(() => resolve({ ok: false, reason: 'timeout' }), timeoutMs),
    ),
  ])
}

async function runVerification(
  signature: string,
  entry: PendingSigningFlag,
  connection: Connection,
): Promise<VerifyResult> {
  // ── T1: existence + confirmation status ────────────────────────────────
  let statuses
  try {
    statuses = await connection.getSignatureStatuses([signature])
  } catch (err) {
    return {
      ok: false,
      reason: 'rpc_error',
      detail: err instanceof Error ? err.message : String(err),
    }
  }

  const status = statuses?.value?.[0]
  if (!status) {
    return { ok: false, reason: 'not_confirmed' }
  }

  if (status.err) {
    return {
      ok: false,
      reason: 'not_confirmed',
      detail: typeof status.err === 'object' ? JSON.stringify(status.err) : String(status.err),
    }
  }

  if (status.confirmationStatus !== 'confirmed' && status.confirmationStatus !== 'finalized') {
    return {
      ok: false,
      reason: 'not_confirmed',
      detail: `confirmationStatus=${status.confirmationStatus ?? 'unknown'}`,
    }
  }

  // ── T2: fee payer must match entry.wallet ──────────────────────────────
  let tx
  try {
    tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })
  } catch (err) {
    return {
      ok: false,
      reason: 'rpc_error',
      detail: err instanceof Error ? err.message : String(err),
    }
  }

  if (!tx) {
    return { ok: false, reason: 'not_confirmed', detail: 'tx body not available after confirmation' }
  }

  // Versioned messages expose `staticAccountKeys`; legacy messages use
  // `accountKeys`. Mocks provide whichever path the test cares about.
  // Index 0 is the fee payer in both shapes.
  const feePayer = extractFeePayer(tx.transaction?.message as unknown)
  if (feePayer !== entry.wallet) {
    return {
      ok: false,
      reason: 'wallet_mismatch',
      detail: `expected ${entry.wallet}, got ${feePayer ?? '(no fee payer)'}`,
    }
  }

  return { ok: true, slot: status.slot }
}

function extractFeePayer(message: unknown): string | null {
  if (message === null || typeof message !== 'object') return null
  const m = message as {
    staticAccountKeys?: Array<{ toBase58?: () => string } | string>
    accountKeys?: Array<{ toBase58?: () => string } | string>
  }
  const candidate = m.staticAccountKeys?.[0] ?? m.accountKeys?.[0]
  if (!candidate) return null
  if (typeof candidate === 'string') return candidate
  if (typeof candidate.toBase58 === 'function') return candidate.toBase58()
  return null
}
