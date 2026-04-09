import { useEffect, useRef, useState } from 'react'
import { connectSSE } from '../api/sse'

export interface ActivityEvent {
  id: string
  agent: string
  type: string
  level: string
  data: Record<string, unknown>
  timestamp: string
}

export function useSSE(token: string | null) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [connected, setConnected] = useState(false)
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!token) { setConnected(false); return }
    const source = connectSSE(token, (e) => {
      const data = JSON.parse(e.data) as ActivityEvent
      setEvents(prev => [data, ...prev].slice(0, 200))
    })
    sourceRef.current = source
    setConnected(true)

    source.onerror = () => setConnected(false)

    return () => { source.close(); sourceRef.current = null; setConnected(false) }
  }, [token])

  return { events, connected }
}
