import { useState } from 'react'
import { apiFetch } from '../api/client'
import { useAuthState } from '../hooks/useAuthState'
import { isAuthError } from '../lib/auth-errors'
import ConfirmCard from './ConfirmCard'

interface Props {
  flagId: string
  action: string
  amount: string
  description?: string
  onResolved: (decision: 'resolve' | 'reject') => void
}

export default function SentinelConfirm({ flagId, action, amount, description, onResolved }: Props) {
  const { token } = useAuthState()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dispatch = async (verb: 'resolve' | 'reject') => {
    if (busy) return
    setBusy(true)
    setError(null)
    let success = false
    try {
      await apiFetch(`/api/sentinel/promise-gate/${encodeURIComponent(flagId)}/${verb}`, {
        method: 'POST',
        token: token ?? undefined,
      })
      success = true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error — try again'
      // 401-class errors fire the global interceptor's session-expired toast;
      // skip the inline display so the user sees one consistent message.
      if (!isAuthError(message)) {
        setError(message)
      }
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
