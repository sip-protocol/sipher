import { createHash } from 'node:crypto'

// ─── Threshold & Confirmation ───────────────────────────────────────────────

// Below threshold → auto-refund. At or above → require confirmation.
export function shouldAutoRefund(amount: number, threshold: number): boolean {
  return amount < threshold
}

// ─── Double-Processing Prevention ──────────────────────────────────────────

/**
 * Check if a refund is safe by verifying no recent transactions reference this deposit.
 * Compares deposit PDA against a set of known in-flight deposit PDAs (not raw signatures).
 */
export function isRefundSafe(
  depositPda: string,
  inFlightDeposits: string[]
): boolean {
  return !inFlightDeposits.includes(depositPda)
}

// ─── Idempotency ───────────────────────────────────────────────────────────

// Deterministic idempotency key: hash of deposit PDA + timestamp.
export function generateIdempotencyKey(
  depositPda: string,
  timestamp: number
): string {
  return createHash('sha256')
    .update(`refund:${depositPda}:${timestamp}`)
    .digest('hex')
    .slice(0, 16)
}
