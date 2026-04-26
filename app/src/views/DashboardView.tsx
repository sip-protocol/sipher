import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Wallet,
  ShieldCheck,
  ArrowDown,
  Lightning,
} from '@phosphor-icons/react'
import { apiFetch } from '../api/client'
import { useAppStore } from '../stores/app'
import { type ActivityEvent } from '../hooks/useSSE'
import { useIsAdmin } from '../hooks/useIsAdmin'
import AdminOnly from '../components/AdminOnly'
import MetricCard from '../components/MetricCard'
import ActivityEntry from '../components/ActivityEntry'
import AgentDot from '../components/AgentDot'
import { AGENTS, type AgentName } from '../lib/agents'
import { formatSOL } from '../lib/format'

interface VaultData {
  wallet: string
  balances: { sol: number; tokens: unknown[]; status: string }
}

interface HealthData {
  status: string
  tools: string[]
  uptime: number
  activeSessions: number
}

interface HeraldBudget {
  budget: { spent: number; limit: number; percentage: number; gate: string }
}

interface PrivacyData {
  score: number
  grade: string
  factors: Record<string, { score: number; detail: string }>
  recommendations: string[]
  transactionsAnalyzed: number
}

interface ActivityRecord {
  id: string
  agent: string
  type: string
  level: string
  title: string
  detail?: string | null
  created_at: string
}

function parseDetail(detail: unknown): Record<string, unknown> {
  if (typeof detail === 'string') {
    try { return JSON.parse(detail) }
    catch { return { detail } }
  }
  return (detail as Record<string, unknown>) ?? {}
}

export default function DashboardView({
  events,
  token,
}: {
  events: ActivityEvent[]
  token: string | null
}) {
  const isAdmin = useIsAdmin()
  const seedChat = useAppStore((s) => s.seedChat)
  const [vault, setVault] = useState<VaultData | null>(null)
  const [health, setHealth] = useState<HealthData | null>(null)
  const [heraldBudget, setHeraldBudget] = useState<HeraldBudget | null>(null)
  const [history, setHistory] = useState<ActivityEvent[]>([])
  const [privacyData, setPrivacyData] = useState<PrivacyData | null>(null)
  const [privacyError, setPrivacyError] = useState<string | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wallet = vault?.wallet

  const fetchPrivacyScore = useCallback(async () => {
    if (!wallet || !token) return
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/v1/privacy/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address: wallet, limit: 100 }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setPrivacyData(json.data)
      setPrivacyError(null)
    } catch (err) {
      setPrivacyError(err instanceof Error ? err.message : 'Failed to fetch privacy score')
    }
  }, [wallet, token])

  useEffect(() => {
    if (wallet && token) fetchPrivacyScore()
  }, [wallet, token, fetchPrivacyScore])

  useEffect(() => {
    if (!wallet || !token) return
    const fundMoverPattern = /^(send|swap|claim|refund|deposit)\.(success|completed)$/
    const recent = events.find((e) => fundMoverPattern.test(e.type ?? ''))
    if (!recent) return
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => fetchPrivacyScore(), 5000)
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, [events, wallet, token, fetchPrivacyScore])

  useEffect(() => {
    if (!token) return

    apiFetch<VaultData>('/api/vault', { token }).then(setVault).catch(() => {})
    apiFetch<HealthData>('/api/health', { token }).then(setHealth).catch(() => {})
    apiFetch<{ activity: ActivityRecord[] }>('/api/activity', { token })
      .then((data) => {
        setHistory(
          (data.activity ?? []).map((a: ActivityRecord) => ({
            id: a.id,
            agent: a.agent,
            type: a.type,
            level: a.level,
            data: parseDetail(a.detail),
            timestamp: a.created_at,
          }))
        )
      })
      .catch(() => {})

    if (isAdmin) {
      apiFetch<HeraldBudget>('/api/herald', { token }).then(setHeraldBudget).catch(() => {})
    }
  }, [token, isAdmin])

  const solBalance = vault?.balances?.sol
  const depositCount = history.filter((e) => e.type?.includes('deposit')).length
  const allEvents = [
    ...events.map(e => ({ ...e, isLive: true })),
    ...history.map(e => ({ ...e, isLive: false })),
  ].slice(0, 30)

  const budgetSpent = heraldBudget?.budget?.spent
  const budgetLimit = heraldBudget?.budget?.limit

  return (
    <div data-testid="dashboard-view" className="flex flex-col gap-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="SOL Balance"
          value={solBalance != null ? formatSOL(solBalance) : '—'}
          sub="SOL"
          icon={<Wallet size={16} />}
        />
        {(() => {
          const grade = privacyData?.grade
          const colorByGrade: Record<string, string> = {
            A: '#22c55e', B: '#84cc16', C: '#facc15', D: '#fb923c', F: '#ef4444',
          }
          const factors = privacyData
            ? [
                { label: 'Address reuse', score: privacyData.factors.addressReuse.score },
                { label: 'Amount patterns', score: privacyData.factors.amountPatterns.score },
                { label: 'Timing correlation', score: privacyData.factors.timingCorrelation.score },
                { label: 'Counterparty exposure', score: privacyData.factors.counterpartyExposure.score },
              ]
            : undefined
          return (
            <div className="lg:col-span-2">
              <MetricCard
                variant="hero"
                label={`Privacy Score${grade ? ` · ${grade}` : ''}`}
                value={privacyData ? String(privacyData.score) : (privacyError ? '—' : '—')}
                sub="/100"
                icon={<ShieldCheck size={16} />}
                color={grade ? colorByGrade[grade] : undefined}
                factors={factors}
                onClick={() => privacyData && seedChat(`Why is my privacy score ${privacyData.score}?`)}
              />
            </div>
          )
        })()}
        <MetricCard
          label="Deposits"
          value={depositCount.toString()}
          sub="total"
          icon={<ArrowDown size={16} />}
        />
        <AdminOnly>
          <MetricCard
            label="Budget"
            value={budgetSpent != null ? `$${budgetSpent.toFixed(0)}` : '—'}
            sub={budgetLimit != null ? `/ $${budgetLimit}` : ''}
            icon={<Lightning size={16} />}
          />
        </AdminOnly>
      </div>

      {/* Two columns: Activity + Agent Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Stream */}
        <div className={isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <h3 className="text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-3 px-1">
            Activity Stream
          </h3>
          {allEvents.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <p className="text-text-muted text-sm">No activity yet.</p>
              <p className="text-text-dim text-xs mt-1">
                Connect your wallet to start monitoring.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {allEvents.map((event) => (
                <ActivityEntry
                  key={event.id}
                  agent={event.agent as AgentName}
                  type={event.type}
                  title={
                    (event.data?.title as string) ??
                    (event.data?.message as string) ??
                    event.type
                  }
                  detail={event.data?.detail as string}
                  time={event.timestamp}
                  level={event.level}
                  isLive={event.isLive}
                />
              ))}
            </div>
          )}
        </div>

        {/* Guardian Squad (admin only) */}
        <AdminOnly>
          <div>
            <h3 className="text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-3 px-1">
              Guardian Squad
            </h3>
            <div className="flex flex-col gap-2">
              {(Object.keys(AGENTS) as AgentName[]).map((id) => {
                const agent = AGENTS[id]
                return (
                  <div
                    key={id}
                    className="bg-card border border-border rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <AgentDot agent={id} size={6} />
                      <span
                        className="text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: agent.color }}
                      >
                        {agent.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-green font-mono">online</span>
                  </div>
                )
              })}
            </div>
            {health && (
              <p className="text-text-dim text-[10px] font-mono mt-2 px-1">
                Uptime: {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m
                · {health.tools.length} tools · {health.activeSessions} sessions
              </p>
            )}
          </div>
        </AdminOnly>
      </div>
    </div>
  )
}
