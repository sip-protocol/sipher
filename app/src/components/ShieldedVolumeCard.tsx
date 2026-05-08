import { useEffect, useState } from 'react'
import { Card } from './ui/Card'
import { apiFetch } from '../api/client'

interface AggregateResponse {
  totalTvlSol: number
  chainCount: number
  liveChainCount: number
  asOf: string
}

export function ShieldedVolumeCard() {
  const [data, setData] = useState<AggregateResponse | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    apiFetch<AggregateResponse>('/api/chains/aggregate', { signal: controller.signal })
      .then(setData)
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setData(null)
      })
    return () => controller.abort()
  }, [])

  return (
    <Card variant="default" className="p-6 h-full flex flex-col justify-center">
      <span
        className="text-2xs text-text-muted"
        style={{ letterSpacing: 'var(--tracking-widest)' }}
      >
        SHIELDED VOLUME · {data?.liveChainCount ?? 0} CHAINS LIVE
      </span>
      <div className="flex items-baseline gap-2 mt-3">
        <span className="text-4xl font-mono text-text">
          {data
            ? data.totalTvlSol.toLocaleString(undefined, { maximumFractionDigits: 2 })
            : '—'}
        </span>
        <span className="text-base text-text-muted">SOL</span>
      </div>
      <span className="text-xs text-text-muted mt-1">
        aggregated across all SIP vault deployments
      </span>
    </Card>
  )
}
