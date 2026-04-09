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
})
