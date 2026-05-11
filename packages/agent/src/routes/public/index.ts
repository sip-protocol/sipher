import { Router } from 'express'
import { demoRouter } from './demo.js'

/**
 * Public, unauthenticated routes mounted at /api/public.
 * Feature subagents (Wave 2b F1/F2/F3) extend this router by appending:
 *   import { demoRouter } from './demo.js'
 *   publicRouter.use('/demo', demoRouter)
 *
 * All sub-routers MUST apply ipRateLimitMiddleware with their own key/cap.
 */
export const publicRouter = Router()

// #216 — demo mode (vault / activity / privacy-score snapshots for /demo)
publicRouter.use('/demo', demoRouter)
