import { useEffect, useRef, useState } from 'react'
import { connectSSE } from '../api/sse'
import { useAuthState } from './useAuthState'
import { useOnAuthClear } from '../store/useOnAuthClear'

export interface ActivityEvent {
  id: string
  agent: string
  type: string
  level: string
  data: Record<string, unknown>
  timestamp: string
}

export function useSSE() {
  const { token } = useAuthState()
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [connected, setConnected] = useState(false)
  const sourceRef = useRef<EventSource | null>(null)
  // Flips to `true` when onAuthClear fires while a connectSSE Promise is
  // still pending. The .then handler checks this before any state setter
  // so a stale resolution can't bypass auth-clear cleanup.
  const authClearedRef = useRef(false)

  useOnAuthClear(() => {
    authClearedRef.current = true
    setEvents([])
    setConnected(false)
    sourceRef.current?.close()
    sourceRef.current = null
  })

  useEffect(() => {
    if (!token) { setConnected(false); return }

    let cancelled = false
    // Fresh connect attempt — reset the auth-cleared flag so this attempt
    // is allowed to land. If auth clears mid-resolution, the flag flips
    // back to true and the .then handler will short-circuit.
    authClearedRef.current = false

    connectSSE(token, (e) => {
      const data = JSON.parse(e.data) as ActivityEvent
      setEvents(prev => [data, ...prev].slice(0, 200))
    }).then((source) => {
      if (cancelled || authClearedRef.current) { source.close(); return }
      sourceRef.current = source
      setConnected(true)
      // EventSource fires onerror on every transient blip (1s WiFi hiccup,
      // server hot-reload, browser-driven auto-reconnect). Wiping events on
      // each one would clear the user's live activity feed mid-read. Keep
      // events visible; users can see they're stale via the connected flag
      // (and the upcoming <NetworkBanner> for offline state at the network
      // layer). Auth-clear cleanup remains the single owner of "drain
      // events" via useOnAuthClear above.
      source.onerror = () => setConnected(false)
    }).catch(() => {
      setConnected(false)
    })

    return () => {
      cancelled = true
      sourceRef.current?.close()
      sourceRef.current = null
      setConnected(false)
    }
  }, [token])

  return { events, connected }
}
