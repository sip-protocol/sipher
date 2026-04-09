import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { AGENTS, type AgentName } from '../lib/agents'

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

interface SquadData {
  agents: AgentStatus[]
  stats: TodayStats
  coordination: CoordEntry[]
}

// ── Mock fallback ─────────────────────────────────────────────────────────────

const MOCK_DATA: SquadData = {
  agents: [
    { id: 'sipher',   statusText: 'Active · 3 sessions', cost: 2.14 },
    { id: 'herald',   statusText: 'Polling · next: 8m',  cost: 1.87 },
    { id: 'sentinel', statusText: 'Scanning · next: 45s', cost: null },
    { id: 'courier',  statusText: 'Idle · next op: 6h',   cost: null },
  ],
  stats: {
    toolCalls: 47,
    walletSessions: 3,
    xPosts: 2,
    xReplies: 8,
    blocksScanned: 2841,
    alerts: 1,
  },
  coordination: [
    {
      id: 'c1',
      timestamp: '14:32',
      from: 'sentinel',
      to: 'sipher',
      description: 'Unclaimed payment detected, notifying user',
    },
    {
      id: 'c2',
      timestamp: '14:30',
      from: 'herald',
      to: 'sipher',
      description: 'Running  for @dev_0x DM request',
      codeSpan: 'privacyScore',
    },
    {
      id: 'c3',
      timestamp: '11:00',
      from: 'sentinel',
      to: 'courier',
      description: 'Deposit #42 expired, triggering auto-refund',
    },
  ],
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AgentDot({ agent, size = 'md' }: { agent: AgentName; size?: 'sm' | 'md' }) {
  const { color } = AGENTS[agent]
  const dim = size === 'sm' ? 'w-[5px] h-[5px]' : 'w-2 h-2'
  return <div className={`${dim} rounded-full shrink-0`} style={{ backgroundColor: color }} />
}

function AgentGrid({ agents }: { agents: AgentStatus[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {agents.map(a => {
        const agent = AGENTS[a.id]
        const hasCost = a.cost != null
        return (
          <div
            key={a.id}
            className="bg-[#141416] border border-[#1E1E22] rounded-lg p-3 flex flex-col gap-2"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <AgentDot agent={a.id} />
                <span
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: agent.color }}
                >
                  {agent.name}
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#71717A]">
                {hasCost ? `$${a.cost!.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className="text-[11px] text-[#71717A]">{a.statusText}</div>
          </div>
        )
      })}
    </div>
  )
}

function StatsGrid({ stats }: { stats: TodayStats }) {
  const items: { value: string; label: string }[] = [
    { value: stats.toolCalls.toLocaleString(),      label: 'Tool calls' },
    { value: stats.walletSessions.toLocaleString(), label: 'Wallet sessions' },
    { value: stats.xPosts.toLocaleString(),         label: 'X posts' },
    { value: stats.xReplies.toLocaleString(),       label: 'X replies' },
    { value: stats.blocksScanned.toLocaleString(),  label: 'Blocks scanned' },
    { value: stats.alerts.toLocaleString(),         label: 'Alerts' },
  ]

  return (
    <section>
      <h3 className="text-[10px] font-semibold text-[#71717A] tracking-widest uppercase mb-3 px-1">
        Today's Stats
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {items.map(({ value, label }) => (
          <div key={label} className="bg-[#141416] border border-[#1E1E22] rounded-lg p-3">
            <div className="text-[22px] font-mono font-medium text-[#F5F5F5] leading-none mb-1">
              {value}
            </div>
            <div className="text-[10px] text-[#71717A] uppercase tracking-wide">{label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function CoordDescription({ entry }: { entry: CoordEntry }) {
  if (!entry.codeSpan) {
    return <div className="text-[13px] text-[#F5F5F5]">{entry.description}</div>
  }

  // Description has exactly one code span placeholder — split on '  ' (double space sentinel)
  const parts = entry.description.split('  ')
  return (
    <div className="text-[13px] text-[#F5F5F5]">
      {parts[0]}
      <span className="font-mono text-[12px] bg-[#141416] px-1 py-0.5 rounded border border-[#1E1E22]">
        {entry.codeSpan}
      </span>
      {parts[1]}
    </div>
  )
}

function CoordLog({ entries }: { entries: CoordEntry[] }) {
  return (
    <section>
      <h3 className="text-[10px] font-semibold text-[#71717A] tracking-widest uppercase mb-3 px-1">
        Coordination (last 24h)
      </h3>
      <div className="flex flex-col gap-4">
        {entries.map(entry => (
          <div key={entry.id} className="flex items-start gap-4">
            <div className="text-[11px] font-mono text-[#71717A] pt-[1px] w-[38px] shrink-0">
              {entry.timestamp}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#71717A] uppercase tracking-wider">
                <AgentDot agent={entry.from} size="sm" />
                <span>{AGENTS[entry.from].name}</span>
                <i className="ph ph-arrow-right text-[9px]" />
                <AgentDot agent={entry.to} size="sm" />
                <span>{AGENTS[entry.to].name}</span>
              </div>
              <CoordDescription entry={entry} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function KillSwitch({ token }: { token: string | null }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleKill = async () => {
    if (!token || busy) return
    setBusy(true)
    setError(null)
    try {
      await apiFetch('/api/squad/kill', {
        method: 'POST',
        token,
      })
      setDone(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={handleKill}
        disabled={busy || done || !token}
        className="w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-red-500/30 text-red-500 rounded-lg hover:bg-red-500/10 hover:border-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <i className="ph ph-warning-octagon text-lg" />
        <span className="text-sm font-semibold tracking-wide">
          {busy ? 'Pausing...' : done ? 'Vault Ops Paused' : 'Pause All Vault Ops'}
        </span>
      </button>
      {error && (
        <div className="mt-2 text-red-400 text-xs font-mono bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2">
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
    if (!token) {
      setData(MOCK_DATA)
      return
    }
    setError(null)
    apiFetch<SquadData>('/api/squad', { token })
      .then(setData)
      .catch((err: Error) => {
        setError(err.message)
        setData(MOCK_DATA)
      })
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const d = data ?? MOCK_DATA

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="text-[#71717A] text-xs font-mono bg-[#141416] border border-[#1E1E22] rounded-lg px-3 py-2">
          Live data unavailable — showing last known state
        </div>
      )}

      <AgentGrid agents={d.agents} />
      <StatsGrid stats={d.stats} />
      <CoordLog entries={d.coordination} />
      <KillSwitch token={token} />
    </div>
  )
}
