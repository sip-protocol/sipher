import { useEffect, useRef, useState } from 'react'
import { Card } from '../ui/Card'
import { Gauge } from '../ui/Gauge'
import { apiFetch } from '../../api/client'
import { useAuthState } from '../../hooks/useAuthState'

interface FactorBlock {
  score: number
  detail: string
}

interface ProjectedBlock {
  score: number
  grade: string
  factors: Record<string, FactorBlock>
  delta: {
    score: number
    addressReuse: number
    amountPatterns: number
    timingCorrelation: number
    counterpartyExposure: number
  }
}

interface ScoreData {
  address: string
  score: number
  grade: string
  transactionsAnalyzed: number
  factors: Record<string, FactorBlock>
  recommendations: string[]
  projected?: ProjectedBlock
}

interface ScoreResponse {
  data: ScoreData
}

interface PrivacyPreviewPanelProps {
  address: string
  projectedAmount: number
  projectedToken: string
  debounceMs?: number
}

export function PrivacyPreviewPanel({
  address,
  projectedAmount,
  projectedToken,
  debounceMs = 300,
}: PrivacyPreviewPanelProps) {
  const { token } = useAuthState()
  const [data, setData] = useState<ScoreData | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (projectedAmount <= 0) {
      abortRef.current?.abort()
      return
    }

    timeoutRef.current = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const res = await apiFetch<ScoreResponse>('/v1/privacy/score', {
          method: 'POST',
          token: token ?? undefined,
          body: JSON.stringify({ address, projectedAmount, projectedToken, limit: 100 }),
          signal: controller.signal,
        })
        setData(res.data)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        // Network/auth errors leave data as-is so the UI doesn't flash empty
        // mid-typing; the next successful debounce will refresh.
      }
    }, debounceMs)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [address, projectedAmount, projectedToken, debounceMs, token])

  if (projectedAmount <= 0) {
    return (
      <Card variant="default" className="p-4">
        <div
          className="text-2xs text-text-muted mb-2"
          style={{ letterSpacing: 'var(--tracking-widest)' }}
        >
          PRIVACY PREVIEW
        </div>
        <p className="text-xs text-text-muted">Enter an amount to preview projected privacy.</p>
      </Card>
    )
  }

  const projected = data?.projected

  let copy: string | null = null
  if (data && data.transactionsAnalyzed === 0) {
    copy = 'No prior history — projection is identical to current.'
  } else if (data && data.score === 100 && projected?.delta.score === 0) {
    copy = "Already at maximum — deposit doesn't change score."
  }

  return (
    <Card variant="default" className="p-4">
      <div
        className="text-2xs text-text-muted mb-3"
        style={{ letterSpacing: 'var(--tracking-widest)' }}
      >
        PRIVACY PREVIEW
      </div>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xs text-text-muted">NOW</span>
          <Gauge
            value={data?.score ?? 0}
            max={100}
            gradeLabel={data?.grade ?? '—'}
            ariaLabel="Current privacy score"
            size={80}
          />
        </div>
        <div className="text-cyan text-xl">→</div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xs text-cyan">PROJECTED</span>
          <Gauge
            value={projected?.score ?? 0}
            max={100}
            gradeLabel={projected?.grade ?? '—'}
            ariaLabel="Projected privacy score"
            size={80}
          />
        </div>
      </div>
      {projected && (
        <div className="grid grid-cols-2 gap-2 text-2xs">
          <DeltaLine label="Address reuse" value={projected.delta.addressReuse} />
          <DeltaLine label="Amount patterns" value={projected.delta.amountPatterns} />
          <DeltaLine label="Timing" value={projected.delta.timingCorrelation} />
          <DeltaLine label="Counterparty" value={projected.delta.counterpartyExposure} />
        </div>
      )}
      {copy && <p className="mt-3 text-xs text-text-muted">{copy}</p>}
    </Card>
  )
}

function DeltaLine({ label, value }: { label: string; value: number }) {
  const sign = value > 0 ? '+' : ''
  const colorClass =
    value > 0 ? 'text-success' : value < 0 ? 'text-danger' : 'text-text-muted'
  return (
    <div className="flex justify-between">
      <span className="text-text-muted">{label}</span>
      <span className={`font-mono ${colorClass}`}>
        {sign}
        {value}
      </span>
    </div>
  )
}
