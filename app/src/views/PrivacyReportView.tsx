import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { apiFetch } from '../api/client'
import { useAuthState } from '../hooks/useAuthState'
import { Card } from '../components/ui/Card'
import { Gauge } from '../components/ui/Gauge'
import { MetricBar } from '../components/ui/MetricBar'

interface PrivacyData {
  score: number
  grade: string
  factors: Record<string, { score: number; detail: string }>
  recommendations: string[]
  transactionsAnalyzed: number
}

function humanizeFactorKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
}

export default function PrivacyReportView() {
  const navigate = useNavigate()
  const { token } = useAuthState()
  const [data, setData] = useState<PrivacyData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    apiFetch<{ data: PrivacyData }>('/v1/privacy/score', {
      method: 'POST',
      token,
      body: JSON.stringify({ limit: 500 }),
      signal: controller.signal,
    })
      .then((j) => setData(j.data))
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to load privacy report')
      })
    return () => controller.abort()
  }, [token])

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>

      {error && (
        <Card variant="default" className="p-4 text-sm text-danger">
          {error}
        </Card>
      )}

      {!data && !error && (
        <Card variant="default" className="p-8 text-center text-text-muted text-sm">
          Loading privacy report…
        </Card>
      )}

      {data && (
        <>
          <Card variant="default" sheen className="p-8">
            <div className="flex flex-col items-center gap-4">
              <Gauge value={data.score} max={100} gradeLabel={data.grade} ariaLabel="Privacy score" />
              <span className="text-base text-text-muted">
                Based on {data.transactionsAnalyzed.toLocaleString()} transactions analyzed
              </span>
            </div>
          </Card>

          <Card variant="default" className="p-6 space-y-4">
            <h2
              className="text-xs text-text-muted"
              style={{ letterSpacing: 'var(--tracking-widest)' }}
            >
              FACTOR BREAKDOWN
            </h2>
            {Object.entries(data.factors).map(([key, factor]) => (
              <MetricBar
                key={key}
                label={humanizeFactorKey(key)}
                value={factor.score}
                helper={factor.detail}
              />
            ))}
          </Card>

          {data.recommendations.length > 0 && (
            <Card variant="default" className="p-6 space-y-3">
              <h2
                className="text-xs text-text-muted"
                style={{ letterSpacing: 'var(--tracking-widest)' }}
              >
                RECOMMENDATIONS
              </h2>
              <ul className="space-y-2">
                {data.recommendations.map((r, i) => (
                  <li key={i} className="text-base text-text-secondary">
                    • {r}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
