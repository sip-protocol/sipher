import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useAuthState } from '../hooks/useAuthState'
import { PrivacyScoreCard } from '../components/PrivacyScoreCard'
import { ActivityStreamTable, type ActivityRow } from '../components/ActivityStreamTable'
import { PrivacyGraph } from '../components/PrivacyGraph'
import { ShieldedVolumeCard } from '../components/ShieldedVolumeCard'
import { MultiChainVaultGrid } from '../components/MultiChainVaultGrid'

interface DemoVaultData {
  wallet: string
  network: string
  balances: { sol: number; tokens: unknown[]; status: string }
  activity?: Array<Record<string, unknown>>
}

interface DemoPrivacyData {
  address: string
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

interface DemoActivityRecord {
  id: string
  agent: string
  type: string
  level: string
  title: string
  detail?: string | null
  created_at: string
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

function parseDetail(detail: unknown): Record<string, unknown> {
  if (typeof detail === 'string') {
    try { return JSON.parse(detail) }
    catch { return { detail } }
  }
  return (detail as Record<string, unknown>) ?? {}
}

async function fetchDemoJson<T>(path: string, signal: AbortSignal): Promise<T> {
  // Public endpoints — NO Authorization header is included. We use a fresh
  // headers object (not spread from any global default) so a future auth-
  // injecting middleware can't leak the JWT into the demo channel.
  const res = await fetch(`${API_BASE}${path}`, { signal, headers: { 'Content-Type': 'application/json' } })
  if (!res.ok) {
    throw new Error(`Demo API error ${res.status}`)
  }
  return res.json() as Promise<T>
}

/**
 * DemoView — public, read-only "/demo" route that previews the Dashboard
 * populated with data from a real devnet wallet (DEMO_WALLET env on the
 * backend). Banner + Exit/Connect CTAs make the demo identity unmistakable.
 *
 * Hiding the AppShell chrome on /demo is handled in App.tsx via a
 * useLocation()-gated render guard so the demo stays focused and routes
 * cannot leak the user into authed-only views.
 *
 * Auto-redirects to "/" once the auth state transitions to 'authed' so the
 * user lands on their real dashboard the moment they connect.
 */
export default function DemoView() {
  const navigate = useNavigate()
  const { status } = useAuthState()
  const { setVisible } = useWalletModal()
  const [vault, setVault] = useState<DemoVaultData | null>(null)
  const [privacy, setPrivacy] = useState<DemoPrivacyData | null>(null)
  const [history, setHistory] = useState<ActivityRow[]>([])

  useEffect(() => {
    if (status === 'authed') {
      navigate('/')
    }
  }, [status, navigate])

  useEffect(() => {
    const controller = new AbortController()
    fetchDemoJson<DemoVaultData>('/api/public/demo/vault', controller.signal)
      .then((d) => { if (!controller.signal.aborted) setVault(d) })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        // Non-fatal — leave vault null so the cards show their empty states.
      })
    fetchDemoJson<DemoPrivacyData>('/api/public/demo/privacy-score', controller.signal)
      .then((d) => { if (!controller.signal.aborted) setPrivacy(d) })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
      })
    fetchDemoJson<{ activity: DemoActivityRecord[] }>('/api/public/demo/activity', controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setHistory(
          (data.activity ?? []).map((a): ActivityRow => ({
            id: a.id,
            agent: a.agent,
            type: a.type,
            level: a.level,
            data: parseDetail(a.detail),
            timestamp: a.created_at,
          })),
        )
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
      })
    return () => controller.abort()
  }, [])

  // PrivacyScoreCard expects the {data:{score,grade,factors,recommendations,transactionsAnalyzed}}
  // shape — same shape as Mode 2's /v1/privacy/score `data` block. Our demo
  // service returns it flat, so re-shape inline.
  const privacyForCard = privacy
    ? {
        score: privacy.score,
        grade: privacy.grade,
        factors: privacy.factors,
        recommendations: privacy.recommendations,
        transactionsAnalyzed: privacy.transactionsAnalyzed,
      }
    : null

  return (
    <div data-testid="demo-view" className="space-y-6 p-6">
      <title>SIPHER — Demo mode</title>
      <meta name="description" content="Read-only preview of the SIPHER privacy command center on devnet." />

      <div
        data-testid="demo-banner"
        className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        role="status"
        aria-live="polite"
      >
        <div className="text-sm text-text">
          <strong className="font-semibold">Demo mode</strong> — read-only preview using a real devnet wallet.{' '}
          Connect your wallet to use SIPHER for real.
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-xs px-3 py-1.5 rounded-md border border-line text-text-secondary hover:text-text hover:border-line-2 transition-colors"
          >
            Exit demo
          </button>
          <button
            type="button"
            onClick={() => setVisible(true)}
            className="text-xs px-3 py-1.5 rounded-md text-bg font-semibold hover:opacity-90"
            style={{ background: 'linear-gradient(90deg, var(--color-cyan), var(--color-violet))' }}
          >
            Connect wallet
          </button>
        </div>
      </div>

      <PrivacyGraph />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PrivacyScoreCard data={privacyForCard} />
        </div>
        <div>
          <ShieldedVolumeCard />
        </div>
      </div>

      <MultiChainVaultGrid />

      <ActivityStreamTable rows={history} />

      {vault?.balances?.status === 'unavailable' && (
        <p className="text-xs text-text-muted text-center">
          On-chain balances are temporarily unavailable. Snapshot from cache.
        </p>
      )}
    </div>
  )
}
