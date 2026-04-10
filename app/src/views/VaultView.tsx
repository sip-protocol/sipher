import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { timeAgo, truncateAddress, formatSOL } from '../lib/format'
import {
  ArrowDownLeft,
  MaskHappy,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ArrowsLeftRight,
  ArrowRight,
  ArrowUUpLeft,
  CheckCircle,
  Binoculars,
} from '@phosphor-icons/react'

interface TokenBalance {
  mint: string
  symbol: string
  amount: string
  decimals: number
  uiAmount: number
}

interface ActivityRow {
  id: string
  agent: string
  type: string
  level: string
  title: string
  detail?: string
  wallet?: string
  created_at: string
}

interface VaultData {
  wallet: string
  activity: ActivityRow[]
  balances: {
    sol: number
    tokens: TokenBalance[]
    status: string
  }
}

function classifyActivity(row: ActivityRow) {
  const t = row.type?.toLowerCase() ?? ''
  const title = row.title?.toLowerCase() ?? ''

  if (t.includes('refund') || title.includes('refund'))
    return { Icon: ArrowUUpLeft, iconColor: 'text-courier', label: 'Refund', statusLabel: 'Auto-refund', statusColor: 'text-courier', isStealth: false }
  if (t.includes('deposit') || title.includes('deposit'))
    return { Icon: ArrowDown, iconColor: 'text-green', label: 'Deposit', statusLabel: 'Confirmed', statusColor: 'text-green', isStealth: false }
  if (t.includes('withdraw') || title.includes('withdraw'))
    return { Icon: ArrowUp, iconColor: 'text-text', label: 'Withdraw', statusLabel: 'Stealth', statusColor: 'text-text-muted', isStealth: true }
  if (t.includes('send') || title.includes('send'))
    return { Icon: ArrowUpRight, iconColor: 'text-text', label: 'Send', statusLabel: 'Stealth', statusColor: 'text-text-muted', isStealth: true }
  if (t.includes('swap') || title.includes('swap'))
    return { Icon: ArrowsLeftRight, iconColor: 'text-herald', label: 'Swap', statusLabel: 'Confirmed', statusColor: 'text-green', isStealth: false }
  return { Icon: ArrowRight, iconColor: 'text-text-muted', label: row.type ?? 'Action', statusLabel: 'Done', statusColor: 'text-text-muted', isStealth: false }
}

function extractAmount(row: ActivityRow): string {
  const text = `${row.title ?? ''} ${row.detail ?? ''}`
  const match = text.match(/([\d.]+)\s*SOL/i)
  return match ? `${match[1]} SOL` : ''
}

export default function VaultView({ token }: { token: string | null }) {
  const [data, setData] = useState<VaultData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError(false)
    apiFetch<VaultData>('/api/vault', { token })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [token])

  const sol = data?.balances?.sol
  const tokens = data?.balances?.tokens ?? []
  const activity = data?.activity ?? []
  const wallet = data?.wallet

  return (
    <div className="flex flex-col gap-6 pb-2">
      {error && (
        <div className="text-text-muted text-xs font-mono bg-card border border-border rounded-lg px-3 py-2">
          Could not load vault data
        </div>
      )}

      {/* Balance Card */}
      <section className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-[11px] font-semibold text-text-muted tracking-widest uppercase mb-4">
          Vault Balance
        </h2>
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-[32px] font-mono font-bold text-text tracking-tight">
            {sol != null ? formatSOL(sol) : '—'}
          </span>
          <span className="text-sm font-mono text-text-muted">SOL</span>
        </div>
        {tokens.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tokens.map((t) => (
              <span
                key={t.mint}
                className="text-[11px] font-mono text-text-secondary bg-elevated px-2 py-0.5 rounded"
              >
                {t.uiAmount.toLocaleString()} {t.symbol}
              </span>
            ))}
          </div>
        )}
        {wallet && (
          <p className="font-mono text-[11px] text-text-dim mb-4">
            {truncateAddress(wallet, 6)}
          </p>
        )}
        <div className="flex gap-3">
          <button className="flex-1 border border-green/40 text-green py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-green/10 transition-colors flex justify-center items-center gap-2">
            <ArrowDownLeft size={16} />
            Deposit
          </button>
          <button className="flex-1 border border-border text-text py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-elevated transition-colors flex justify-center items-center gap-2">
            <MaskHappy size={16} />
            Withdraw
          </button>
          <button className="flex-1 border border-border text-text-secondary py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-elevated transition-colors flex justify-center items-center gap-2">
            <Binoculars size={16} />
            Scan
          </button>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="flex flex-col gap-3">
        <h3 className="text-[10px] font-semibold text-text-muted tracking-widest uppercase px-1">
          Recent Activity
        </h3>
        {loading ? (
          <div className="bg-card border border-border rounded-lg p-3.5">
            <span className="text-text-muted text-xs font-mono">Loading...</span>
          </div>
        ) : activity.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-3.5">
            <span className="text-text-muted text-xs font-mono">No activity yet</span>
          </div>
        ) : (
          <div className="border border-border bg-card rounded-lg flex flex-col font-mono text-sm overflow-hidden">
            {activity.map((row, i) => {
              const cls = classifyActivity(row)
              const amount = extractAmount(row)
              const isLast = i === activity.length - 1

              return (
                <div
                  key={row.id}
                  className={`flex items-center justify-between p-3 ${!isLast ? 'border-b border-border' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <cls.Icon size={14} className={`${cls.iconColor} shrink-0`} />
                    <span className="text-text-muted">{cls.label}</span>
                    {amount && (
                      <span className="text-text font-medium truncate">{amount}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-text-muted text-xs">{timeAgo(row.created_at)}</span>
                    {cls.isStealth ? (
                      <span className="text-text-muted text-xs flex items-center gap-1">
                        Stealth <CheckCircle size={12} weight="fill" className="text-text" />
                      </span>
                    ) : (
                      <span className={`${cls.statusColor} text-xs`}>{cls.statusLabel}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
