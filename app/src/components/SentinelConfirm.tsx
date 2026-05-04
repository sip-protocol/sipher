import { useState } from 'react'
import ConfirmCard from './ConfirmCard'

const API_URL = import.meta.env.VITE_API_URL ?? ''

interface Props {
  flagId: string
  /** Owner JWT — endpoints require requireOwner middleware on the server. */
  token: string
  action: string
  amount: string
  description?: string
  onResolved: (decision: 'resolve' | 'reject') => void
}

export default function SentinelConfirm({ flagId, token, action, amount, description, onResolved }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dispatch = async (verb: 'resolve' | 'reject') => {
    if (busy) return
    setBusy(true)
    setError(null)
    let success = false
    try {
      const res = await fetch(`${API_URL}/api/sentinel/promise-gate/${encodeURIComponent(flagId)}/${verb}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        let message = `Action failed (${res.status})`
        try {
          const body = await res.json()
          if (body?.error?.message) message = String(body.error.message)
        } catch { /* fall back to status */ }
        setError(message)
        return
      }
      success = true
    } catch {
      setError('Network error — try again')
    } finally {
      setBusy(false)
    }
    if (success) onResolved(verb)
  }

  return (
    <div className="flex flex-col gap-2">
      <ConfirmCard
        variant="warning"
        action={action}
        amount={amount}
        description={description}
        disabled={busy}
        onConfirm={() => dispatch('resolve')}
        onCancel={() => dispatch('reject')}
      />
      {error && <div className="text-[12px] text-red px-1">{error}</div>}
    </div>
  )
}
