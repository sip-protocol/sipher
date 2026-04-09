import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '../api/client'
import { timeAgo } from '../lib/format'

type Tab = 'activity' | 'queue' | 'dms'

interface BudgetInfo {
  spent: number
  limit: number
  gate: string
  percentage: number
}

interface ActivityEntry {
  id: string
  type: 'posted' | 'replied' | 'liked' | 'dm_handled'
  timestamp: string
  content?: string
  replyTo?: string
  engagement?: { likes: number, retweets: number, replies: number }
  action?: string
  tweetUrl?: string
}

interface QueueItem {
  id: string
  content: string
  scheduled_at?: string
  status?: string
}

interface DmEntry {
  id: string
  x_user_id?: string
  username?: string
  text?: string
  preview?: string
  intent?: string
  tool?: string
  response?: string
  resolution?: string
  action?: string
  created_at?: string
}

interface HeraldData {
  queue: QueueItem[]
  budget: BudgetInfo
  dms: DmEntry[]
  recentPosts: ActivityEntry[]
}

function BudgetBar({ budget }: { budget: BudgetInfo }) {
  const pct = Math.min(budget.percentage ?? (budget.spent / budget.limit) * 100, 100)
  const barColor =
    pct >= 95 ? 'bg-red-500' :
    pct >= 80 ? 'bg-[#F59E0B]' :
    'bg-[#10B981]'

  return (
    <div className="px-4 py-3 border-b border-[#1E1E22] shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-[#71717A] font-medium uppercase tracking-wider">X API Budget</span>
        <div className="font-mono text-xs">
          <span className="text-[#F5F5F5]">${budget.spent.toFixed(2)}</span>
          <span className="text-[#71717A]"> / ${budget.limit}</span>
        </div>
      </div>
      <div className="w-full h-1 bg-[#141416] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function SubTabs({ active, onChange }: { active: Tab, onChange: (t: Tab) => void }) {
  const tabs: { id: Tab, label: string }[] = [
    { id: 'activity', label: 'Activity' },
    { id: 'queue', label: 'Queue' },
    { id: 'dms', label: 'DMs' },
  ]
  return (
    <div className="flex px-4 border-b border-[#1E1E22] shrink-0">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-3 text-sm relative transition-colors ${active === t.id ? 'text-[#F5F5F5] font-medium' : 'text-[#71717A]'}`}
        >
          {t.label}
          {active === t.id && (
            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#3B82F6]" />
          )}
        </button>
      ))}
    </div>
  )
}

function ActivityTimeline({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-[#71717A] text-sm text-center py-10">No recent activity.</div>
    )
  }

  return (
    <div className="relative pl-4">
      <div className="absolute left-[3px] top-2 bottom-4 w-px bg-[#1E1E22]" />

      {entries.map((entry, i) => (
        <div key={entry.id} className={`flex gap-3 relative ${i < entries.length - 1 ? 'mb-6' : ''}`}>
          <div className="w-2 h-2 rounded-full bg-[#3B82F6] mt-1.5 relative z-10 ring-4 ring-[#0A0A0B] shrink-0" />

          <div className="flex-1 min-w-0">
            {entry.type === 'posted' && (
              <>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-medium text-[#F5F5F5]">Posted</span>
                  <span className="font-mono text-[10px] text-[#71717A]">{timeAgo(entry.timestamp)}</span>
                </div>
                <div className="bg-[#141416] border border-[#1E1E22] rounded-lg p-3 flex flex-col gap-2">
                  <p className="text-sm text-gray-300">{entry.content}</p>
                  {(entry.engagement || entry.tweetUrl) && (
                    <div className="flex items-center justify-between border-t border-[#1E1E22] pt-2 mt-1">
                      {entry.engagement && (
                        <div className="flex items-center gap-3 font-mono text-[10px] text-[#71717A]">
                          <span>♥ {entry.engagement.likes}</span>
                          <span>⇄ {entry.engagement.retweets}</span>
                          <span>◯ {entry.engagement.replies}</span>
                        </div>
                      )}
                      {entry.tweetUrl && (
                        <a
                          href={entry.tweetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-mono text-[#71717A] border border-[#1E1E22] px-2 py-1 rounded bg-[#0A0A0B] flex items-center gap-1 hover:text-[#F5F5F5] transition-colors"
                        >
                          View on X ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {entry.type === 'replied' && (
              <>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-medium text-[#F5F5F5]">Replied to</span>
                  {entry.replyTo && (
                    <span className="font-mono text-[10px] text-[#3B82F6]">@{entry.replyTo}</span>
                  )}
                  <span className="font-mono text-[10px] text-[#71717A]">{timeAgo(entry.timestamp)}</span>
                </div>
                <div className="bg-[#141416] border border-[#1E1E22] rounded-lg p-3">
                  {entry.content && (
                    <div className="pl-2.5 border-l-2 border-[#1E1E22]">
                      <p className="text-[13px] text-gray-400 italic">{entry.content}</p>
                    </div>
                  )}
                  {entry.tweetUrl && (
                    <div className="flex justify-end mt-2">
                      <a
                        href={entry.tweetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-[#71717A] border border-[#1E1E22] px-2 py-1 rounded bg-[#0A0A0B] flex items-center gap-1 hover:text-[#F5F5F5] transition-colors"
                      >
                        View on X ↗
                      </a>
                    </div>
                  )}
                </div>
              </>
            )}

            {entry.type === 'liked' && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-[#F5F5F5]">Liked</span>
                  <span className="font-mono text-[10px] text-[#71717A]">{timeAgo(entry.timestamp)}</span>
                </div>
                <p className="text-sm text-gray-400">
                  <span className="text-gray-500">♥</span>{' '}
                  Liked{entry.replyTo ? <> <span className="font-mono text-xs text-[#F5F5F5]">@{entry.replyTo}</span>'s post</> : ' a post'}
                  {entry.content ? ` about ${entry.content}` : ''}
                </p>
              </>
            )}

            {entry.type === 'dm_handled' && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-[#F5F5F5]">DM Handled</span>
                  <span className="font-mono text-[10px] text-[#71717A]">{timeAgo(entry.timestamp)}</span>
                </div>
                <div className="bg-[#141416] border border-[#1E1E22] border-dashed rounded-lg p-3">
                  {entry.replyTo && (
                    <><span className="font-mono text-xs text-[#3B82F6]">@{entry.replyTo}:</span>{' '}</>
                  )}
                  <span className="text-sm text-gray-400">{entry.content}</span>
                  {entry.action && (
                    <div className="flex items-center gap-1.5 text-[11px] text-[#71717A] mt-2">
                      → {entry.action}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function QueueTab({
  items,
  onAction,
}: {
  items: QueueItem[]
  onAction: (id: string, action: 'approve' | 'reject') => Promise<void>
}) {
  const [pending, setPending] = useState<Record<string, boolean>>({})

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setPending(p => ({ ...p, [id]: true }))
    try {
      await onAction(id, action)
    } finally {
      setPending(p => ({ ...p, [id]: false }))
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-[#71717A] text-sm text-center py-10">No pending posts.</div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map(item => (
        <div key={item.id} className="bg-[#141416] border border-[#1E1E22] rounded-lg p-4 flex flex-col gap-3">
          <p className="text-sm text-gray-200">{item.content}</p>
          <div className="flex items-center gap-2 font-mono text-[10px] text-[#71717A]">
            <span>📅</span>
            <span>{item.scheduled_at ?? '—'}</span>
          </div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => handleAction(item.id, 'approve')}
              disabled={pending[item.id]}
              className="flex-1 text-[11px] border border-emerald-500/50 text-emerald-400 bg-emerald-500/10 py-1.5 rounded-lg font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending[item.id] ? '...' : 'Approve'}
            </button>
            <button
              disabled={pending[item.id]}
              className="px-4 text-[11px] border border-[#1E1E22] text-gray-300 bg-[#0A0A0B] py-1.5 rounded-lg hover:bg-[#1E1E22] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Edit
            </button>
            <button
              onClick={() => handleAction(item.id, 'reject')}
              disabled={pending[item.id]}
              className="px-3 border border-[#1E1E22] text-[#71717A] bg-[#0A0A0B] py-1.5 rounded-lg hover:text-red-400 hover:border-red-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Reject"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function DmsTab({ dms }: { dms: DmEntry[] }) {
  if (dms.length === 0) {
    return (
      <div className="text-[#71717A] text-sm text-center py-10">No recent DMs.</div>
    )
  }

  return (
    <div className="bg-[#141416] border border-[#1E1E22] rounded-lg overflow-hidden">
      {dms.map((dm, i) => (
        <div
          key={dm.id}
          className={`flex flex-col p-3 ${i < dms.length - 1 ? 'border-b border-[#1E1E22]/50' : ''}`}
        >
          <div className="flex justify-between mb-1">
            <span className="font-mono text-xs text-[#3B82F6]">@{dm.x_user_id ?? dm.username ?? 'unknown'}</span>
            {dm.resolution === 'resolved' ? (
              <span className="text-[9px] text-green-500 bg-green-900/30 px-1.5 py-0.5 rounded border border-green-900/50">
                Resolved
              </span>
            ) : (
              <span className="text-[9px] text-yellow-500 bg-yellow-900/30 px-1.5 py-0.5 rounded border border-yellow-900/50">
                Actioned
              </span>
            )}
          </div>
          <p className="text-[13px] text-gray-400 mb-1">{dm.text ?? dm.preview ?? ''}</p>
          {dm.action && (
            <div className={`flex items-center gap-1.5 text-[11px] ${dm.resolution === 'resolved' ? 'text-[#71717A]' : 'text-[#3B82F6]'}`}>
              ↳ {dm.action ?? dm.tool}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function HeraldView({ token }: { token: string | null }) {
  const [tab, setTab] = useState<Tab>('activity')
  const [data, setData] = useState<HeraldData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!token) return
    setError(null)
    apiFetch<HeraldData>('/api/herald', { token })
      .then(setData)
      .catch((err: Error) => setError(err.message))
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const handleApprove = async (id: string, action: 'approve' | 'reject') => {
    await apiFetch(`/api/herald/approve/${id}`, {
      method: 'POST',
      body: JSON.stringify({ action }),
      token: token!,
    })
    load()
  }

  if (!token) {
    return (
      <div className="text-[#71717A] text-sm text-center py-20">
        Connect your wallet to view HERALD activity.
      </div>
    )
  }

  const budget = data?.budget ?? { spent: 0, limit: 150, gate: 'open', percentage: 0 }

  return (
    <div className="flex flex-col h-full">
      <BudgetBar budget={budget} />
      <SubTabs active={tab} onChange={setTab} />

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {error && (
          <div className="text-red-400 text-xs font-mono bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        {!data && !error && (
          <div className="text-[#71717A] text-sm text-center py-10">Loading...</div>
        )}

        {data && tab === 'activity' && (
          <ActivityTimeline entries={data.recentPosts ?? []} />
        )}

        {data && tab === 'queue' && (
          <QueueTab items={data.queue ?? []} onAction={handleApprove} />
        )}

        {data && tab === 'dms' && (
          <DmsTab dms={data.dms ?? []} />
        )}
      </div>
    </div>
  )
}
