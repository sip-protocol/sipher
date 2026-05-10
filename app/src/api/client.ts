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

/**
 * Manually fire the registered auth interceptor. Used by code paths that
 * bypass `apiFetch` — most notably ChatSidebar's streaming fetch, which
 * cannot route through the interceptor branch in `apiFetch` because it
 * needs the response body as a stream.
 */
export function triggerAuthInterceptor(): void {
  if (!authInterceptor) return
  try {
    authInterceptor()
  } catch {
    // Mirror the 401 branch: an interceptor crash is best-effort UX and
    // should not propagate. The caller already knows the request failed.
  }
}

function emitNetworkError(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('sipher:network-error'))
}

function emitNetworkRecovered(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('sipher:network-recovered'))
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
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...fetchOpts,
      headers: { ...headers, ...(fetchOpts.headers as Record<string, string>) },
    })
  } catch (err) {
    // Network-layer failure (offline, DNS, CORS preflight refusal): browsers
    // throw `TypeError: Failed to fetch`. Surface to the global event bus so
    // <NetworkBanner> can react; rethrow so callers still see the error.
    if (err instanceof TypeError) {
      emitNetworkError()
      throw new Error('Network connection lost')
    }
    throw err
  }

  // If we recovered from a prior network error, let the banner know.
  emitNetworkRecovered()

  if (res.status === 401) {
    triggerAuthInterceptor()
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
