import { useEffect, useState } from 'react'
import ActivityEntry from '../components/ActivityEntry'
import { type ActivityEvent } from '../hooks/useSSE'
import { apiFetch } from '../api/client'

export default function StreamView({ events, token }: { events: ActivityEvent[], token: string | null }) {
  const [history, setHistory] = useState<ActivityEvent[]>([])
  const [loadError, setLoadError] = useState(false)

  // Load initial history on mount
  useEffect(() => {
    if (!token) return
    setLoadError(false)
    apiFetch<{ activity: any[] }>('/api/activity', { token })
      .then(data => {
        setHistory((data.activity ?? []).map((a: any) => ({
          id: a.id,
          agent: a.agent,
          type: a.type,
          level: a.level,
          data: typeof a.detail === 'string' ? JSON.parse(a.detail) : a.detail ?? {},
          timestamp: a.created_at,
        })))
      })
      .catch(() => { setLoadError(true) })
  }, [token])

  const allEvents = [...events, ...history]

  if (allEvents.length === 0) {
    return (
      <div className="text-[#71717A] text-sm text-center py-20">
        <p>No activity yet.</p>
        <p className="mt-2 text-[12px]">Connect your wallet to start monitoring.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {loadError && (
        <div className="text-[#71717A] text-xs font-mono bg-[#141416] border border-[#1E1E22] rounded-lg px-3 py-2 mb-3">
          Could not load activity history
        </div>
      )}
      {allEvents.map(event => (
        <ActivityEntry
          key={event.id}
          agent={event.agent as any}
          title={event.data?.title as string ?? event.data?.message as string ?? event.type}
          detail={event.data?.detail as string}
          time={event.timestamp}
          level={event.level}
        />
      ))}
    </div>
  )
}
