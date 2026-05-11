import { useEffect, useRef, useState } from 'react'
import { Card } from './ui/Card'
import { Pill } from './ui/Pill'

interface AnonActivityRow {
  type: string
  chain: string
  amountBand: '<1' | '1-10' | '10-100' | '100-1000' | '>1000'
  relativeTime: string
}

interface ActivitySummaryResponse {
  counter: number
  recent: AnonActivityRow[]
}

const POLL_INTERVAL_MS = 60_000
const API_BASE = import.meta.env.VITE_API_URL ?? ''
const ENDPOINT = `${API_BASE}/api/public/activity-summary`

/**
 * Live ecosystem-wide activity teaser shown on the unauthed Dashboard in
 * place of the empty `<ActivityStreamTable />`. Displays an all-time
 * counter of successful shielded transfers + the 5 most-recent anonymized
 * rows. Backend: GET /api/public/activity-summary (60s server cache,
 * 120 req/min/IP rate-limited).
 *
 * Polls every 60s while the tab is visible. AbortController on unmount.
 * Renders a graceful "Live activity unavailable" empty state on fetch error.
 */
export default function UnauthedActivityFeed() {
  const [data, setData] = useState<ActivitySummaryResponse | null>(null)
  const [error, setError] = useState<boolean>(false)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const controller = new AbortController()
      controllerRef.current = controller
      try {
        const res = await fetch(ENDPOINT, { signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as ActivitySummaryResponse
        if (cancelled || controller.signal.aborted) return
        setData(json)
        setError(false)
      } catch (err) {
        if (cancelled || controller.signal.aborted) return
        if (err instanceof Error && err.name === 'AbortError') return
        setError(true)
      }
    }

    // Initial mount always fetches once. Subsequent polls are gated by tab
    // visibility — we don't burn API budget on a backgrounded tab.
    void load()

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      void load()
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
      controllerRef.current?.abort()
    }
  }, [])

  if (error && !data) {
    return (
      <Card variant="default" className="p-6">
        <div className="flex items-center justify-between">
          <h3
            className="text-2xs text-text-muted"
            style={{ letterSpacing: 'var(--tracking-widest)' }}
          >
            LIVE ACTIVITY
          </h3>
        </div>
        <p className="text-sm text-text-muted text-center py-8">Live activity unavailable</p>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card variant="default" className="p-6" data-testid="activity-feed-skeleton">
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-2xs text-text-muted"
            style={{ letterSpacing: 'var(--tracking-widest)' }}
          >
            LIVE ACTIVITY · ECOSYSTEM
          </h3>
        </div>
        <div className="space-y-3">
          <div className="h-8 w-48 bg-line/40 rounded animate-pulse" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-6 bg-line/30 rounded animate-pulse" />
          ))}
        </div>
      </Card>
    )
  }

  const { counter, recent } = data

  return (
    <Card variant="default" className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-2xs text-text-muted"
          style={{ letterSpacing: 'var(--tracking-widest)' }}
        >
          LIVE ACTIVITY · ECOSYSTEM
        </h3>
      </div>
      <div className="mb-5">
        <div className="text-2xl font-mono text-text">{counter.toLocaleString()}</div>
        <div
          className="text-2xs text-text-muted mt-0.5"
          style={{ letterSpacing: 'var(--tracking-wider)' }}
        >
          SHIELDED TRANSFERS · ALL TIME
        </div>
      </div>
      {recent.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-4">No recent activity.</p>
      ) : (
        <ul className="space-y-2">
          {recent.map((row, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between border-t border-line py-2 text-xs"
            >
              <div className="flex items-center gap-2">
                <Pill label={row.type.toUpperCase()} size="sm" />
                <span className="text-text-muted uppercase tracking-wider text-2xs">{row.chain}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-text-secondary">{row.amountBand} SOL</span>
                <span className="text-text-muted">{row.relativeTime}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
