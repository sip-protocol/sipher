import { Request, Response, NextFunction, RequestHandler } from 'express'
import crypto from 'crypto'

export interface RequestWithId extends Request {
  requestId: string
}

export const requestIdMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const clientId = req.headers['x-request-id']
  const requestId = (typeof clientId === 'string' && clientId.length > 0)
    ? clientId
    : crypto.randomUUID()

  ;(req as RequestWithId).requestId = requestId
  res.setHeader('X-Request-ID', requestId)
  next()
}
