export type SSEHandler = (event: MessageEvent) => void

const API_URL = import.meta.env.VITE_API_URL ?? ''

/**
 * Exchange a JWT for a short-lived, one-time SSE ticket.
 * Falls back to null if the endpoint is unavailable (legacy server).
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
 * Create an SSE EventSource using a short-lived ticket (preferred)
 * or falling back to raw JWT query param (legacy).
 */
export async function connectSSE(
  token: string,
  onEvent: SSEHandler,
  onError?: (err: Event) => void
): Promise<EventSource> {
  // Try ticket exchange first — keeps JWT out of URLs
  const ticket = await fetchSseTicket(token)

  const url = ticket
    ? `${API_URL}/api/stream?ticket=${encodeURIComponent(ticket)}`
    : `${API_URL}/api/stream?token=${encodeURIComponent(token)}`

  const source = new EventSource(url)
  source.addEventListener('activity', onEvent)
  source.addEventListener('confirm', onEvent)
  source.addEventListener('agent-status', onEvent)
  source.addEventListener('herald-budget', onEvent)
  source.addEventListener('cost-update', onEvent)
  source.onerror = (err) => { onError?.(err) }
  return source
}
