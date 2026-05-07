import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { requestNonce, verifySignature } from '../auth'

describe('auth api client', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('requestNonce', () => {
    it('POSTs to /api/auth/nonce with wallet and returns nonce + message', async () => {
      ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nonce: 'abc', message: 'sign this' }),
      })

      const result = await requestNonce('walletA')

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/nonce',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ wallet: 'walletA' }),
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      )
      expect(result).toEqual({ nonce: 'abc', message: 'sign this' })
    })
  })

  describe('verifySignature', () => {
    it('returns token, isAdmin, and expiresIn from server response', async () => {
      ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'tok', isAdmin: false, expiresIn: '24h' }),
      })

      const result = await verifySignature('walletA', 'nonce', 'sig')

      expect(result).toEqual({ token: 'tok', isAdmin: false, expiresIn: '24h' })
    })

    it('preserves isAdmin true from server response', async () => {
      ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'tok', isAdmin: true, expiresIn: '1h' }),
      })

      const result = await verifySignature('walletA', 'nonce', 'sig')

      expect(result.isAdmin).toBe(true)
      expect(result.expiresIn).toBe('1h')
    })

    it('throws on non-OK response with structured error', async () => {
      ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'invalid signature' }),
      })

      await expect(verifySignature('walletA', 'nonce', 'sig')).rejects.toThrow(/invalid signature/)
    })
  })
})
