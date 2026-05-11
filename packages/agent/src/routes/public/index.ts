import { Router } from 'express'
import { demoRouter } from './demo.js'
import { activitySummaryRouter } from './activity-summary.js'

/**
 * Public, unauthenticated routes mounted at /api/public.
 * Wave 2b subagents (F3) extend this router by appending sub-routers.
 * F1 (/demo) and F2 (/activity-summary) already wired below.
 *
 * All sub-routers MUST apply ipRateLimitMiddleware with their own key/cap.
 */
export const publicRouter = Router()

// #216 — demo mode (vault / activity / privacy-score snapshots for /demo)
publicRouter.use('/demo', demoRouter)
// #217 — unauthed activity teaser (counter + 5 recent rows)
publicRouter.use('/activity-summary', activitySummaryRouter)
