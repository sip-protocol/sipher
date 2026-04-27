import { useEffect, useState, useCallback } from 'react'
import { Calendar, X as XIcon } from '@phosphor-icons/react'
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
    pct >= 95 ? 'bg-red' :
    pct >= 80 ? 'bg-yellow' :
    'bg-green'

  const gateColor =
    budget.gate === 'open' ? 'text-green' :
    budget.gate === 'limited' ? 'text-yellow' :
    'text-red'

  return (
    <div className="px-4 py-3 border-b border-border shrink-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">X API Budget</span>
          {budget.gate && (
            <span className={`text-[9px] font-mono uppercase ${gateColor}`}>{budget.gate}</span>
          )}
        </div>
        <div className="font-mono text-xs">
          <span className="text-text">${budget.spent.toFixed(2)}</span>
          <span className="text-text-muted"> / ${budget.limit}</span>
        </div>
      </div>
      <div className="w-full h-1 bg-card rounded-full overflow-hidden">
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
    <div className="flex px-4 border-b border-border shrink-0">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-3 text-sm relative transition-colors ${active === t.id ? 'text-text font-medium' : 'text-text-muted'}`}
        >
          {t.label}
          {active === t.id && (
            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-herald" />
          )}
        </button>
      ))}
    </div>
  )
}

function ActivityTimeline({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-text-muted text-sm text-center py-10">No recent activity.</div>
    )
  }

  return (
    <div className="relative pl-4">
      <div className="absolute left-[3px] top-2 bottom-4 w-px bg-border" />

      {entries.map((entry, i) => (
        <div key={entry.id} className={`flex gap-3 relative ${i < entries.length - 1 ? 'mb-6' : ''}`}>
          <div className="w-2 h-2 rounded-full bg-herald mt-1.5 relative z-10 ring-4 ring-bg shrink-0" />

          <div className="flex-1 min-w-0">
            {entry.type === 'posted' && (
              <>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-medium text-text">Posted</span>
                  <span className="font-mono text-[10px] text-text-muted">{timeAgo(entry.timestamp)}</span>
                </div>
                <div className="bg-card border border-border rounded-lg p-3 flex flex-col gap-2">
                  <p className="text-sm text-text-secondary">{entry.content}</p>
                  {(entry.engagement || entry.tweetUrl) && (
                    <div className="flex items-center justify-between border-t border-border pt-2 mt-1">
                      {entry.engagement && (
                        <div className="flex items-center gap-3 font-mono text-[10px] text-text-muted">
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
                          className="text-[10px] font-mono text-text-muted border border-border px-2 py-1 rounded bg-bg flex items-center gap-1 hover:text-text transition-colors"
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
                  <span className="text-xs font-medium text-text">Replied to</span>
                  {entry.replyTo && (
                    <span className="font-mono text-[10px] text-herald">@{entry.replyTo}</span>
                  )}
                  <span className="font-mono text-[10px] text-text-muted">{timeAgo(entry.timestamp)}</span>
                </div>
                <div className="bg-card border border-border rounded-lg p-3">
                  {entry.content && (
                    <div className="pl-2.5 border-l-2 border-border">
                      <p className="text-[13px] text-text-muted italic">{entry.content}</p>
                    </div>
                  )}
                  {entry.tweetUrl && (
                    <div className="flex justify-end mt-2">
                      <a
                        href={entry.tweetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-text-muted border border-border px-2 py-1 rounded bg-bg flex items-center gap-1 hover:text-text transition-colors"
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
                  <span className="text-xs font-medium text-text">Liked</span>
                  <span className="font-mono text-[10px] text-text-muted">{timeAgo(entry.timestamp)}</span>
                </div>
                <p className="text-sm text-text-muted">
                  <span className="text-text-dim">♥</span>{' '}
                  Liked{entry.replyTo ? <> <span className="font-mono text-xs text-text">@{entry.replyTo}</span>'s post</> : ' a post'}
                  {entry.content ? ` about ${entry.content}` : ''}
                </p>
              </>
            )}

            {entry.type === 'dm_handled' && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-text">DM Handled</span>
                  <span className="font-mono text-[10px] text-text-muted">{timeAgo(entry.timestamp)}</span>
                </div>
                <div className="bg-card border border-border border-dashed rounded-lg p-3">
                  {entry.replyTo && (
                    <><span className="font-mono text-xs text-herald">@{entry.replyTo}:</span>{' '}</>
                  )}
                  <span className="text-sm text-text-muted">{entry.content}</span>
                  {entry.action && (
                    <div className="flex items-center gap-1.5 text-[11px] text-text-muted mt-2">
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
  onEditSave,
}: {
  items: QueueItem[]
  onAction: (id: string, action: 'approve' | 'reject') => Promise<void>
  onEditSave: (id: string, content: string) => Promise<void>
}) {
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setPending((p) => ({ ...p, [id]: true }))
    try {
      await onAction(id, action)
    } finally {
      setPending((p) => ({ ...p, [id]: false }))
    }
  }

  const beginEdit = (item: QueueItem) => {
    setEditingId(item.id)
    setEditDraft(item.content)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft('')
  }

  const saveEdit = async () => {
    if (!editingId) return
    setSaving(true)
    try {
      await onEditSave(editingId, editDraft.trim())
      cancelEdit()
    } finally {
      setSaving(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-text-muted text-sm text-center py-10">No pending posts.</div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
        const isEditing = editingId === item.id
        return (
          <div key={item.id} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
            {isEditing ? (
              <>
                <textarea
                  className="bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-text font-mono resize-none focus:outline-none focus:border-accent/40"
                  rows={4}
                  value={editDraft}
                  maxLength={280}
                  onChange={(e) => setEditDraft(e.target.value)}
                />
                <div className="flex justify-between items-center text-[10px] font-mono text-text-muted">
                  <span>{editDraft.length}/280</span>
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving || editDraft.trim().length === 0 || editDraft.length > 280}
                      className="text-[11px] border border-green/40 text-green bg-green/10 px-3 py-1.5 rounded-lg font-medium hover:bg-green/20 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="text-[11px] border border-border text-text-secondary bg-bg px-3 py-1.5 rounded-lg hover:bg-border disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-text-secondary">{item.content}</p>
                <div className="flex items-center gap-2 font-mono text-[10px] text-text-muted">
                  <Calendar size={11} className="text-text-muted" aria-hidden="true" />
                  <span>{item.scheduled_at ?? '—'}</span>
                </div>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => handleAction(item.id, 'approve')}
                    disabled={pending[item.id]}
                    className="flex-1 text-[11px] border border-green/40 text-green bg-green/10 py-1.5 rounded-lg font-medium hover:bg-green/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pending[item.id] ? '...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => beginEdit(item)}
                    disabled={pending[item.id]}
                    className="px-4 text-[11px] border border-border text-text-secondary bg-bg py-1.5 rounded-lg hover:bg-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleAction(item.id, 'reject')}
                    disabled={pending[item.id]}
                    className="px-3 border border-border text-text-muted bg-bg py-1.5 rounded-lg hover:text-red hover:border-red/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Reject"
                  >
                    <XIcon size={12} weight="bold" />
                  </button>
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DmsTab({ dms }: { dms: DmEntry[] }) {
  if (dms.length === 0) {
    return (
      <div className="text-text-muted text-sm text-center py-10">No recent DMs.</div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {dms.map((dm, i) => (
        <div
          key={dm.id}
          className={`flex flex-col p-3 ${i < dms.length - 1 ? 'border-b border-border/50' : ''}`}
        >
          <div className="flex justify-between mb-1">
            <span className="font-mono text-xs text-herald">@{dm.x_user_id ?? dm.username ?? 'unknown'}</span>
            {dm.resolution === 'resolved' ? (
              <span className="text-[9px] text-green bg-green/10 px-1.5 py-0.5 rounded border border-green/20">
                Resolved
              </span>
            ) : (
              <span className="text-[9px] text-yellow bg-yellow/10 px-1.5 py-0.5 rounded border border-yellow/20">
                Actioned
              </span>
            )}
          </div>
          <p className="text-[13px] text-text-muted mb-1">{dm.text ?? dm.preview ?? ''}</p>
          {dm.action && (
            <div className={`flex items-center gap-1.5 text-[11px] ${dm.resolution === 'resolved' ? 'text-text-muted' : 'text-herald'}`}>
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

  const handleEditSave = async (id: string, content: string) => {
    await apiFetch(`/api/herald/queue/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
      token: token!,
    })
    load()
  }

  if (!token) {
    return (
      <div className="text-text-muted text-sm text-center py-20">
        Connect your wallet to view HERALD activity.
      </div>
    )
  }

  const budget = data?.budget ?? { spent: 0, limit: 150, gate: 'open', percentage: 0 }

  return (
    <div data-testid="herald-view" className="flex flex-col h-full">
      <BudgetBar budget={budget} />
      <SubTabs active={tab} onChange={setTab} />

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {error && (
          <div className="text-red text-xs font-mono bg-red/10 border border-red/20 rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        {!data && !error && (
          <div className="text-text-muted text-sm text-center py-10">Loading...</div>
        )}

        {data && tab === 'activity' && (
          <ActivityTimeline entries={data.recentPosts ?? []} />
        )}

        {data && tab === 'queue' && (
          <QueueTab items={data.queue ?? []} onAction={handleApprove} onEditSave={handleEditSave} />
        )}

        {data && tab === 'dms' && (
          <DmsTab dms={data.dms ?? []} />
        )}
      </div>
    </div>
  )
}
