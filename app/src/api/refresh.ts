const BASE = import.meta.env.VITE_API_URL ?? ''

export interface RefreshResponse {
  token: string
  expiresIn: string
}

/**
 * POST /api/auth/refresh.
 * Returns { token, expiresIn } if refresh succeeded.
 * Returns null if too early (server returns 425) or endpoint not deployed (404).
 * Throws on 401 / 5xx / network errors.
 */
export async function refreshToken(currentToken: string): Promise<RefreshResponse | null> {
  const res = await fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${currentToken}` },
  })

  if (res.ok) return res.json()
  if (res.status === 425) return null
  if (res.status === 404) return null
  if (res.status === 401) {
    const err = await res.json().catch(() => ({}))
    const message = (err as { error?: { message?: string } | string }).error
    if (typeof message === 'string') throw new Error(message)
    if (message && typeof message === 'object' && typeof message.message === 'string') {
      throw new Error(message.message)
    }
    throw new Error('Token invalid; full re-sign required')
  }
  throw new Error(`Refresh failed: ${res.status}`)
}
