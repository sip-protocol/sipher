import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch, registerAuthInterceptor } from '../client'

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
