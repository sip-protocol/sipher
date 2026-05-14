import { describe, it, expect, beforeAll } from 'vitest'
import { TorqueMCPClient } from '../../../src/integrations/torque/mcp-client.js'
import type { SipherGrowthEvent } from '../../../src/integrations/torque/types.js'

const apiToken = process.env.TORQUE_API_TOKEN
const ingesterUrl = process.env.TORQUE_INGESTER_URL

const skip = !apiToken || !ingesterUrl

describe.skipIf(skip)('integration: torque devnet emit roundtrip', () => {
  let client: TorqueMCPClient

  beforeAll(() => {
    client = new TorqueMCPClient({
      apiToken: apiToken!,
      ingesterUrl: ingesterUrl!,
    })
  })

  it('emits a custom_event and receives ok', async () => {
    const event: SipherGrowthEvent = {
      userPubkey: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
      timestamp: Date.now(),
      eventName: 'sipher_private_send_completed',
      data: {
        tx_signature: `test_${Date.now()}`,
        network: 'devnet',
        rebate_destination: '11111111111111111111111111111111',
      },
    }

    const result = await client.emitEvent(event)

    expect(result.ok).toBe(true)
  }, 15_000)
})
