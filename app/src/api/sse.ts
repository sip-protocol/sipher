export type SSEHandler = (event: MessageEvent) => void

const API_URL = import.meta.env.VITE_API_URL ?? ''

/**
 * Exchange a JWT for a short-lived, one-time SSE ticket.
 * Returns null if the endpoint is unavailable (legacy server) or rejects.
 */
async function fetchSseTicket(jwt: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/sse-ticket`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { ticket?: string }
    return data.ticket ?? null
  } catch {
    return null
  }
}

/**
 * Pure URL-picker for the SSE stream. Production must never put the raw
 * JWT in a URL — query params leak into browser history, server access
 * logs, and Referer headers. DEV keeps the JWT-in-URL fallback as a
 * convenience for local development against an old server build that
 * doesn't expose /api/auth/sse-ticket yet.
 */
export function pickSseUrl(
  token: string,
  ticket: string | null,
  baseUrl: string,
  isDev: boolean,
): string {
  if (ticket) return `${baseUrl}/api/stream?ticket=${encodeURIComponent(ticket)}`
  if (isDev) return `${baseUrl}/api/stream?token=${encodeURIComponent(token)}`
  throw new Error(
    'SSE ticket exchange failed; JWT-in-URL fallback is disabled in production builds',
  )
}

export async function connectSSE(
  token: string,
  onEvent: SSEHandler,
  onError?: (err: Event) => void,
): Promise<EventSource> {
  const ticket = await fetchSseTicket(token)
  const url = pickSseUrl(token, ticket, API_URL, import.meta.env.DEV === true)

  const source = new EventSource(url)
  source.addEventListener('activity', onEvent)
  source.addEventListener('confirm', onEvent)
  source.addEventListener('agent-status', onEvent)
  source.addEventListener('herald-budget', onEvent)
  source.addEventListener('cost-update', onEvent)
  source.onerror = (err) => { onError?.(err) }
  return source
}
