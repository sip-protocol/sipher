import { Router, Request, Response } from 'express'
import { ERROR_CATALOG } from '../errors/codes.js'

const router = Router()

router.get('/errors', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      totalCodes: ERROR_CATALOG.length,
      errors: ERROR_CATALOG.map(e => ({
        code: e.code,
        httpStatus: e.httpStatus,
        description: e.description,
        retryable: e.retryable,
      })),
    },
  })
})

export default router
