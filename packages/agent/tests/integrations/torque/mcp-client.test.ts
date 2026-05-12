import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TorqueMCPClient } from '../../../src/integrations/torque/mcp-client.js'
import type { SipherGrowthEvent, TorqueCampaign } from '../../../src/integrations/torque/types.js'

const baseEvent: SipherGrowthEvent = {
  event: 'sipher.private_send_completed',
  wallet: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
  ts: '2026-05-12T12:00:00Z',
  tx_signature: '3QCoHcJ1NNg',
  network: 'devnet',
  metadata: {
    rebate_destination: '4HC3vQB5s5c',
  },
}

describe('TorqueMCPClient.emitEvent', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs the event with x-torque-api-key header and JSON body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'SUCCESS', data: { eventId: 'evt_1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const client = new TorqueMCPClient({
      baseUrl: 'https://torque.test',
      apiKey: 'tk_secret',
      campaignId: 'camp_devnet_1',
    })

    const result = await client.emitEvent(baseEvent)

    expect(result).toStrictEqual({ ok: true, eventId: 'evt_1' })
    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe('https://torque.test/campaigns/camp_devnet_1/events')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-torque-api-key': 'tk_secret',
    })
    expect(JSON.parse(init?.body as string)).toStrictEqual(baseEvent)
  })
})

describe('TorqueMCPClient.emitEvent error paths', () => {
  beforeEach(() => vi.restoreAllMocks())

  function clientWithMockedFetch(status: number, body: object | string = ''): TorqueMCPClient {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    return new TorqueMCPClient({
      baseUrl: 'https://torque.test',
      apiKey: 'tk_secret',
      campaignId: 'camp_devnet_1',
    })
  }

  it('returns auth reason on 401', async () => {
    const client = clientWithMockedFetch(401)
    const result = await client.emitEvent(baseEvent)
    expect(result).toStrictEqual({ ok: false, reason: 'auth', message: expect.stringMatching(/401/) })
  })

  it('returns auth reason on 403', async () => {
    const client = clientWithMockedFetch(403)
    const result = await client.emitEvent(baseEvent)
    expect(result).toStrictEqual({ ok: false, reason: 'auth', message: expect.stringMatching(/403/) })
  })

  it('returns duplicate reason on 409', async () => {
    const client = clientWithMockedFetch(409)
    const result = await client.emitEvent(baseEvent)
    expect(result).toStrictEqual({ ok: false, reason: 'duplicate', message: expect.stringMatching(/idempotency/i) })
  })

  it('returns rate_limit reason on 429', async () => {
    const client = clientWithMockedFetch(429)
    const result = await client.emitEvent(baseEvent)
    expect(result).toStrictEqual({ ok: false, reason: 'rate_limit', message: expect.stringMatching(/rate limit/i) })
  })

  it('returns campaign_inactive reason on 410', async () => {
    const client = clientWithMockedFetch(410)
    const result = await client.emitEvent(baseEvent)
    expect(result).toStrictEqual({ ok: false, reason: 'campaign_inactive', message: expect.stringMatching(/no longer active/i) })
  })

  it('returns unknown reason on other 5xx', async () => {
    const client = clientWithMockedFetch(503)
    const result = await client.emitEvent(baseEvent)
    expect(result).toStrictEqual({ ok: false, reason: 'unknown', message: expect.stringMatching(/503/) })
  })

  it('returns network reason on fetch throw', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))
    const client = new TorqueMCPClient({
      baseUrl: 'https://torque.test',
      apiKey: 'tk_secret',
      campaignId: 'camp_devnet_1',
    })
    const result = await client.emitEvent(baseEvent)
    expect(result).toStrictEqual({ ok: false, reason: 'network', message: 'ECONNREFUSED' })
  })

  it('returns unknown reason when response missing eventId', async () => {
    const client = clientWithMockedFetch(200, { status: 'SUCCESS', data: {} })
    const result = await client.emitEvent(baseEvent)
    expect(result).toStrictEqual({ ok: false, reason: 'unknown', message: expect.stringMatching(/missing eventId/) })
  })
})

describe('TorqueMCPClient.getCampaign', () => {
  beforeEach(() => vi.restoreAllMocks())

  const campaign: TorqueCampaign = {
    id: 'camp_devnet_1',
    name: 'Sipher Private Action Rebate',
    status: 'ACTIVE',
    remainingPool: 4.95,
    rewardAmountPerEvent: 0.005,
    rewardToken: 'SOL',
  }

  it('GETs /campaigns/:id with x-torque-api-key header and returns campaign on SUCCESS', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'SUCCESS', data: campaign }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const client = new TorqueMCPClient({
      baseUrl: 'https://torque.test',
      apiKey: 'tk_secret',
      campaignId: 'camp_devnet_1',
    })

    const result = await client.getCampaign()

    expect(result).toStrictEqual(campaign)
    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe('https://torque.test/campaigns/camp_devnet_1')
    // GET is the default; the client passes no `method`, so init.method is undefined
    expect(init?.method).toBeUndefined()
    expect(init?.headers).toMatchObject({ 'x-torque-api-key': 'tk_secret' })
    expect(init?.body).toBeUndefined()
  })

  it('returns null on non-ok HTTP (404)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }))
    const client = new TorqueMCPClient({
      baseUrl: 'https://torque.test',
      apiKey: 'tk_secret',
      campaignId: 'camp_missing',
    })
    const result = await client.getCampaign()
    expect(result).toBeNull()
  })

  it('returns null on non-ok HTTP (500)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }))
    const client = new TorqueMCPClient({
      baseUrl: 'https://torque.test',
      apiKey: 'tk_secret',
      campaignId: 'camp_devnet_1',
    })
    const result = await client.getCampaign()
    expect(result).toBeNull()
  })

  it('returns null when response envelope is not SUCCESS', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ERROR', data: campaign }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = new TorqueMCPClient({
      baseUrl: 'https://torque.test',
      apiKey: 'tk_secret',
      campaignId: 'camp_devnet_1',
    })
    const result = await client.getCampaign()
    expect(result).toBeNull()
  })

  it('returns null when SUCCESS envelope has no data field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'SUCCESS' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = new TorqueMCPClient({
      baseUrl: 'https://torque.test',
      apiKey: 'tk_secret',
      campaignId: 'camp_devnet_1',
    })
    const result = await client.getCampaign()
    expect(result).toBeNull()
  })

  it('returns null and does not propagate when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))
    const client = new TorqueMCPClient({
      baseUrl: 'https://torque.test',
      apiKey: 'tk_secret',
      campaignId: 'camp_devnet_1',
    })
    await expect(client.getCampaign()).resolves.toBeNull()
  })

  it('strips trailing slashes from baseUrl', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'SUCCESS', data: campaign }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = new TorqueMCPClient({
      baseUrl: 'https://torque.test///',
      apiKey: 'tk_secret',
      campaignId: 'camp_devnet_1',
    })
    await client.getCampaign()
    expect(fetchSpy.mock.calls[0]![0]).toBe('https://torque.test/campaigns/camp_devnet_1')
  })
})
