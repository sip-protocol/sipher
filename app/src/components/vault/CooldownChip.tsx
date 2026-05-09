import { useEffect, useState } from 'react'
import { Chip } from '../ui/Chip'

interface CooldownChipProps {
  refundableAt: number
  onElapsed?: () => void
}

function formatRemaining(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return 'Available now'
  if (secondsRemaining < 3600) {
    const m = Math.floor(secondsRemaining / 60)
    const s = secondsRemaining % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }
  const h = Math.floor(secondsRemaining / 3600)
  const m = Math.floor((secondsRemaining % 3600) / 60)
  return `${h}h ${m}m`
}

export function CooldownChip({ refundableAt, onElapsed }: CooldownChipProps) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const remaining = refundableAt - now
  const elapsed = remaining <= 0

  useEffect(() => {
    if (elapsed) return
    const id = setInterval(() => {
      const next = Math.floor(Date.now() / 1000)
      setNow(next)
      if (next >= refundableAt) {
        clearInterval(id)
        onElapsed?.()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [refundableAt, elapsed, onElapsed])

  return (
    <Chip
      tone={elapsed ? 'success' : 'neutral'}
      role="status"
      aria-live="polite"
    >
      {formatRemaining(remaining)}
    </Chip>
  )
}
