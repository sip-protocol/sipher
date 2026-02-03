import rateLimit from 'express-rate-limit'
import type { Request, Response } from 'express'
import { env } from '../config.js'

export const rateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        details: {
          retryAfter: Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000),
          limit: env.RATE_LIMIT_MAX,
        },
      },
    })
  },
  skip: (req: Request) => req.path === '/v1/health' || req.path === '/' || req.path === '/skill.md',
})
