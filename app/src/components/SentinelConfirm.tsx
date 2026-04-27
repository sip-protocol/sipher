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
  onResolved: (decision: 'override' | 'cancel') => void
}

export default function SentinelConfirm({ flagId, token, action, amount, description, onResolved }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dispatch = async (kind: 'override' | 'cancel') => {
    if (busy) return
    setBusy(true)
    setError(null)
    let success = false
    try {
      const res = await fetch(`${API_URL}/api/sentinel/${kind}/${encodeURIComponent(flagId)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        setError(`Action failed (${res.status})`)
        return
      }
      success = true
    } catch {
      setError('Network error — try again')
    } finally {
      setBusy(false)
    }
    if (success) onResolved(kind)
  }

  return (
    <div className="flex flex-col gap-2">
      <ConfirmCard
        variant="warning"
        action={action}
        amount={amount}
        description={description}
        disabled={busy}
        onConfirm={() => dispatch('override')}
        onCancel={() => dispatch('cancel')}
      />
      {error && <div className="text-[12px] text-red px-1">{error}</div>}
    </div>
  )
}
