import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TorqueMCPClient } from '../../../src/integrations/torque/mcp-client.js'
import type { SipherGrowthEvent } from '../../../src/integrations/torque/types.js'

const baseEvent: SipherGrowthEvent = {
  userPubkey: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
  timestamp: 1747068000000,
  eventName: 'sipher_private_send_completed',
  data: {
    tx_signature: '3QCoHcJ1NNg',
    network: 'devnet',
    rebate_destination: '4HC3vQB5s5c',
  },
}

describe('TorqueMCPClient.emitEvent', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs the event with x-api-key header to /events with flat body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'OK' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const client = new TorqueMCPClient({
      ingesterUrl: 'https://ingest.torque.test',
      apiToken: 'tk_secret',
    })

    const result = await client.emitEvent(baseEvent)

    expect(result).toStrictEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe('https://ingest.torque.test/events')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toStrictEqual({
      'Content-Type': 'application/json',
      'x-api-key': 'tk_secret',
    })
    expect(JSON.parse(init?.body as string)).toStrictEqual(baseEvent)
  })

  it('strips trailing slash from ingesterUrl', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'OK' }), { status: 200 }),
    )

    const client = new TorqueMCPClient({
      ingesterUrl: 'https://ingest.torque.test/',
      apiToken: 'tk_secret',
    })

    await client.emitEvent(baseEvent)
    expect(fetchSpy.mock.calls[0]![0]).toBe('https://ingest.torque.test/events')
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
      ingesterUrl: 'https://ingest.torque.test',
      apiToken: 'tk_secret',
    })
  }

  it('returns auth reason on 401', async () => {
    const client = clientWithMockedFetch(401)
    const result = await client.emitEvent({
      userPubkey: 'C1phr',
      timestamp: 1747068000000,
      eventName: 'sipher_private_send_completed',
      data: { tx_signature: 's', network: 'devnet', rebate_destination: 'r' },
    })
    expect(result).toStrictEqual({ ok: false, reason: 'auth', message: expect.stringMatching(/401/) })
  })

  it('returns auth reason on 403', async () => {
    const client = clientWithMockedFetch(403)
    const result = await client.emitEvent({
      userPubkey: 'C1phr',
      timestamp: 1747068000000,
      eventName: 'sipher_private_send_completed',
      data: { tx_signature: 's', network: 'devnet', rebate_destination: 'r' },
    })
    expect(result).toStrictEqual({ ok: false, reason: 'auth', message: expect.stringMatching(/403/) })
  })

  it('returns rate_limit reason on 429', async () => {
    const client = clientWithMockedFetch(429)
    const result = await client.emitEvent({
      userPubkey: 'C1phr',
      timestamp: 1747068000000,
      eventName: 'sipher_private_send_completed',
      data: { tx_signature: 's', network: 'devnet', rebate_destination: 'r' },
    })
    expect(result).toStrictEqual({ ok: false, reason: 'rate_limit', message: expect.stringMatching(/rate limit/i) })
  })

  it('returns event_undefined reason when 400 says "Event not found"', async () => {
    const client = clientWithMockedFetch(400, { status: 'BAD_REQUEST', message: 'Event not found for this API key' })
    const result = await client.emitEvent({
      userPubkey: 'C1phr',
      timestamp: 1747068000000,
      eventName: 'sipher_private_send_completed',
      data: { tx_signature: 's', network: 'devnet', rebate_destination: 'r' },
    })
    expect(result).toStrictEqual({
      ok: false,
      reason: 'event_undefined',
      message: 'Event not found for this API key',
    })
  })

  it('returns validation reason for other 400 errors', async () => {
    const client = clientWithMockedFetch(400, { status: 'BAD_REQUEST', message: 'body/data Required' })
    const result = await client.emitEvent({
      userPubkey: 'C1phr',
      timestamp: 1747068000000,
      eventName: 'sipher_private_send_completed',
      data: { tx_signature: 's', network: 'devnet', rebate_destination: 'r' },
    })
    expect(result).toStrictEqual({
      ok: false,
      reason: 'validation',
      message: 'body/data Required',
    })
  })

  it('returns unknown reason on 5xx', async () => {
    const client = clientWithMockedFetch(503)
    const result = await client.emitEvent({
      userPubkey: 'C1phr',
      timestamp: 1747068000000,
      eventName: 'sipher_private_send_completed',
      data: { tx_signature: 's', network: 'devnet', rebate_destination: 'r' },
    })
    expect(result).toStrictEqual({
      ok: false,
      reason: 'unknown',
      message: expect.stringMatching(/503/),
    })
  })

  it('returns network reason on fetch error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'))
    const client = new TorqueMCPClient({
      ingesterUrl: 'https://ingest.torque.test',
      apiToken: 'tk_secret',
    })
    const result = await client.emitEvent({
      userPubkey: 'C1phr',
      timestamp: 1747068000000,
      eventName: 'sipher_private_send_completed',
      data: { tx_signature: 's', network: 'devnet', rebate_destination: 'r' },
    })
    expect(result).toStrictEqual({ ok: false, reason: 'network', message: 'connection refused' })
  })
})

describe('TorqueMCPClient.pingIngester', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns ok on 2xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    const client = new TorqueMCPClient({
      ingesterUrl: 'https://ingest.torque.test',
      apiToken: 'tk_secret',
    })
    const result = await client.pingIngester()
    expect(result).toStrictEqual({ ok: true })
  })

  it('returns ok on 400 (host reachable, just rejected the empty body)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'BAD_REQUEST', message: 'body/eventName Required, body/data Required' }), {
        status: 400,
      }),
    )
    const client = new TorqueMCPClient({
      ingesterUrl: 'https://ingest.torque.test',
      apiToken: 'tk_secret',
    })
    const result = await client.pingIngester()
    expect(result).toStrictEqual({ ok: true })
  })

  it('returns auth reason on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }))
    const client = new TorqueMCPClient({
      ingesterUrl: 'https://ingest.torque.test',
      apiToken: 'tk_secret',
    })
    const result = await client.pingIngester()
    expect(result).toStrictEqual({ ok: false, reason: 'auth', message: expect.stringMatching(/401/) })
  })

  it('returns network reason on fetch error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'))
    const client = new TorqueMCPClient({
      ingesterUrl: 'https://ingest.torque.test',
      apiToken: 'tk_secret',
    })
    const result = await client.pingIngester()
    expect(result).toStrictEqual({ ok: false, reason: 'network', message: 'connection refused' })
  })
})
