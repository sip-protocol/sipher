import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { AGENTS, type AgentName } from '../lib/agents'
import { WarningOctagon, ArrowRight, Power } from '@phosphor-icons/react'
import AgentDot from '../components/AgentDot'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentStatus {
  id: AgentName
  statusText: string
  cost?: number | null
}

interface TodayStats {
  toolCalls: number
  walletSessions: number
  xPosts: number
  xReplies: number
  blocksScanned: number
  alerts: number
}

interface CoordEntry {
  id: string
  timestamp: string
  from: AgentName
  to: AgentName
  description: string
  codeSpan?: string
}

interface SquadRaw {
  agents: AgentStatus[] | Record<string, { status?: string }>
  stats?: TodayStats
  costs?: Record<string, number>
  coordination?: CoordEntry[]
  events?: CoordEntry[]
  killSwitch?: boolean
}

interface SquadData {
  agents: AgentStatus[]
  stats: TodayStats
  coordination: CoordEntry[]
  killSwitch: boolean
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_STATS: TodayStats = {
  toolCalls: 0,
  walletSessions: 0,
  xPosts: 0,
  xReplies: 0,
  blocksScanned: 0,
  alerts: 0,
}

// ── Normalize backend → frontend ──────────────────────────────────────────────

function normalizeSquadData(raw: SquadRaw): SquadData {
  const agents: AgentStatus[] = Array.isArray(raw.agents)
    ? raw.agents
    : Object.entries(raw.agents ?? {}).map(([id, info]) => ({
        id: id as AgentName,
        statusText: info.status ?? 'unknown',
        cost: null,
      }))

  return {
    agents,
    stats: raw.stats ?? DEFAULT_STATS,
    coordination: raw.coordination ?? raw.events ?? [],
    killSwitch: raw.killSwitch ?? false,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AgentGrid({ agents }: { agents: AgentStatus[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {agents.map((a) => {
        const agent = AGENTS[a.id]
        if (!agent) return null
        return (
          <div key={a.id} className="bg-card border border-border rounded-lg p-3 flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <AgentDot agent={a.id} size={6} />
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: agent.color }}>
                  {agent.name}
                </span>
              </div>
              <span className="text-[10px] font-mono text-text-muted">
                {a.cost != null ? `$${a.cost.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className="text-[11px] text-text-muted">{a.statusText}</div>
          </div>
        )
      })}
    </div>
  )
}

function StatsGrid({ stats }: { stats: TodayStats }) {
  const items = [
    { value: stats.toolCalls.toLocaleString(), label: 'Tool calls' },
    { value: stats.walletSessions.toLocaleString(), label: 'Wallet sessions' },
    { value: stats.xPosts.toLocaleString(), label: 'X posts' },
    { value: stats.xReplies.toLocaleString(), label: 'X replies' },
    { value: stats.blocksScanned.toLocaleString(), label: 'Blocks scanned' },
    { value: stats.alerts.toLocaleString(), label: 'Alerts' },
  ]

  return (
    <section>
      <h3 className="text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-3 px-1">
        Today's Stats
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {items.map(({ value, label }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-3">
            <div className="text-[22px] font-mono font-medium text-text leading-none mb-1">{value}</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wide">{label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function CoordLog({ entries }: { entries: CoordEntry[] }) {
  if (entries.length === 0) return null

  return (
    <section>
      <h3 className="text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-3 px-1">
        Coordination (last 24h)
      </h3>
      <div className="flex flex-col gap-4">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-4">
            <div className="text-[11px] font-mono text-text-muted pt-[1px] w-[38px] shrink-0">
              {entry.timestamp}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted uppercase tracking-wider">
                <AgentDot agent={entry.from} size={5} />
                <span>{AGENTS[entry.from]?.name ?? entry.from}</span>
                <ArrowRight size={9} />
                <AgentDot agent={entry.to} size={5} />
                <span>{AGENTS[entry.to]?.name ?? entry.to}</span>
              </div>
              <div className="text-[13px] text-text">
                {entry.codeSpan ? (
                  <>
                    {entry.description.split('  ')[0]}
                    <span className="font-mono text-[12px] bg-elevated px-1 py-0.5 rounded border border-border">
                      {entry.codeSpan}
                    </span>
                    {entry.description.split('  ')[1]}
                  </>
                ) : (
                  entry.description
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function KillSwitch({ token, active, onToggle }: { token: string | null; active: boolean; onToggle: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleToggle = async () => {
    if (!token || busy) return
    setBusy(true)
    setError(null)
    try {
      await apiFetch('/api/squad/kill', { method: 'POST', token })
      onToggle()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={handleToggle}
        disabled={busy || !token}
        className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 border rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          active
            ? 'border-green/30 text-green hover:bg-green/10'
            : 'border-red/30 text-red hover:bg-red/10 hover:border-red'
        }`}
      >
        {active ? <Power size={18} /> : <WarningOctagon size={18} />}
        <span className="text-sm font-semibold tracking-wide">
          {busy ? (active ? 'Resuming...' : 'Pausing...') : active ? 'Resume Operations' : 'Pause All Vault Ops'}
        </span>
      </button>
      {error && (
        <div className="mt-2 text-red text-xs font-mono bg-red/10 border border-red/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function SquadView({ token }: { token: string | null }) {
  const [data, setData] = useState<SquadData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!token) return
    setError(null)
    apiFetch<SquadRaw>('/api/squad', { token })
      .then((raw) => setData(normalizeSquadData(raw)))
      .catch((err: Error) => setError(err.message))
  }, [token])

  useEffect(() => { load() }, [load])

  if (!data && !error) {
    return <div className="text-text-muted text-sm text-center py-20">Loading squad data...</div>
  }

  return (
    <div data-testid="squad-view" className="flex flex-col gap-6">
      {error && (
        <div className="text-text-muted text-xs font-mono bg-card border border-border rounded-lg px-3 py-2">
          Live data unavailable — {error}
        </div>
      )}
      {data && (
        <>
          <AgentGrid agents={data.agents} />
          <StatsGrid stats={data.stats} />
          <CoordLog entries={data.coordination} />
          <KillSwitch
            token={token}
            active={data.killSwitch}
            onToggle={() => setData((d) => d ? { ...d, killSwitch: !d.killSwitch } : d)}
          />
        </>
      )}
    </div>
  )
}
