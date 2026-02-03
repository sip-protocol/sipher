import pino from 'pino'
import pinoHttp from 'pino-http'
import crypto from 'crypto'
import { env } from './config.js'

const loggerConfig: pino.LoggerOptions = {
  level: env.LOG_LEVEL,
  base: { service: 'sipher', version: '0.1.0' },
  timestamp: pino.stdTimeFunctions.isoTime,
}

if (env.isDevelopment) {
  loggerConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname,service,version',
    },
  }
}

export const logger = pino(loggerConfig)

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req) => {
    const augmented = req as typeof req & { requestId?: string }
    if (augmented.requestId) return augmented.requestId
    const existing = req.headers['x-request-id']
    if (existing && typeof existing === 'string') return existing
    return crypto.randomUUID()
  },
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} ${res.statusCode} - ${err.message}`,
  autoLogging: {
    ignore: (req) => req.url === '/v1/health' && env.isProduction,
  },
})
