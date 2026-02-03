import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import type { ZodType } from 'zod'

export function validateRequest(schema: {
  body?: ZodType
  query?: ZodType
  params?: ZodType
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body)
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query) as typeof req.query
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params) as typeof req.params
      }
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        })
        return
      }
      next(error)
    }
  }
}
