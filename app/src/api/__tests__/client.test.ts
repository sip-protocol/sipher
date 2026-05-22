import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  apiFetch,
  registerAuthInterceptor,
  triggerAuthInterceptor,
  _resetClientForTests,
} from '../client'

describe('apiFetch', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch
    registerAuthInterceptor(null)
  })

  afterEach(() => {
    global.fetch = originalFetch
    registerAuthInterceptor(null)
  })

  it('returns parsed json on 2xx', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    })
    const result = await apiFetch<{ hello: string }>('/test')
    expect(result).toEqual({ hello: 'world' })
  })

  it('attaches Authorization header when token option provided', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    await apiFetch('/test', { token: 'abc' })
    const callArgs = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(callArgs.headers).toMatchObject({ Authorization: 'Bearer abc' })
  })

  it('calls registered interceptor on 401', async () => {
    const onUnauth = vi.fn()
    registerAuthInterceptor(onUnauth)
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'EXPIRED', message: 'expired' } }),
    })

    await expect(apiFetch('/test')).rejects.toThrow(/expired/)
    expect(onUnauth).toHaveBeenCalledOnce()
  })

  it('does not call interceptor on non-401 errors', async () => {
    const onUnauth = vi.fn()
    registerAuthInterceptor(onUnauth)
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'server error' }),
    })

    await expect(apiFetch('/test')).rejects.toThrow(/server error/)
    expect(onUnauth).not.toHaveBeenCalled()
  })

  it('does not call interceptor on 2xx', async () => {
    const onUnauth = vi.fn()
    registerAuthInterceptor(onUnauth)
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    })
    await apiFetch('/test')
    expect(onUnauth).not.toHaveBeenCalled()
  })

  it('does not call interceptor on 401 from a /v1/ endpoint (separate API-key auth domain)', async () => {
    // /v1/* is the REST API — it authenticates with an x-api-key header, not
    // the agent JWT. A 401 there means "no/invalid API key", NOT "agent
    // session expired", so it must not trigger clearAuth + the "Session
    // expired" re-auth flow. Treating it as expiry creates an infinite
    // sign-in loop: a valid session gets wiped the moment the dashboard's
    // privacy-score widget fetches /v1/privacy/score.
    const onUnauth = vi.fn()
    registerAuthInterceptor(onUnauth)
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'INVALID_API_KEY', message: 'Invalid API key' } }),
    })

    await expect(apiFetch('/v1/privacy/score', { method: 'POST' })).rejects.toThrow(
      /Invalid API key/,
    )
    expect(onUnauth).not.toHaveBeenCalled()
  })

  it('still throws on 401 even if interceptor throws', async () => {
    registerAuthInterceptor(() => {
      throw new Error('handler crashed')
    })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'expired' }),
    })

    await expect(apiFetch('/test')).rejects.toThrow(/expired/)
  })

  it('parses legacy string error shape on non-2xx', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'bad request' }),
    })
    await expect(apiFetch('/test')).rejects.toThrow(/bad request/)
  })

  it('parses structured error envelope on non-2xx', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 'X', message: 'detail' } }),
    })
    await expect(apiFetch('/test')).rejects.toThrow(/detail/)
  })

  it('falls back to status-based message when no body', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error('not json')
      },
    })
    await expect(apiFetch('/test')).rejects.toThrow(/503/)
  })

  it('returns undefined for 204 No Content without parsing body', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: new Headers(),
      json: async () => {
        throw new Error('should not be called')
      },
    })
    const result = await apiFetch('/test', { method: 'POST' })
    expect(result).toBeUndefined()
  })

  it('returns undefined for content-length: 0 without parsing body', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': '0' }),
      json: async () => {
        throw new Error('should not be called')
      },
    })
    const result = await apiFetch('/test')
    expect(result).toBeUndefined()
  })
})

describe('apiFetch network-error branch', () => {
  let originalFetch: typeof globalThis.fetch
  beforeEach(() => {
    originalFetch = globalThis.fetch
    _resetClientForTests()
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
    _resetClientForTests()
  })

  it('emits a network-error CustomEvent on TypeError: Failed to fetch', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const handler = vi.fn()
    window.addEventListener('sipher:network-error', handler)
    await expect(apiFetch('/whatever')).rejects.toThrow(/network/i)
    expect(handler).toHaveBeenCalledOnce()
    window.removeEventListener('sipher:network-error', handler)
  })

  it('does not emit network-error on a non-network failure (e.g. 500)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'server boom' }), { status: 500 }),
    )
    const handler = vi.fn()
    window.addEventListener('sipher:network-error', handler)
    await expect(apiFetch('/whatever')).rejects.toThrow(/boom/)
    expect(handler).not.toHaveBeenCalled()
    window.removeEventListener('sipher:network-error', handler)
  })

  it('does NOT emit network-recovered on first successful fetch (was never offline)', async () => {
    // Lock: recovery is a transition event. Without a prior network-error
    // there is nothing to recover from, so the banner must not flash.
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    const handler = vi.fn()
    window.addEventListener('sipher:network-recovered', handler)
    await apiFetch('/whatever')
    expect(handler).not.toHaveBeenCalled()
    window.removeEventListener('sipher:network-recovered', handler)
  })

  it('emits network-recovered ONLY after a prior network error (offline→online transition)', async () => {
    const recoveredHandler = vi.fn()
    window.addEventListener('sipher:network-recovered', recoveredHandler)

    // Step 1: simulate going offline via a real network TypeError.
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(apiFetch('/foo')).rejects.toThrow()
    expect(recoveredHandler).not.toHaveBeenCalled()

    // Step 2: next successful fetch fires recovery exactly once.
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    await apiFetch('/foo')
    expect(recoveredHandler).toHaveBeenCalledOnce()

    // Step 3: subsequent successes do NOT refire (offline flag was reset).
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    await apiFetch('/foo')
    expect(recoveredHandler).toHaveBeenCalledOnce()

    window.removeEventListener('sipher:network-recovered', recoveredHandler)
  })

  it('preserves AbortError name through the network-error catch wrapper', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      const e = new DOMException('aborted', 'AbortError')
      throw e
    })
    const handler = vi.fn()
    window.addEventListener('sipher:network-error', handler)
    try {
      await apiFetch('/whatever')
      throw new Error('apiFetch should have thrown')
    } catch (err) {
      // AbortError must propagate as-is — 8+ callers in the app rely on
      // `err.name === 'AbortError'` to distinguish user-cancelled requests
      // from genuine failures. The new TypeError wrapper must NOT catch it.
      expect((err as Error).name).toBe('AbortError')
    }
    expect(handler).not.toHaveBeenCalled()
    window.removeEventListener('sipher:network-error', handler)
  })

  it('does NOT emit network-error for non-network TypeErrors (e.g. JSON parse)', async () => {
    // A TypeError thrown from a downstream codepath (e.g., `Cannot read
    // properties of undefined`) is NOT a network failure and must not pollute
    // the NetworkBanner. Lock: only the canonical browser network-error
    // message strings trigger the network-error event.
    globalThis.fetch = vi.fn().mockRejectedValue(
      new TypeError('Cannot read properties of undefined (reading "foo")'),
    )
    const handler = vi.fn()
    window.addEventListener('sipher:network-error', handler)
    await expect(apiFetch('/whatever')).rejects.toThrow()
    expect(handler).not.toHaveBeenCalled()
    window.removeEventListener('sipher:network-error', handler)
  })

  it('emits network-error for Safari "Load failed" TypeError', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Load failed'))
    const handler = vi.fn()
    window.addEventListener('sipher:network-error', handler)
    await expect(apiFetch('/whatever')).rejects.toThrow()
    expect(handler).toHaveBeenCalledOnce()
    window.removeEventListener('sipher:network-error', handler)
  })

  it('emits network-error for Firefox "NetworkError when attempting to fetch resource" TypeError', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(
      new TypeError('NetworkError when attempting to fetch resource'),
    )
    const handler = vi.fn()
    window.addEventListener('sipher:network-error', handler)
    await expect(apiFetch('/whatever')).rejects.toThrow()
    expect(handler).toHaveBeenCalledOnce()
    window.removeEventListener('sipher:network-error', handler)
  })
})

describe('triggerAuthInterceptor', () => {
  it('invokes the registered auth interceptor exactly once', () => {
    const handler = vi.fn()
    registerAuthInterceptor(handler)
    triggerAuthInterceptor()
    expect(handler).toHaveBeenCalledOnce()
    registerAuthInterceptor(null)
  })

  it('is a no-op when no interceptor is registered', () => {
    registerAuthInterceptor(null)
    expect(() => triggerAuthInterceptor()).not.toThrow()
  })

  it('swallows interceptor exceptions like the 401 path does', () => {
    const handler = vi.fn(() => { throw new Error('boom') })
    registerAuthInterceptor(handler)
    expect(() => triggerAuthInterceptor()).not.toThrow()
    registerAuthInterceptor(null)
  })
})
