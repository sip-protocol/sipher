import type { ReactNode } from 'react'

export interface BannerProps {
  kind: 'info' | 'warning' | 'error'
  children: ReactNode
}

const TONES: Record<BannerProps['kind'], string> = {
  info: 'border-cyan/40 text-cyan bg-cyan/5',
  warning: 'border-amber-500/40 text-amber-400 bg-amber-500/5',
  error: 'border-danger/40 text-danger bg-danger-soft',
}

export function Banner({ kind, children }: BannerProps) {
  const role = kind === 'info' ? 'status' : 'alert'
  return (
    <div
      role={role}
      data-testid="banner"
      className={`border rounded-md px-3 py-2 text-xs ${TONES[kind]}`}
    >
      {children}
    </div>
  )
}
