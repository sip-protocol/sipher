import { Router, type Request, type Response } from 'express'
import { getDb, getActivity } from '../../db.js'
import { ipRateLimitMiddleware } from '../../lib/ip-rate-limit.js'
import { getCached, setCached } from '../../lib/cache.js'
import {
  parseActivityDetail,
  relativeTime,
  toAmountBand,
  type ActivitySummaryResponse,
  type AnonActivityRow,
} from '../../lib/queries/public.js'

export const activitySummaryRouter: Router = Router()

const CACHE_KEY = 'public-activity-summary'
const CACHE_TTL_SECONDS = 60
// Rate limit: 120 req/min/IP. Generous enough that an unauthed page mounting
// + 60s polling never trips it under normal browsing patterns.
const RATE_CAP = 120
const RATE_WINDOW_MS = 60_000

activitySummaryRouter.use(ipRateLimitMiddleware('activity-summary', RATE_CAP, RATE_WINDOW_MS))

/**
 * GET /api/public/activity-summary
 *
 * Returns an anonymized snapshot of ecosystem-wide shielded-transfer activity
 * — counter of all-time successful fund-mover events + the 5 most recent
 * rows, stripped of any wallet-identifiable fields.
 *
 * Cached for 60s server-side. NO sender, recipient, exact amount, transaction
 * hash, wallet address, agent identifier, or activity id is exposed.
 */
activitySummaryRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const cached = await getCached<ActivitySummaryResponse>(CACHE_KEY)
    if (cached) {
      res.json(cached)
      return
    }

    const counter = computeCounter()
    const recent = computeRecent()
    const payload: ActivitySummaryResponse = { counter, recent }

    await setCached(CACHE_KEY, payload, CACHE_TTL_SECONDS)
    res.json(payload)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'activity-summary failed'
    console.error('[activity-summary]', message)
    res.status(500).json({ error: { code: 'INTERNAL', message } })
  }
})

/**
 * SELECT COUNT(*) of completed fund-mover events across all wallets.
 * Matches the suffix pattern used by the agent's activity logger
 * (e.g., `send.success`, `swap.completed`) — see DashboardView's
 * `fundMoverPattern` for the canonical type-name conventions.
 */
function computeCounter(): number {
  const db = getDb()
  const row = db
    .prepare(
      'SELECT COUNT(*) AS n FROM activity_stream WHERE type LIKE ? OR type LIKE ?',
    )
    .get('%.success', '%.completed') as { n: number } | undefined
  return row?.n ?? 0
}

/**
 * Pull the 5 most recent successful fund-mover rows across all wallets,
 * defensively parse `detail`, and project to the anonymized output shape.
 * Only allow-listed keys (`type`, `chain`, `amountBand`, `relativeTime`)
 * make it into the response.
 */
function computeRecent(): AnonActivityRow[] {
  // getActivity(null) returns rows across all wallets — exactly the
  // ecosystem-wide teaser we want. Over-fetch by a small factor so the
  // post-filter still has 5 fund-mover rows in the (rare) case where most
  // recent rows are non-completion levels (e.g., `info`, `warning`).
  const rows = getActivity(null, { limit: 50 })

  const fundMoverPattern = /\.(success|completed)$/
  const out: AnonActivityRow[] = []

  for (const row of rows) {
    const type = typeof row.type === 'string' ? row.type : ''
    if (!fundMoverPattern.test(type)) continue

    const detail = parseActivityDetail(row.detail)
    const chain = typeof detail.chain === 'string' ? detail.chain : 'solana'
    const rawAmount = typeof detail.amount === 'number'
      ? detail.amount
      : typeof detail.amount === 'string'
        ? Number(detail.amount)
        : 0
    const createdAt = typeof row.created_at === 'string' ? row.created_at : new Date().toISOString()

    out.push({
      type,
      chain,
      amountBand: toAmountBand(rawAmount),
      relativeTime: relativeTime(createdAt),
    })

    if (out.length >= 5) break
  }

  return out
}
