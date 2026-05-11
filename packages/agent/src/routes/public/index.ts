import { Router } from 'express'
import { demoRouter } from './demo.js'
import { activitySummaryRouter } from './activity-summary.js'
import { chatRouter } from './chat.js'

/**
 * Public, unauthenticated routes mounted at /api/public.
 * All sub-routers MUST apply ipRateLimitMiddleware with their own key/cap.
 */
export const publicRouter = Router()

// #216 — demo mode (vault / activity / privacy-score snapshots for /demo)
publicRouter.use('/demo', demoRouter)
// #217 — unauthed activity teaser (counter + 5 recent rows)
publicRouter.use('/activity-summary', activitySummaryRouter)
// #218 — unauthed Ask SIPHER chat (POST /api/public/chat/stream, 5 msgs/IP/24h)
publicRouter.use('/chat', chatRouter)
