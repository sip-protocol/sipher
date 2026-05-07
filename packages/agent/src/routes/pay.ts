import { Router } from 'express'
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getPaymentLink, markPaymentLinkPaid } from '../db.js'
import { loadNetworkConfig } from '../config/network.js'
import { guardianBus } from '../coordination/event-bus.js'
import { createStore } from '../state/ephemeral.js'
import {
  renderPaymentPage,
  renderExpiredPage,
  renderPaidPage,
  renderNotFoundPage,
} from '../views/pay-page.js'

export const payRouter = Router()

// ─────────────────────────────────────────────────────────────────────────────
// Per-link confirmation rate limit
// ─────────────────────────────────────────────────────────────────────────────
// 3 confirmation attempts per minute per payment-link id. Window-based (not
// pure TTL) — first attempt sets `firstAt`, subsequent attempts inside the
// 60s window increment the counter. After 60s of inactivity the entry's TTL
// will have lapsed and the next attempt starts a fresh budget. Mirrors the
// pattern in routes/auth.ts:nonceRateLimit so behavior is consistent across
// surfaces.

const PAY_CONFIRM_RATE_LIMIT_MAX = 3
const PAY_CONFIRM_RATE_LIMIT_WINDOW_MS = 60_000
const PAY_CONFIRM_RATE_LIMIT_WINDOW_SECONDS = PAY_CONFIRM_RATE_LIMIT_WINDOW_MS / 1000

const linkConfirmAttempts = createStore<{ count: number; firstAt: number }>(
  'linkConfirmAttempts',
  { maxSize: 10_000 },
)

// ─────────────────────────────────────────────────────────────────────────────
// On-chain transaction verification
// ─────────────────────────────────────────────────────────────────────────────

const errMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/**
 * Run on-chain verification against a single Connection. Returns a verifier
 * verdict (`{ valid: true }` or `{ valid: false, error }`) for the four
 * inspected conditions: tx not found, tx failed, recipient mismatch,
 * insufficient amount. Throws on actual RPC errors so the caller can decide
 * whether to fall back to a secondary endpoint.
 */
async function verifyOnConnection(
  connection: Connection,
  txSignature: string,
  expectedAddress: string,
  expectedAmount: number | null,
): Promise<{ valid: boolean; error?: string }> {
  const tx = await connection.getTransaction(txSignature, {
    maxSupportedTransactionVersion: 0,
  })

  if (!tx) {
    return { valid: false, error: 'transaction not found on-chain' }
  }

  if (tx.meta?.err) {
    return { valid: false, error: 'transaction failed on-chain' }
  }

  // Check the stealth address received funds
  const accountKeys = tx.transaction.message.getAccountKeys()
  const targetIndex = accountKeys.staticAccountKeys.findIndex(
    key => key.toBase58() === expectedAddress,
  )

  if (targetIndex === -1) {
    return { valid: false, error: 'transaction does not involve the expected address' }
  }

  // Verify amount if specified (1% tolerance for rounding)
  if (expectedAmount !== null && tx.meta) {
    const preBalance = tx.meta.preBalances[targetIndex] ?? 0
    const postBalance = tx.meta.postBalances[targetIndex] ?? 0
    const receivedLamports = postBalance - preBalance
    const receivedSol = receivedLamports / LAMPORTS_PER_SOL

    if (receivedSol < expectedAmount * 0.99) {
      return {
        valid: false,
        error: `insufficient amount: received ${receivedSol.toFixed(4)} SOL, expected ${expectedAmount} SOL`,
      }
    }
  }

  return { valid: true }
}

/**
 * Verify a Solana transaction on-chain before accepting payment confirmation.
 * Tries the primary RPC first; on RPC error tries the fallback RPC
 * (`SOLANA_RPC_URL_FALLBACK`, wired into compose by B15). Throws if both
 * fail (or if no fallback is configured and the primary errors). Verifier
 * verdicts (`{ valid: false, error: ... }`) are NOT errors and never
 * trigger fallback — they're valid "no, this signature doesn't pay this
 * link" answers.
 *
 * Emits two `guardianBus` events for operator visibility:
 *   - `pay:rpc-fallback-used` (important) — primary failed, fallback succeeded
 *   - `pay:rpc-all-failed` (critical) — primary + fallback both failed,
 *     OR primary failed with no fallback configured
 */
export async function verifyTransaction(
  txSignature: string,
  expectedAddress: string,
  expectedAmount: number | null,
): Promise<{ valid: boolean; error?: string }> {
  const primary = new Connection(loadNetworkConfig().rpcUrl, 'confirmed')

  try {
    return await verifyOnConnection(primary, txSignature, expectedAddress, expectedAmount)
  } catch (primaryErr) {
    const fallbackUrl = process.env.SOLANA_RPC_URL_FALLBACK
    if (!fallbackUrl) {
      guardianBus.emit({
        source: 'sipher',
        type: 'pay:rpc-all-failed',
        level: 'critical',
        data: {
          txSignature,
          primaryErr: errMessage(primaryErr),
          fallbackUrl: 'unset',
        },
        wallet: null,
        timestamp: new Date().toISOString(),
      })
      throw primaryErr
    }

    const fallback = new Connection(fallbackUrl, 'confirmed')
    try {
      const result = await verifyOnConnection(fallback, txSignature, expectedAddress, expectedAmount)
      guardianBus.emit({
        source: 'sipher',
        type: 'pay:rpc-fallback-used',
        level: 'important',
        data: {
          txSignature,
          primaryErr: errMessage(primaryErr),
        },
        wallet: null,
        timestamp: new Date().toISOString(),
      })
      return result
    } catch (fallbackErr) {
      guardianBus.emit({
        source: 'sipher',
        type: 'pay:rpc-all-failed',
        level: 'critical',
        data: {
          txSignature,
          primaryErr: errMessage(primaryErr),
          fallbackErr: errMessage(fallbackErr),
        },
        wallet: null,
        timestamp: new Date().toISOString(),
      })
      throw fallbackErr
    }
  }
}

payRouter.get('/:id', (req, res) => {
  const link = getPaymentLink(req.params.id)

  if (!link) {
    res.status(404).type('html').send(renderNotFoundPage())
    return
  }

  if (link.status === 'paid' && link.paid_tx) {
    res.type('html').send(renderPaidPage(link.paid_tx))
    return
  }

  if (link.status === 'expired' || link.expires_at < Date.now()) {
    res.status(410).type('html').send(renderExpiredPage())
    return
  }

  res.type('html').send(renderPaymentPage(link))
})

payRouter.post('/:id/confirm', async (req, res) => {
  const { txSignature } = req.body

  if (!txSignature || typeof txSignature !== 'string' || txSignature.length > 200) {
    res.status(400).json({ error: 'txSignature is required and must be a valid transaction signature' })
    return
  }

  const link = getPaymentLink(req.params.id)

  if (!link) {
    res.status(404).json({ error: 'Payment link not found' })
    return
  }

  if (link.status === 'paid') {
    res.status(409).json({ error: 'Payment link already paid' })
    return
  }

  if (link.status === 'expired' || link.expires_at < Date.now()) {
    res.status(410).json({ error: 'Payment link has expired' })
    return
  }

  // Per-link rate limit (3/min/link). Sits between status checks and
  // verifier so a flood of bad signatures can't burn unbounded RPC budget
  // against a single link.
  const linkId = req.params.id
  const now = Date.now()
  const entry = await linkConfirmAttempts.get(linkId)
  if (!entry || now - entry.firstAt > PAY_CONFIRM_RATE_LIMIT_WINDOW_MS) {
    await linkConfirmAttempts.set(
      linkId,
      { count: 1, firstAt: now },
      PAY_CONFIRM_RATE_LIMIT_WINDOW_SECONDS,
    )
  } else if (entry.count >= PAY_CONFIRM_RATE_LIMIT_MAX) {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many confirmation attempts on this link, slow down',
      },
    })
    return
  } else {
    await linkConfirmAttempts.set(
      linkId,
      { count: entry.count + 1, firstAt: entry.firstAt },
      PAY_CONFIRM_RATE_LIMIT_WINDOW_SECONDS,
    )
  }

  // On-chain verification with primary→fallback RPC. Throws only on RPC
  // errors (not verifier verdicts) — caught and surfaced as a structured
  // 503 so clients can retry. Critically, we do NOT mark the link paid in
  // this branch: an RPC outage must not auto-confirm payments.
  let verification: { valid: boolean; error?: string }
  try {
    verification = await verifyTransaction(
      txSignature,
      link.stealth_address,
      link.amount,
    )
  } catch {
    res.status(503).json({
      error: {
        code: 'RPC_UNAVAILABLE',
        message: 'On-chain verification temporarily unavailable, please retry shortly',
      },
    })
    return
  }

  if (!verification.valid) {
    res.status(400).json({ error: verification.error ?? 'transaction verification failed' })
    return
  }

  markPaymentLinkPaid(req.params.id, txSignature)
  res.json({ success: true, message: 'Payment confirmed' })
})

/** Test helper — clears the per-link rate-limit counter store. */
export async function _resetPayRateLimitForTests(): Promise<void> {
  await linkConfirmAttempts._clear()
}
