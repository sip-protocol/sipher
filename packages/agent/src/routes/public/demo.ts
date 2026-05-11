import { Router, type Request, type Response } from 'express'
import { ipRateLimitMiddleware } from '../../lib/ip-rate-limit.js'
import { getCached, setCached } from '../../lib/cache.js'
import {
  getDemoVault,
  getDemoActivity,
  getDemoPrivacyScore,
  type DemoVaultResponse,
  type DemoPrivacyScoreResponse,
} from '../../services/demo-wallet.js'

/**
 * Demo routes — public, rate-limited, 60s in-memory cache.
 *
 * Three GETs serve the marketing /demo page:
 *   GET /api/public/demo/vault          → balances + activity snapshot
 *   GET /api/public/demo/activity       → DB activity stream
 *   GET /api/public/demo/privacy-score  → 4-factor privacy analysis
 *
 * Env gate: `DEMO_WALLET` MUST be set. If unset, every route returns
 * 503 + { error: { code: 'UNAVAILABLE', message: 'Demo mode disabled' } }.
 * This lets operators disable the marketing surface without redeploying
 * the agent (e.g., during a sensitive migration window).
 */
export const demoRouter = Router()

const CACHE_TTL_SECONDS = 60

// 60 req/IP/min — generous; cache absorbs the bulk of traffic.
demoRouter.use(ipRateLimitMiddleware('demo', 60, 60_000))

function demoUnavailable(res: Response): void {
  res.status(503).json({
    error: { code: 'UNAVAILABLE', message: 'Demo mode disabled' },
  })
}

function getDemoWalletOrNull(): string | null {
  const w = process.env.DEMO_WALLET
  return w && w.trim().length > 0 ? w : null
}

demoRouter.get('/vault', async (_req: Request, res: Response) => {
  const wallet = getDemoWalletOrNull()
  if (!wallet) {
    demoUnavailable(res)
    return
  }
  const cacheKey = 'public-demo-vault'
  const cached = await getCached<DemoVaultResponse>(cacheKey)
  if (cached) {
    res.json(cached)
    return
  }
  try {
    const vault = await getDemoVault(wallet)
    await setCached(cacheKey, vault, CACHE_TTL_SECONDS)
    res.json(vault)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed to load demo vault'
    console.error('[demo] vault error:', message)
    res.status(500).json({ error: { code: 'INTERNAL', message } })
  }
})

demoRouter.get('/activity', async (_req: Request, res: Response) => {
  const wallet = getDemoWalletOrNull()
  if (!wallet) {
    demoUnavailable(res)
    return
  }
  const cacheKey = 'public-demo-activity'
  const cached = await getCached<{ activity: Array<Record<string, unknown>> }>(cacheKey)
  if (cached) {
    res.json(cached)
    return
  }
  try {
    const activity = getDemoActivity(wallet)
    const payload = { activity }
    await setCached(cacheKey, payload, CACHE_TTL_SECONDS)
    res.json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed to load demo activity'
    console.error('[demo] activity error:', message)
    res.status(500).json({ error: { code: 'INTERNAL', message } })
  }
})

demoRouter.get('/privacy-score', async (_req: Request, res: Response) => {
  const wallet = getDemoWalletOrNull()
  if (!wallet) {
    demoUnavailable(res)
    return
  }
  const cacheKey = 'public-demo-privacy-score'
  const cached = await getCached<DemoPrivacyScoreResponse>(cacheKey)
  if (cached) {
    res.json(cached)
    return
  }
  try {
    const score = await getDemoPrivacyScore(wallet)
    await setCached(cacheKey, score, CACHE_TTL_SECONDS)
    res.json(score)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed to load demo privacy score'
    console.error('[demo] privacy-score error:', message)
    res.status(500).json({ error: { code: 'INTERNAL', message } })
  }
})
