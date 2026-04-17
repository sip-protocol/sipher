import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const { getSentinelConfig } = await import('../../src/sentinel/config.js')

describe('getSentinelConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns defaults when no env vars set', () => {
    delete process.env.SENTINEL_SCAN_INTERVAL
    delete process.env.SENTINEL_ACTIVE_SCAN_INTERVAL
    delete process.env.SENTINEL_AUTO_REFUND_THRESHOLD
    delete process.env.SENTINEL_THREAT_CHECK
    delete process.env.SENTINEL_LARGE_TRANSFER_THRESHOLD

    const config = getSentinelConfig()
    expect(config.scanInterval).toBe(60000)
    expect(config.activeScanInterval).toBe(15000)
    expect(config.autoRefundThreshold).toBe(1)
    expect(config.threatCheckEnabled).toBe(true)
    expect(config.largeTransferThreshold).toBe(10)
    expect(config.maxRpcPerWallet).toBe(5)
    expect(config.maxWalletsPerCycle).toBe(20)
    expect(config.backoffMax).toBe(600_000)
  })

  it('respects env var overrides', () => {
    process.env.SENTINEL_SCAN_INTERVAL = '30000'
    process.env.SENTINEL_AUTO_REFUND_THRESHOLD = '5'

    const config = getSentinelConfig()
    expect(config.scanInterval).toBe(30000)
    expect(config.autoRefundThreshold).toBe(5)
    expect(config.activeScanInterval).toBe(15000) // not overridden
  })

  it('handles threatCheckEnabled false when env var set to false', () => {
    process.env.SENTINEL_THREAT_CHECK = 'false'

    const config = getSentinelConfig()
    expect(config.threatCheckEnabled).toBe(false)
  })

  it('keeps threatCheckEnabled true for any non-false value', () => {
    process.env.SENTINEL_THREAT_CHECK = 'true'
    let config = getSentinelConfig()
    expect(config.threatCheckEnabled).toBe(true)

    process.env.SENTINEL_THREAT_CHECK = 'yes'
    config = getSentinelConfig()
    expect(config.threatCheckEnabled).toBe(true)
  })

  it('returns default mode=yolo when SENTINEL_MODE unset', () => {
    delete process.env.SENTINEL_MODE
    expect(getSentinelConfig().mode).toBe('yolo')
  })

  it('accepts mode=advisory and mode=off', () => {
    process.env.SENTINEL_MODE = 'advisory'
    expect(getSentinelConfig().mode).toBe('advisory')
    process.env.SENTINEL_MODE = 'off'
    expect(getSentinelConfig().mode).toBe('off')
  })

  it('falls back to yolo on unknown mode value', () => {
    process.env.SENTINEL_MODE = 'chaos'
    expect(getSentinelConfig().mode).toBe('yolo')
  })

  it('returns default preflight knobs', () => {
    delete process.env.SENTINEL_PREFLIGHT_SCOPE
    delete process.env.SENTINEL_PREFLIGHT_SKIP_AMOUNT
    const c = getSentinelConfig()
    expect(c.preflightScope).toBe('fund-actions')
    expect(c.preflightSkipAmount).toBe(0.1)
  })

  it('returns default autonomy knobs', () => {
    delete process.env.SENTINEL_BLACKLIST_AUTONOMY
    delete process.env.SENTINEL_CANCEL_WINDOW_MS
    const c = getSentinelConfig()
    expect(c.blacklistAutonomy).toBe(true)
    expect(c.cancelWindowMs).toBe(30000)
  })

  it('returns default rate limits', () => {
    delete process.env.SENTINEL_RATE_LIMIT_FUND_PER_HOUR
    delete process.env.SENTINEL_RATE_LIMIT_BLACKLIST_PER_HOUR
    const c = getSentinelConfig()
    expect(c.rateLimitFundPerHour).toBe(5)
    expect(c.rateLimitBlacklistPerHour).toBe(20)
  })

  it('returns default model + budget + block-on-error', () => {
    delete process.env.SENTINEL_MODEL
    delete process.env.SENTINEL_DAILY_BUDGET_USD
    delete process.env.SENTINEL_BLOCK_ON_ERROR
    const c = getSentinelConfig()
    expect(c.model).toBe('openrouter:anthropic/claude-sonnet-4.6')
    expect(c.dailyBudgetUsd).toBe(10)
    expect(c.blockOnError).toBe(false)
  })

  it('blockOnError flips true when SENTINEL_BLOCK_ON_ERROR=true', () => {
    process.env.SENTINEL_BLOCK_ON_ERROR = 'true'
    expect(getSentinelConfig().blockOnError).toBe(true)
  })

  it('blacklistAutonomy flips false when SENTINEL_BLACKLIST_AUTONOMY=false', () => {
    process.env.SENTINEL_BLACKLIST_AUTONOMY = 'false'
    expect(getSentinelConfig().blacklistAutonomy).toBe(false)
  })
})
