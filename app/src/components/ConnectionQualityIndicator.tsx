import { useEffect, useState } from 'react'

/**
 * Backend connection-quality indicator.
 *
 * Pings the lightweight `/api/health` endpoint every 30s while the document
 * is visible to keep tab-suspended browsers from wasting cycles. Resulting
 * latency drives a tri-state color: green <500ms, yellow 500-2000ms, red
 * >2000ms or fetch failure.
 */

const PING_INTERVAL_MS = 30_000
const ENDPOINT = '/api/health'

type Quality = 'green' | 'yellow' | 'red'

function latencyToQuality(latencyMs: number): Quality {
  if (latencyMs < 500) return 'green'
  if (latencyMs < 2000) return 'yellow'
  return 'red'
}

const colorClasses: Record<Quality, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
}

export function ConnectionQualityIndicator() {
  const [quality, setQuality] = useState<Quality>('green')
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [errored, setErrored] = useState<boolean>(false)

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null
    let cancelled = false

    const ping = async () => {
      const start = performance.now()
      try {
        await fetch(ENDPOINT, { method: 'GET' })
        if (cancelled) return
        const latency = performance.now() - start
        setLatencyMs(latency)
        setQuality(latencyToQuality(latency))
        setErrored(false)
      } catch {
        if (cancelled) return
        setQuality('red')
        setErrored(true)
        setLatencyMs(null)
      }
    }

    const startInterval = () => {
      if (intervalId !== null) return
      intervalId = setInterval(ping, PING_INTERVAL_MS)
      ping()
    }

    const stopInterval = () => {
      if (intervalId === null) return
      clearInterval(intervalId)
      intervalId = null
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') startInterval()
      else stopInterval()
    }

    if (document.visibilityState === 'visible') startInterval()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      stopInterval()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const ariaLabel = errored
    ? 'Unreachable'
    : `Backend reachable (${latencyMs !== null ? `${Math.round(latencyMs)}ms` : 'pending'})`

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`inline-block w-2 h-2 rounded-full ${colorClasses[quality]}`}
    />
  )
}
