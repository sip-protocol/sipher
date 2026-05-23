import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { broadcastViaBackend } from '../broadcast'

const FAKE_SIGNATURE = '5J7XHm...fake'

const validInput = () => ({
  serializedTx: 'AQID',  // base64 for [1,2,3]
  blockhash: 'HF3abc...fake',
  lastValidBlockHeight: 100_000_000,
})

describe('broadcastViaBackend', () => {
  const fetchSpy = vi.fn()

  beforeEach(() => {
    fetchSpy.mockReset()
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs to /api/tx/broadcast with the expected body shape', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ signature: FAKE_SIGNATURE }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await broadcastViaBackend(validInput(), 'jwt-token-abc')

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/tx/broadcast')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body as string)).toEqual(validInput())
  })

  it('sends Authorization: Bearer <token> when token provided', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ signature: FAKE_SIGNATURE }), { status: 200 }),
    )

    await broadcastViaBackend(validInput(), 'jwt-token-abc')

    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = opts.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer jwt-token-abc')
  })

  it('returns { signature } on 200 success', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ signature: FAKE_SIGNATURE }), { status: 200 }),
    )

    const result = await broadcastViaBackend(validInput(), 'jwt-token-abc')
    expect(result).toEqual({ signature: FAKE_SIGNATURE })
  })

  it('throws with the envelope error message on 4xx', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: 'BLOCKHASH_EXPIRED', message: 'blockhash already in the past' } }),
        { status: 400 },
      ),
    )

    await expect(broadcastViaBackend(validInput(), 'jwt-token-abc'))
      .rejects.toThrow('blockhash already in the past')
  })

  it('throws on 5xx with the envelope message', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: 'CONFIRMATION_TIMEOUT', message: 'expired before confirm' } }),
        { status: 504 },
      ),
    )

    await expect(broadcastViaBackend(validInput(), 'jwt-token-abc'))
      .rejects.toThrow('expired before confirm')
  })
})
