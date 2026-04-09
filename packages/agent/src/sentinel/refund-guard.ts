import { createHash } from 'node:crypto'

// ─── Threshold & Confirmation ───────────────────────────────────────────────

// Below threshold → auto-refund. At or above → require confirmation.
export function shouldAutoRefund(amount: number, threshold: number): boolean {
  return amount < threshold
}

// ─── Double-Processing Prevention ──────────────────────────────────────────

// Check if refund is safe — looks for deposit PDA in recent signatures.
// If found → in-flight TX, skip refund.
export function isRefundSafe(
  depositPda: string,
  recentSignatures: string[]
): boolean {
  return !recentSignatures.some(sig => sig.includes(depositPda))
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
