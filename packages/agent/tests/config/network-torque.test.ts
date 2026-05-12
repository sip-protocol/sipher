import { describe, it, expect, beforeEach } from 'vitest'
import { loadTorqueConfig } from '../../src/config/network.js'

describe('loadTorqueConfig', () => {
  beforeEach(() => {
    delete process.env.TORQUE_GROWTH_ENABLED
    delete process.env.TORQUE_API_KEY
    delete process.env.TORQUE_MCP_URL
    delete process.env.TORQUE_CAMPAIGN_ID_DEVNET
    delete process.env.TORQUE_CAMPAIGN_ID_MAINNET
  })

  it('returns null when TORQUE_GROWTH_ENABLED is not "true"', () => {
    expect(loadTorqueConfig()).toBeNull()
  })

  it('returns null when TORQUE_API_KEY is missing despite enabled=true', () => {
    process.env.TORQUE_GROWTH_ENABLED = 'true'
    process.env.TORQUE_MCP_URL = 'https://torque.test'
    expect(loadTorqueConfig()).toBeNull()
  })

  it('returns config when all required vars present', () => {
    process.env.TORQUE_GROWTH_ENABLED = 'true'
    process.env.TORQUE_API_KEY = 'tk_secret'
    process.env.TORQUE_MCP_URL = 'https://torque.test'
    process.env.TORQUE_CAMPAIGN_ID_DEVNET = 'camp_d'
    process.env.TORQUE_CAMPAIGN_ID_MAINNET = 'camp_m'

    expect(loadTorqueConfig()).toStrictEqual({
      enabled: true,
      apiKey: 'tk_secret',
      baseUrl: 'https://torque.test',
      campaignIdDevnet: 'camp_d',
      campaignIdMainnet: 'camp_m',
    })
  })
})
