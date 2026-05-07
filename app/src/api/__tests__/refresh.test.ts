import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { refreshToken } from '../refresh'

describe('refreshToken', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('POSTs to /api/auth/refresh with Bearer token and returns new token', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'newtok', expiresIn: '24h' }),
    })

    const result = await refreshToken('oldtok')

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/refresh',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer oldtok' },
      }),
    )
    expect(result).toEqual({ token: 'newtok', expiresIn: '24h' })
  })

  it('returns null on 425 (too early)', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 425,
      json: async () => ({ error: { code: 'TOO_EARLY' } }),
    })

    const result = await refreshToken('oldtok')
    expect(result).toBeNull()
  })

  it('returns null on 404 (endpoint not deployed yet)', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({}),
    })

    const result = await refreshToken('oldtok')
    expect(result).toBeNull()
  })

  it('throws on 401 with structured error message', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'INVALID_TOKEN', message: 'Token invalid or expired' } }),
    })

    await expect(refreshToken('oldtok')).rejects.toThrow(/Token invalid or expired/)
  })

  it('throws on 401 with legacy string error', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'unauthorized' }),
    })

    await expect(refreshToken('oldtok')).rejects.toThrow(/unauthorized/)
  })

  it('throws on 401 with no error body (default message)', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    })

    await expect(refreshToken('oldtok')).rejects.toThrow(/full re-sign required/)
  })

  it('throws on 5xx with status in message', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    })

    await expect(refreshToken('oldtok')).rejects.toThrow(/503/)
  })
})
