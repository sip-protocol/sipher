import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api/client'
import { type ActivityEvent } from '../hooks/useSSE'
import { useAuthState } from '../hooks/useAuthState'
import { useOnAuthClear } from '../store/useOnAuthClear'
import { PrivacyScoreCard } from '../components/PrivacyScoreCard'
import { ActivityStreamTable, type ActivityRow } from '../components/ActivityStreamTable'
import { PrivacyGraph } from '../components/PrivacyGraph'
import { ShieldedVolumeCard } from '../components/ShieldedVolumeCard'
import { MultiChainVaultGrid } from '../components/MultiChainVaultGrid'

interface VaultData {
  wallet: string
  balances: { sol: number; tokens: unknown[]; status: string }
}

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

export default function DashboardView({ events }: { events: ActivityEvent[] }) {
  const { token } = useAuthState()
  const [vault, setVault] = useState<VaultData | null>(null)
  const [history, setHistory] = useState<ActivityRow[]>([])
  const [privacyData, setPrivacyData] = useState<PrivacyData | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastProcessedEventId = useRef<string | null>(null)
  const wallet = vault?.wallet

  useOnAuthClear(() => {
    setVault(null)
    setHistory([])
    setPrivacyData(null)
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current)
      refreshTimer.current = null
    }
    lastProcessedEventId.current = null
  })

  const fetchPrivacyScore = useCallback(async (signal?: AbortSignal) => {
    if (!wallet || !token) return
    try {
      const json = await apiFetch<{ data: PrivacyData }>('/v1/privacy/score', {
        method: 'POST',
        token,
        body: JSON.stringify({ address: wallet, limit: 100 }),
        signal,
      })
      setPrivacyData(json.data)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      // network / API errors fall through to the null-data state on PrivacyScoreCard
    }
  }, [wallet, token])

  useEffect(() => {
    if (!wallet || !token) return
    const controller = new AbortController()
    fetchPrivacyScore(controller.signal)
    return () => controller.abort()
  }, [wallet, token, fetchPrivacyScore])

  useEffect(() => {
    if (!wallet || !token) return
    const fundMoverPattern = /^(send|swap|claim|refund|deposit)\.(success|completed)$/
    const recent = events.find((e) => fundMoverPattern.test(e.type ?? ''))
    if (!recent || recent.id === lastProcessedEventId.current) return
    lastProcessedEventId.current = recent.id
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => fetchPrivacyScore(), 5000)
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, [events, wallet, token, fetchPrivacyScore])

  useEffect(() => {
    if (!token) return
    apiFetch<VaultData>('/api/vault', { token }).then(setVault).catch(() => {})
    apiFetch<{ activity: ActivityRecord[] }>('/api/activity', { token })
      .then((data) => {
        setHistory(
          (data.activity ?? []).map((a: ActivityRecord): ActivityRow => ({
            id: a.id,
            agent: a.agent,
            type: a.type,
            level: a.level,
            data: parseDetail(a.detail),
            timestamp: a.created_at,
          })),
        )
      })
      .catch(() => {})
  }, [token])

  const allRows: ActivityRow[] = [
    ...events.map((e): ActivityRow => ({
      id: e.id,
      agent: e.agent,
      type: e.type,
      level: e.level,
      timestamp: e.timestamp,
      data: e.data ?? {},
    })),
    ...history,
  ].slice(0, 30)

  return (
    <div data-testid="dashboard-view" className="space-y-6 p-6">
      <PrivacyGraph />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PrivacyScoreCard data={privacyData} delta={4} />
        </div>
        <div>
          <ShieldedVolumeCard />
        </div>
      </div>

      <MultiChainVaultGrid />

      <ActivityStreamTable rows={allRows} />
    </div>
  )
}
