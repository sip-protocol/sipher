export type SentinelMode = 'yolo' | 'advisory' | 'off'
export type PreflightScope = 'fund-actions' | 'critical-only' | 'never'

export interface SentinelConfig {
  // existing
  scanInterval: number
  activeScanInterval: number
  autoRefundThreshold: number
  threatCheckEnabled: boolean
  largeTransferThreshold: number
  maxRpcPerWallet: number
  maxWalletsPerCycle: number
  backoffMax: number
  // new — mode + preflight
  mode: SentinelMode
  preflightScope: PreflightScope
  preflightSkipAmount: number
  // new — autonomy thresholds
  blacklistAutonomy: boolean
  cancelWindowMs: number
  // new — rate limits
  rateLimitFundPerHour: number
  rateLimitBlacklistPerHour: number
  // new — cost + quality
  model: string
  dailyBudgetUsd: number
  blockOnError: boolean
}

function parseMode(raw: string | undefined): SentinelMode {
  if (raw === 'advisory' || raw === 'off') return raw
  return 'yolo'
}

function parseScope(raw: string | undefined): PreflightScope {
  if (raw === 'critical-only' || raw === 'never') return raw
  return 'fund-actions'
}

export function getSentinelConfig(): SentinelConfig {
  return {
    scanInterval: Number(process.env.SENTINEL_SCAN_INTERVAL ?? '60000'),
    activeScanInterval: Number(process.env.SENTINEL_ACTIVE_SCAN_INTERVAL ?? '15000'),
    autoRefundThreshold: Number(process.env.SENTINEL_AUTO_REFUND_THRESHOLD ?? '1'),
    threatCheckEnabled: process.env.SENTINEL_THREAT_CHECK !== 'false',
    largeTransferThreshold: Number(process.env.SENTINEL_LARGE_TRANSFER_THRESHOLD ?? '10'),
    maxRpcPerWallet: 5,
    maxWalletsPerCycle: 20,
    backoffMax: 600_000,
    mode: parseMode(process.env.SENTINEL_MODE),
    preflightScope: parseScope(process.env.SENTINEL_PREFLIGHT_SCOPE),
    preflightSkipAmount: Number(process.env.SENTINEL_PREFLIGHT_SKIP_AMOUNT ?? '0.1'),
    blacklistAutonomy: process.env.SENTINEL_BLACKLIST_AUTONOMY !== 'false',
    cancelWindowMs: Number(process.env.SENTINEL_CANCEL_WINDOW_MS ?? '30000'),
    rateLimitFundPerHour: Number(process.env.SENTINEL_RATE_LIMIT_FUND_PER_HOUR ?? '5'),
    rateLimitBlacklistPerHour: Number(process.env.SENTINEL_RATE_LIMIT_BLACKLIST_PER_HOUR ?? '20'),
    model: process.env.SENTINEL_MODEL ?? 'openrouter:anthropic/claude-sonnet-4.6',
    dailyBudgetUsd: Number(process.env.SENTINEL_DAILY_BUDGET_USD ?? '10'),
    blockOnError: process.env.SENTINEL_BLOCK_ON_ERROR === 'true',
  }
}
