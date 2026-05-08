import { useState, useMemo } from 'react'
import { Card } from './ui/Card'
import { Pill } from './ui/Pill'
import { HashCell } from './ui/HashCell'

type FilterKey = 'all' | 'deposit' | 'withdraw' | 'relay'

export interface ActivityRow {
  id: string
  agent: string
  type: string
  level: string
  timestamp: string
  data: Record<string, unknown>
}

interface ActivityStreamTableProps {
  rows: ActivityRow[]
}

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'ALL' },
  { key: 'deposit', label: 'DEPOSIT' },
  { key: 'withdraw', label: 'WITHDRAW' },
  { key: 'relay', label: 'RELAY' },
]

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ActivityStreamTable({ rows }: ActivityStreamTableProps) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return rows
    return rows.filter((r) => r.type.toLowerCase().includes(filter))
  }, [rows, filter])

  return (
    <Card variant="default" className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-2xs text-text-muted"
          style={{ letterSpacing: 'var(--tracking-widest)' }}
        >
          ACTIVITY STREAM · LAST 24H
        </h3>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <Pill
              key={f.key}
              label={f.label}
              size="sm"
              active={filter === f.key}
              onClick={() => setFilter(f.key)}
            />
          ))}
        </div>
      </div>
      <table className="w-full text-xs">
        <thead
          className="text-2xs text-text-muted"
          style={{ letterSpacing: 'var(--tracking-wider)' }}
        >
          <tr>
            <th className="text-left font-medium pb-3">TIME</th>
            <th className="text-left font-medium pb-3">TYPE</th>
            <th className="text-left font-medium pb-3">VIA</th>
            <th className="text-left font-medium pb-3">HASH</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => {
            const sig = typeof row.data.signature === 'string' ? row.data.signature : null
            return (
              <tr key={row.id} className="border-t border-line">
                <td className="py-3 font-mono text-text-secondary">{formatTime(row.timestamp)}</td>
                <td className="py-3">
                  <Pill label={row.type.toUpperCase()} size="sm" />
                </td>
                <td className="py-3 text-text-secondary">{row.agent}</td>
                <td className="py-3">
                  {sig ? (
                    <HashCell hash={sig} />
                  ) : (
                    <span className="text-text-muted font-mono">—</span>
                  )}
                </td>
              </tr>
            )
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-text-muted text-sm">
                No activity in the last 24h.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  )
}
