import { Request, Response, NextFunction } from 'express'
import { logger } from '../logger.js'
import { env } from '../config.js'
import { ErrorCode } from '../errors/codes.js'

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error({
    path: req.path,
    method: req.method,
    error: err.message,
    stack: env.isDevelopment ? err.stack : undefined,
  }, 'API Error')

  // Handle JSON parse errors
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: {
        code: ErrorCode.INVALID_JSON,
        message: 'Request body is not valid JSON',
      },
    })
    return
  }

  // Handle SIP SDK ValidationError
  if (err.name === 'ValidationError' || (err as any).code?.startsWith?.('VALIDATION')) {
    res.status(400).json({
      success: false,
      error: {
        code: (err as any).code || ErrorCode.VALIDATION_ERROR,
        message: err.message,
        details: (err as any).field ? { field: (err as any).field } : undefined,
      },
    })
    return
  }

  res.status(500).json({
    success: false,
    error: {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      details: env.isDevelopment ? err.message : undefined,
    },
  })
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: {
      code: ErrorCode.NOT_FOUND,
      message: `Route ${req.method} ${req.path} not found`,
    },
  })
}
