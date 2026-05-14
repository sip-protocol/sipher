import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { loadTorqueConfig } from '../../src/config/network.js'

describe('loadTorqueConfig', () => {
  beforeEach(() => {
    delete process.env.TORQUE_GROWTH_ENABLED
    delete process.env.TORQUE_API_TOKEN
    delete process.env.TORQUE_INGESTER_URL
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null when TORQUE_GROWTH_ENABLED is unset', () => {
    expect(loadTorqueConfig()).toBeNull()
  })

  it.each([['false'], ['1'], ['yes'], ['TRUE']])(
    'returns null when TORQUE_GROWTH_ENABLED is %s (non-"true" value)',
    (value) => {
      process.env.TORQUE_GROWTH_ENABLED = value
      expect(loadTorqueConfig()).toBeNull()
    },
  )

  it('returns null and warns when TORQUE_API_TOKEN is missing despite enabled=true', () => {
    process.env.TORQUE_GROWTH_ENABLED = 'true'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(loadTorqueConfig()).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('TORQUE_API_TOKEN'))
  })

  it('returns config when TORQUE_API_TOKEN and TORQUE_INGESTER_URL are both set', () => {
    process.env.TORQUE_GROWTH_ENABLED = 'true'
    process.env.TORQUE_API_TOKEN = 'tq_secret'
    process.env.TORQUE_INGESTER_URL = 'https://ingest.torque.test'

    expect(loadTorqueConfig()).toStrictEqual({
      apiToken: 'tq_secret',
      ingesterUrl: 'https://ingest.torque.test',
    })
  })

  it('defaults ingesterUrl to https://ingest.torque.so when TORQUE_INGESTER_URL is unset', () => {
    process.env.TORQUE_GROWTH_ENABLED = 'true'
    process.env.TORQUE_API_TOKEN = 'tq_secret'

    expect(loadTorqueConfig()).toStrictEqual({
      apiToken: 'tq_secret',
      ingesterUrl: 'https://ingest.torque.so',
    })
  })

  it('uses TORQUE_INGESTER_URL override when set', () => {
    process.env.TORQUE_GROWTH_ENABLED = 'true'
    process.env.TORQUE_API_TOKEN = 'tq_secret'
    process.env.TORQUE_INGESTER_URL = 'https://staging.ingest.torque.so'

    const config = loadTorqueConfig()
    expect(config?.ingesterUrl).toBe('https://staging.ingest.torque.so')
  })
})
