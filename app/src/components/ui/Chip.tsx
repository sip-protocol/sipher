import type { HTMLAttributes, ReactNode } from 'react'

export type ChipTone =
  | 'neutral'
  | 'success'
  | 'danger'
  | 'warning'
  | 'cyan'
  | 'accent'
  | 'herald'
  | 'sentinel'

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone
  icon?: ReactNode
  children: ReactNode
}

const BASE =
  'inline-flex items-center gap-1.5 border rounded-pill px-2.5 py-1 text-xs font-medium tracking-wide uppercase'

const TONE_CLASSES: Record<ChipTone, string> = {
  neutral: 'border-line text-text-muted',
  success: 'border-success/40 bg-success-soft text-success',
  danger: 'border-danger/40 bg-danger-soft text-danger',
  warning: 'border-warning/40 bg-warning-soft text-warning',
  cyan: 'border-cyan/40 bg-cyan-soft text-cyan-hi',
  accent: 'border-accent/40 bg-accent-soft text-accent-hi',
  herald: 'border-herald/40 bg-herald-soft text-herald',
  sentinel: 'border-sentinel/40 bg-sentinel-soft text-sentinel',
}

export function Chip({
  tone = 'neutral',
  icon,
  className,
  children,
  ...rest
}: ChipProps) {
  const merged = [BASE, TONE_CLASSES[tone], className].filter(Boolean).join(' ')
  return (
    <span className={merged} {...rest}>
      {icon}
      {children}
    </span>
  )
}
