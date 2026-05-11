/**
 * Shared types for public, unauthenticated /api/public/* responses.
 * Feature subagents extend this file with their feature-specific helpers.
 */

export interface DemoVault {
  wallet: string
  balances: { sol: number; tokens: unknown[]; status: string }
}

export interface DemoActivityRow {
  id: string
  agent: string
  type: string
  level: string
  title: string
  detail?: string | null
  created_at: string
}

export interface DemoPrivacyScore {
  score: number
  grade: string
  factors: {
    addressReuse: { score: number; detail: string }
    amountPatterns: { score: number; detail: string }
    timingCorrelation: { score: number; detail: string }
    counterpartyExposure: { score: number; detail: string }
  }
  recommendations: string[]
  transactionsAnalyzed: number
}

export type AmountBand = '<1' | '1-10' | '10-100' | '100-1000' | '>1000'

export interface AnonActivityRow {
  type: string
  chain: string
  amountBand: AmountBand
  relativeTime: string
}

export interface ActivitySummaryResponse {
  counter: number
  recent: AnonActivityRow[]
}

/**
 * Bucket a raw chain-equivalent amount (SOL, ETH, etc.) into one of five
 * coarse bands. Used by `/api/public/activity-summary` so we never leak the
 * exact transfer size of any individual user's transaction.
 */
export function toAmountBand(amount: number): AmountBand {
  if (!Number.isFinite(amount) || amount < 1) return '<1'
  if (amount < 10) return '1-10'
  if (amount < 100) return '10-100'
  if (amount < 1000) return '100-1000'
  return '>1000'
}

/**
 * Format an ISO timestamp as a coarse relative-time string ("3 minutes ago").
 * Granularity intentionally low — same anonymization guard as `toAmountBand`.
 */
export function relativeTime(createdAt: string): string {
  const ts = new Date(createdAt).getTime()
  if (!Number.isFinite(ts)) return 'just now'
  const diffMs = Math.max(0, Date.now() - ts)
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/**
 * Defensively parse the `detail` column from `activity_stream` rows. Stored as
 * JSON-serialized text — match the pattern from `app/src/views/DashboardView.tsx`.
 */
export function parseActivityDetail(detail: unknown): Record<string, unknown> {
  if (detail == null) return {}
  if (typeof detail === 'string') {
    try {
      const parsed = JSON.parse(detail) as unknown
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  if (typeof detail === 'object') return detail as Record<string, unknown>
  return {}
}
