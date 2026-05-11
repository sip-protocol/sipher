import { Router } from 'express'

/**
 * Public, unauthenticated routes mounted at /api/public.
 * Feature subagents (Wave 2b F1/F2/F3) extend this router by appending:
 *   import { demoRouter } from './demo.js'
 *   publicRouter.use('/demo', demoRouter)
 *
 * All sub-routers MUST apply ipRateLimitMiddleware with their own key/cap.
 */
export const publicRouter = Router()
