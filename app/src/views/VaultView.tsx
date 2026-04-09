import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { timeAgo, truncateAddress } from '../lib/format'

// ── Types ────────────────────────────────────────────────────────────────────

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
  // TODO: Vault API should be extended to return balance, usd, pending_ops, and fees
  balance?: string
  usd?: string
  fees?: string
  pending_ops?: Array<{ id: string; label: string; detail: string; nextExecSec: number }>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function classifyActivity(row: ActivityRow): {
  icon: string
  iconColor: string
  label: string
  statusLabel: string
  statusColor: string
} {
  const t = row.type?.toLowerCase() ?? ''
  const title = row.title?.toLowerCase() ?? ''

  if (t.includes('refund') || title.includes('refund')) {
    return {
      icon: 'ph-arrow-u-up-left',
      iconColor: 'text-[#8B5CF6]',
      label: 'Refund',
      statusLabel: 'Auto-refund',
      statusColor: 'text-[#8B5CF6]',
    }
  }
  if (t.includes('deposit') || title.includes('deposit')) {
    return {
      icon: 'ph-arrow-down',
      iconColor: 'text-[#10B981]',
      label: 'Deposit',
      statusLabel: 'Confirmed',
      statusColor: 'text-[#10B981]',
    }
  }
  if (t.includes('withdraw') || title.includes('withdraw')) {
    return {
      icon: 'ph-arrow-up',
      iconColor: 'text-[#F5F5F5]',
      label: 'Withdraw',
      statusLabel: 'Stealth',
      statusColor: 'text-[#71717A]',
      isStealth: true,
    } as any
  }
  if (t.includes('send') || title.includes('send')) {
    return {
      icon: 'ph-arrow-up-right',
      iconColor: 'text-[#F5F5F5]',
      label: 'Send',
      statusLabel: 'Stealth',
      statusColor: 'text-[#71717A]',
      isStealth: true,
    } as any
  }
  if (t.includes('swap') || title.includes('swap')) {
    return {
      icon: 'ph-arrows-left-right',
      iconColor: 'text-[#3B82F6]',
      label: 'Swap',
      statusLabel: 'Confirmed',
      statusColor: 'text-[#10B981]',
    }
  }
  return {
    icon: 'ph-arrow-right',
    iconColor: 'text-[#71717A]',
    label: row.type ?? 'Action',
    statusLabel: 'Done',
    statusColor: 'text-[#71717A]',
  }
}

// Extract SOL amount from title or detail if present
function extractAmount(row: ActivityRow): string {
  const text = `${row.title ?? ''} ${row.detail ?? ''}`
  const match = text.match(/([\d.]+)\s*SOL/i)
  return match ? `${match[1]} SOL` : ''
}

// Compute human-readable "Next:" from next_exec unix seconds
function nextIn(nextExecSec: number): string {
  const diffMs = nextExecSec * 1000 - Date.now()
  if (diffMs <= 0) return 'now'
  const diffH = Math.floor(diffMs / 3600000)
  if (diffH < 24) return `${diffH}h`
  return `${Math.floor(diffH / 24)}d`
}

// ── Mock data ─────────────────────────────────────────────────────────────────
// Used when vault API doesn't return these fields yet.

const MOCK_BALANCE = '12.45'
const MOCK_USD = '$2,614.50'
const MOCK_FEES = '0.062'

const MOCK_PENDING = [
  { id: 'p1', label: 'Drip', detail: '0.1 SOL/day → stealth', nextExecSec: Date.now() / 1000 + 6 * 3600 },
  { id: 'p2', label: 'Recurring', detail: '1 SOL weekly → 7xKz...', nextExecSec: Date.now() / 1000 + 3 * 86400 },
]

const MOCK_ACTIVITY: ActivityRow[] = [
  { id: 'm1', agent: 'sipher', type: 'deposit', level: 'info', title: '2.0 SOL', created_at: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: 'm2', agent: 'sipher', type: 'withdraw', level: 'info', title: '0.5 SOL', created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'm3', agent: 'sipher', type: 'deposit', level: 'info', title: '10.0 SOL', created_at: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: 'm4', agent: 'courier', type: 'refund', level: 'info', title: '1.0 SOL', created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function VaultView({ token }: { token: string | null }) {
  const [data, setData] = useState<VaultData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setLoadError(false)
    apiFetch<VaultData>('/api/vault', { token })
      .then(setData)
      .catch(() => { setLoadError(true) })
      .finally(() => setLoading(false))
  }, [token])

  // Only use mock data when API explicitly provides these fields
  const balance = data?.balance ?? null
  const usd = data?.usd ?? null
  const fees = data?.fees ?? null
  const pendingOps = data?.pending_ops ?? []
  const activity = data?.activity?.length ? data.activity : MOCK_ACTIVITY
  const wallet = data?.wallet ?? null

  // Derive fee display from real activity if possible (count fee events)
  const realFeeCount = data?.activity?.length
    ? data.activity.filter(a => a.type?.includes('fee') || a.agent === 'fee').length
    : null

  return (
    <div className="flex flex-col gap-6 pb-2">

      {loadError && (
        <div className="text-[#71717A] text-xs font-mono bg-[#141416] border border-[#1E1E22] rounded-lg px-3 py-2">
          Could not load vault data
        </div>
      )}

      {/* ── Balance Card ───────────────────────────────────────────────────── */}
      <section className="bg-[#141416] border border-[#1E1E22] rounded-lg p-5">
        <h2 className="text-[11px] font-semibold text-[#71717A] tracking-widest uppercase mb-4">
          Vault Balance
        </h2>
        <div className="flex items-baseline gap-3 mb-5">
          <span className="text-[32px] font-mono font-bold text-[#F5F5F5] tracking-tight">
            {balance !== null ? `${balance} SOL` : '\u2014 SOL'}
          </span>
          <span className="text-sm font-mono text-[#71717A]">{usd !== null ? `\u2248 ${usd}` : '\u2248 \u2014'}</span>
        </div>
        {wallet && (
          <p className="font-mono text-[11px] text-[#71717A] mb-4">
            {truncateAddress(wallet, 6)}
          </p>
        )}
        <div className="flex gap-3">
          <button className="flex-1 border border-[#10B981] text-[#10B981] py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-[#10B981]/10 transition-colors flex justify-center items-center gap-2">
            <i className="ph ph-arrow-down-left" />
            Deposit
          </button>
          <button className="flex-1 border border-[#1E1E22] text-[#F5F5F5] py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-[#1E1E22] transition-colors flex justify-center items-center gap-2">
            <i className="ph ph-mask-happy" />
            Withdraw Privately
          </button>
        </div>
      </section>

      {/* ── Pending Operations ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h3 className="text-[10px] font-semibold text-[#71717A] tracking-widest uppercase px-1">
          Pending Operations
        </h3>
        {loading ? (
          <div className="bg-[#141416] border border-[#1E1E22] rounded-lg p-3.5">
            <span className="text-[#71717A] text-xs font-mono">Loading...</span>
          </div>
        ) : pendingOps.length === 0 ? (
          <div className="bg-[#141416] border border-[#1E1E22] rounded-lg p-3.5">
            <span className="text-[#71717A] text-xs font-mono">No pending operations</span>
          </div>
        ) : (
          pendingOps.map(op => (
            <div
              key={op.id}
              className="bg-[#141416] border border-[#1E1E22] rounded-lg p-3.5 flex justify-between items-center"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#8B5CF6] shrink-0" />
                <span className="font-mono text-sm text-[#F5F5F5]">
                  {op.label}:{' '}
                  <span className="text-[#71717A]">{op.detail}</span>
                </span>
              </div>
              <span className="font-mono text-xs text-[#71717A] shrink-0 ml-4">
                Next: {nextIn(op.nextExecSec)}
              </span>
            </div>
          ))
        )}
      </section>

      {/* ── Recent Activity ────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h3 className="text-[10px] font-semibold text-[#71717A] tracking-widest uppercase px-1">
          Recent Activity
        </h3>
        <div className="border border-[#1E1E22] bg-[#141416] rounded-lg flex flex-col font-mono text-sm overflow-hidden">
          {activity.map((row, i) => {
            const cls = classifyActivity(row)
            const isStealth = (cls as any).isStealth === true
            const amount = extractAmount(row)
            const isLast = i === activity.length - 1

            return (
              <div
                key={row.id}
                className={[
                  'flex items-center justify-between p-3',
                  !isLast ? 'border-b border-[#1E1E22]' : '',
                ].join(' ')}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <i className={`ph ${cls.icon} ${cls.iconColor} shrink-0`} />
                  <span className="text-[#71717A]">{cls.label}</span>
                  {amount && (
                    <span className="text-[#F5F5F5] font-medium truncate">{amount}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-[#71717A] text-xs">{timeAgo(row.created_at)}</span>
                  {isStealth ? (
                    <span className="text-[#71717A] text-xs flex items-center gap-1">
                      Stealth <i className="ph-fill ph-check-circle text-[#F5F5F5]" />
                    </span>
                  ) : (
                    <span className={`${cls.statusColor} text-xs`}>{cls.statusLabel}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Fee Summary ────────────────────────────────────────────────────── */}
      <div className="text-center pb-1">
        <p className="text-xs font-mono text-[#71717A]/60">
          Fees collected:{' '}
          {realFeeCount !== null ? `${realFeeCount} events` : fees !== null ? `${fees} SOL` : '\u2014 SOL'}{' '}
          (10 bps)
        </p>
      </div>

    </div>
  )
}
