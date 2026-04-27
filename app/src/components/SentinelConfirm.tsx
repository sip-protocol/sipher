import { useState } from 'react'
import ConfirmCard from './ConfirmCard'

const API_URL = import.meta.env.VITE_API_URL ?? ''

interface Props {
  flagId: string
  token: string
  action: string
  amount: string
  description?: string
  onResolved: (decision: 'override' | 'cancel') => void
}

export default function SentinelConfirm({ flagId, token, action, amount, description, onResolved }: Props) {
  const [busy, setBusy] = useState(false)

  const dispatch = async (kind: 'override' | 'cancel') => {
    if (busy) return
    setBusy(true)
    try {
      await fetch(`${API_URL}/api/sentinel/${kind}/${flagId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      onResolved(kind)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConfirmCard
      variant="warning"
      action={action}
      amount={amount}
      description={description}
      onConfirm={() => dispatch('override')}
      onCancel={() => dispatch('cancel')}
    />
  )
}
