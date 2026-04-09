export type SSEHandler = (event: MessageEvent) => void

export function connectSSE(
  token: string,
  onEvent: SSEHandler,
  onError?: (err: Event) => void
): EventSource {
  const url = `${import.meta.env.VITE_API_URL ?? ''}/api/stream?token=${encodeURIComponent(token)}`
  const source = new EventSource(url)
  source.addEventListener('activity', onEvent)
  source.addEventListener('confirm', onEvent)
  source.addEventListener('agent-status', onEvent)
  source.addEventListener('herald-budget', onEvent)
  source.addEventListener('cost-update', onEvent)
  source.onerror = (err) => { onError?.(err) }
  return source
}
