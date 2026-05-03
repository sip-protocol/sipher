export type SentinelMode = 'yolo' | 'advisory' | 'off'
export type PreflightScope = 'fund-actions' | 'critical-only' | 'never'

// Reference: docs/sentinel/config.md

export interface SentinelConfig {
  /**
   * Idle scanner cycle period in milliseconds.
   * Env: `SENTINEL_SCAN_INTERVAL` | Default: `60000`
   * @see docs/sentinel/config.md#scanner
   */
  scanInterval: number
  /**
   * Active-mode scanner cycle period in milliseconds (used when a threat is being tracked).
   * Env: `SENTINEL_ACTIVE_SCAN_INTERVAL` | Default: `15000`
   * @see docs/sentinel/config.md#scanner
   */
  activeScanInterval: number
  /**
   * Number of pending refunds that triggers SENTINEL's auto-refund sweep.
   * Env: `SENTINEL_AUTO_REFUND_THRESHOLD` | Default: `1`
   * @see docs/sentinel/config.md#scanner
   */
  autoRefundThreshold: number
  /**
   * Whether to run Helius threat-check lookups during scanner cycles.
   * Env: `SENTINEL_THREAT_CHECK` | Default: `true`
   * @see docs/sentinel/config.md#threat-detection
   */
  threatCheckEnabled: boolean
  /**
   * SOL amount (inclusive) above which a transfer is flagged as large and routed through SENTINEL review.
   * Env: `SENTINEL_LARGE_TRANSFER_THRESHOLD` | Default: `10`
   * @see docs/sentinel/config.md#threat-detection
   */
  largeTransferThreshold: number
  /**
   * Max RPC calls SENTINEL makes per wallet per scanner cycle.
   * Hardcoded; not env-tunable.
   */
  maxRpcPerWallet: number
  /**
   * Max wallets SENTINEL inspects in a single scanner cycle.
   * Hardcoded; not env-tunable.
   */
  maxWalletsPerCycle: number
  /**
   * Maximum back-off delay in milliseconds between scanner retries after an error.
   * Hardcoded; not env-tunable.
   */
  backoffMax: number
  /**
   * SENTINEL operating mode: `yolo` (auto-act), `advisory` (log only), or `off` (disabled).
   * Env: `SENTINEL_MODE` | Default: `'yolo'`
   * @see docs/sentinel/config.md#mode
   */
  mode: SentinelMode
  /**
   * Which tool calls require a SENTINEL preflight risk assessment before execution.
   * Env: `SENTINEL_PREFLIGHT_SCOPE` | Default: `'fund-actions'`
   * @see docs/sentinel/config.md#mode
   */
  preflightScope: PreflightScope
  /**
   * SOL amount (exclusive) below which preflight is skipped even when `preflightScope` would apply.
   * Env: `SENTINEL_PREFLIGHT_SKIP_AMOUNT` | Default: `0.1`
   * @see docs/sentinel/config.md#mode
   */
  preflightSkipAmount: number
  /**
   * Whether SENTINEL may autonomously blacklist wallets without waiting for operator confirmation.
   * Env: `SENTINEL_BLACKLIST_AUTONOMY` | Default: `true`
   * @see docs/sentinel/config.md#autonomy
   */
  blacklistAutonomy: boolean
  /**
   * Grace period in milliseconds during which an autonomous action can be cancelled.
   * Env: `SENTINEL_CANCEL_WINDOW_MS` | Default: `30000`
   * @see docs/sentinel/config.md#autonomy
   */
  cancelWindowMs: number
  /**
   * Maximum fund-moving actions SENTINEL may execute per hour before rate-limiting kicks in.
   * Env: `SENTINEL_RATE_LIMIT_FUND_PER_HOUR` | Default: `5`
   * @see docs/sentinel/config.md#rate-limits
   */
  rateLimitFundPerHour: number
  /**
   * Maximum blacklist additions SENTINEL may perform per hour before rate-limiting kicks in.
   * Env: `SENTINEL_RATE_LIMIT_BLACKLIST_PER_HOUR` | Default: `20`
   * @see docs/sentinel/config.md#rate-limits
   */
  rateLimitBlacklistPerHour: number
  /**
   * LLM model identifier used by SentinelCore for risk assessments (OpenRouter `provider:model` format).
   * Env: `SENTINEL_MODEL` | Default: `'openrouter:anthropic/claude-sonnet-4.6'`
   * @see docs/sentinel/config.md#llm
   */
  model: string
  /**
   * Maximum daily LLM spend in USD before SENTINEL pauses new assessments.
   * Env: `SENTINEL_DAILY_BUDGET_USD` | Default: `10`
   * @see docs/sentinel/config.md#llm
   */
  dailyBudgetUsd: number
  /**
   * When `true`, a failed LLM call blocks the fund-moving tool rather than failing open.
   * Env: `SENTINEL_BLOCK_ON_ERROR` | Default: `false`
   * @see docs/sentinel/config.md#llm
   */
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

/**
 * Read SENTINEL configuration from environment variables.
 * Called once at agent startup; result is reconstructed each call (no caching here — callers cache).
 * @returns SentinelConfig with all 18 fields populated from env or defaults.
 * @see docs/sentinel/config.md
 */
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
