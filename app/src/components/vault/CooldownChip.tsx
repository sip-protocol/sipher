import { useEffect, useState } from 'react'

interface CooldownChipProps {
  refundableAt: number // unix seconds
  onElapsed?: () => void
}

const CHIP_BASE =
  'inline-flex items-center gap-1.5 border rounded-pill px-2.5 py-1 text-xs font-medium tracking-wide uppercase'

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

  const className = elapsed
    ? `${CHIP_BASE} border-success/40 bg-success-soft text-success`
    : `${CHIP_BASE} border-line text-text-muted`

  return (
    <span role="status" aria-live="polite" className={className}>
      {formatRemaining(remaining)}
    </span>
  )
}
