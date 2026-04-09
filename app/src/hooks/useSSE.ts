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
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!token) return
    const source = connectSSE(token, (e) => {
      const data = JSON.parse(e.data) as ActivityEvent
      setEvents(prev => [data, ...prev].slice(0, 200))
    })
    sourceRef.current = source
    return () => { source.close(); sourceRef.current = null }
  }, [token])

  return { events, connected: !!sourceRef.current }
}
