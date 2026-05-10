import { useState } from 'react'
import { Card } from './ui/Card'
import { Gauge } from './ui/Gauge'
import { MetricBar } from './ui/MetricBar'
import { Sheet } from './ui/Sheet'
import { UnauthedEmptyState } from './ui/UnauthedEmptyState'
import { useAppStore } from '../stores/app'
import { useAuthState } from '../hooks/useAuthState'

interface PrivacyData {
  score: number
  grade: string
  factors: {
    addressReuse: { score: number; detail: string }
    amountPatterns: { score: number; detail: string }
    timingCorrelation: { score: number; detail: string }
    counterpartyExposure: { score: number; detail: string }
  }
  recommendations: string[]
  transactionsAnalyzed: number
}

interface PrivacyScoreCardProps {
  data: PrivacyData | null
  delta?: number
}

export function PrivacyScoreCard({ data, delta }: PrivacyScoreCardProps) {
  const setActiveView = useAppStore((s) => s.setActiveView)
  const { status } = useAuthState()
  const [teaserOpen, setTeaserOpen] = useState(false)

  const handleViewReport = () => {
    if (status === 'authed') {
      setActiveView('privacyReport')
    } else {
      setTeaserOpen(true)
    }
  }

  return (
    <>
      <Card variant="default" sheen className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex items-center justify-center">
            <Gauge
              value={data?.score ?? 0}
              max={100}
              gradeLabel={data?.grade ?? '—'}
              ariaLabel="Privacy score"
            />
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <div>
                <div
                  className="text-2xs text-text-muted"
                  style={{ letterSpacing: 'var(--tracking-widest)' }}
                >
                  PRIVACY SCORE
                </div>
                <div className="text-base mt-1">
                  {delta != null && (
                    <span className="text-cyan font-mono">
                      {delta > 0 ? '+' : ''}
                      {delta}
                    </span>
                  )}
                  <span className="text-text-muted"> vs last week</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleViewReport}
                className="text-xs text-text-secondary border border-line rounded-md px-3 py-1.5 hover:border-line-2 hover:text-text transition-colors"
              >
                View report →
              </button>
            </div>
            {data && (
              <div className="flex flex-col gap-3">
                <MetricBar
                  label="Anonymity set"
                  value={data.factors.addressReuse.score}
                  helper={data.factors.addressReuse.detail}
                />
                <MetricBar
                  label="Time decay"
                  value={data.factors.amountPatterns.score}
                  helper={data.factors.amountPatterns.detail}
                />
                <MetricBar
                  label="Withdraw routing"
                  value={data.factors.timingCorrelation.score}
                  helper={data.factors.timingCorrelation.detail}
                />
                <MetricBar
                  label="Address hygiene"
                  value={data.factors.counterpartyExposure.score}
                  helper={data.factors.counterpartyExposure.detail}
                />
              </div>
            )}
          </div>
        </div>
      </Card>

      <Sheet
        open={teaserOpen}
        onClose={() => setTeaserOpen(false)}
        ariaLabel="Privacy Score Report"
      >
        <div className="flex flex-col gap-4 p-2">
          <UnauthedEmptyState
            bare
            title="Privacy Score Report"
            body="Network analysis · surveillance score · personalized recommendations. Connect a wallet to view your full report."
          />
          <button
            type="button"
            onClick={() => setTeaserOpen(false)}
            className="self-start text-xs text-text-muted hover:text-text"
          >
            Close
          </button>
        </div>
      </Sheet>
    </>
  )
}
