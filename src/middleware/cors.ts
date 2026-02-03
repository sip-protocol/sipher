import cors, { CorsOptions } from 'cors'
import { Request, RequestHandler } from 'express'
import { env } from '../config.js'

const CORS_ORIGINS = env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5006',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5006',
]

function getAllowedOrigins(): string[] {
  if (CORS_ORIGINS.length > 0) return CORS_ORIGINS
  if (env.isDevelopment || env.isTest) return DEV_ORIGINS
  return []
}

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true
  const allowed = getAllowedOrigins()
  if (allowed.includes(origin)) return true

  let originUrl: URL
  try { originUrl = new URL(origin) } catch { return false }

  for (const a of allowed) {
    if (a.startsWith('*.')) {
      const base = a.slice(2)
      if (env.isProduction && originUrl.protocol !== 'https:') continue
      if (originUrl.host === base || originUrl.host.endsWith('.' + base)) return true
    }
  }
  return false
}

const corsDelegate = (req: Request, callback: (err: Error | null, opts?: CorsOptions) => void) => {
  const origin = req.headers.origin
  const allowed = isOriginAllowed(origin)

  callback(null, {
    origin: allowed ? origin : false,
    credentials: true,
    maxAge: 86400,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'X-Request-ID'],
  })
}

export const secureCors: RequestHandler = cors(corsDelegate) as RequestHandler

export function getCorsConfig() {
  return {
    origins: getAllowedOrigins(),
    credentials: true,
    environment: env.NODE_ENV,
  }
}
