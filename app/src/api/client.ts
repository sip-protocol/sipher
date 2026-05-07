const BASE = import.meta.env.VITE_API_URL ?? ''

type UnauthHandler = () => void

let authInterceptor: UnauthHandler | null = null

/**
 * Register a single global handler invoked whenever apiFetch receives 401.
 * Pass `null` to clear. AuthSyncProvider wires this up on mount and tears
 * down on unmount, so callers across the app get a consistent re-auth UX
 * (clearAuth + toast + Sign in CTA) without each fetch site reinventing it.
 */
export function registerAuthInterceptor(handler: UnauthHandler | null) {
  authInterceptor = handler
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const { token, ...fetchOpts } = options ?? {}
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const res = await fetch(`${BASE}${path}`, {
    ...fetchOpts,
    headers: { ...headers, ...(fetchOpts.headers as Record<string, string>) },
  })
  if (res.status === 401) {
    if (authInterceptor) {
      try {
        authInterceptor()
      } catch {
        // Never let an interceptor crash propagate up — auth-loss UX is
        // best-effort. The original request still throws below.
      }
    }
    const body = await res.json().catch(() => ({}))
    const err = (body as { error?: { message?: string } | string }).error
    if (typeof err === 'string') throw new Error(err)
    if (err && typeof err === 'object' && typeof err.message === 'string') {
      throw new Error(err.message)
    }
    throw new Error('Authentication required')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = (body as { error?: { message?: string } | string }).error
    if (typeof err === 'string') throw new Error(err)
    if (err && typeof err === 'object' && typeof err.message === 'string') {
      throw new Error(err.message)
    }
    throw new Error(`API error ${res.status}`)
  }
  // 204 No Content / explicitly empty bodies — there is nothing to parse and
  // res.json() on an empty stream throws. Endpoints like promise-gate
  // resolve/reject return 204 on success; callers ignore the return value.
  if (res.status === 204 || res.headers?.get('content-length') === '0') {
    return undefined as T
  }
  return res.json() as Promise<T>
}
