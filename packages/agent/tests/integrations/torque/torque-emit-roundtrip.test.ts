import { describe, it, expect, beforeAll } from 'vitest'
import { TorqueMCPClient } from '../../../src/integrations/torque/mcp-client.js'
import type { SipherGrowthEvent } from '../../../src/integrations/torque/types.js'

const apiKey = process.env.TORQUE_API_KEY
const baseUrl = process.env.TORQUE_MCP_URL
const campaignId = process.env.TORQUE_TEST_CAMPAIGN_ID

const skip = !apiKey || !baseUrl || !campaignId

describe.skipIf(skip)('integration: torque devnet emit roundtrip', () => {
  let client: TorqueMCPClient

  beforeAll(() => {
    client = new TorqueMCPClient({
      apiKey: apiKey!,
      baseUrl: baseUrl!,
      campaignId: campaignId!,
    })
  })

  it('emits a custom_event and receives an eventId', async () => {
    const event: SipherGrowthEvent = {
      event: 'sipher.private_send_completed',
      wallet: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
      ts: new Date().toISOString(),
      tx_signature: `test_${Date.now()}`,
      network: 'devnet',
      metadata: {
        rebate_destination: '11111111111111111111111111111111',
      },
    }

    const result = await client.emitEvent(event)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.eventId).toMatch(/^evt_/)
    }
  }, 15_000)
})
