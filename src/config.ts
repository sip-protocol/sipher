import { cleanEnv, str, port, num } from 'envalid'

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ['development', 'production', 'test'] as const,
    default: 'development',
  }),
  PORT: port({ default: 5006 }),
  SOLANA_RPC_URL: str({ default: 'https://api.mainnet-beta.solana.com' }),
  RPC_PROVIDER: str({
    choices: ['generic', 'helius', 'quicknode', 'triton'] as const,
    default: 'generic',
  }),
  RPC_PROVIDER_API_KEY: str({ default: '' }),
  API_KEYS: str({ default: '' }),
  CORS_ORIGINS: str({ default: '' }),
  RATE_LIMIT_MAX: num({ default: 100 }),
  RATE_LIMIT_WINDOW_MS: num({ default: 60000 }),
  TRUST_PROXY: str({ default: '1' }),
  LOG_LEVEL: str({
    choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const,
    default: 'info',
  }),
  SHUTDOWN_TIMEOUT_MS: num({ default: 30000 }),
})

export function logConfigWarnings(logger: { warn: (msg: string) => void }): void {
  if (env.isProduction) {
    if (!env.API_KEYS) {
      logger.warn('API_KEYS not set in production — authentication disabled')
    }
    if (!env.CORS_ORIGINS) {
      logger.warn('CORS_ORIGINS not set in production — only localhost allowed')
    }
  }
}
