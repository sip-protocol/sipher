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

// Canonical browser messages for actual network-layer fetch failures.
// `fetch` throws a generic TypeError for many distinct codepaths (offline DNS,
// CORS preflight refusal, a bug downstream of fetch itself); only the
// browser-emitted "this request never reached the network" messages are
// genuine network errors and should surface to <NetworkBanner>.
// Sources: WHATWG fetch spec (Failed to fetch), Safari (Load failed), Firefox
// (NetworkError when attempting to fetch resource).
const NETWORK_ERROR_PATTERN = /^(Failed to fetch|Load failed|NetworkError when attempting to fetch resource)$/i

// Module-scope offline flag. Flipped to `true` when a real network-error
// fires; gates the recovery emit so the banner only animates on actual
// offline→online transitions instead of flashing on every successful fetch.
let wasOffline = false

function emitNetworkError(): void {
  wasOffline = true
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('sipher:network-error'))
}

function emitNetworkRecovered(): void {
  if (!wasOffline) return
  wasOffline = false
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('sipher:network-recovered'))
}

/**
 * Test-only helper. Resets module-scope state (currently just `wasOffline`).
 * Tests that exercise the offline→online transition logic call this in
 * `beforeEach`/`afterEach` so suites can't leak the flag between cases.
 */
export function _resetClientForTests(): void {
  wasOffline = false
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
    // throw `TypeError` with one of the canonical messages tracked above.
    // Other TypeErrors (e.g., `Cannot read property X of undefined` from a
    // bug downstream of fetch) must NOT trigger the network banner — they
    // surface as ordinary failures to the caller.
    if (err instanceof TypeError && NETWORK_ERROR_PATTERN.test(err.message)) {
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
