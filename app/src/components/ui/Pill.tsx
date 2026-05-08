import { ButtonHTMLAttributes } from 'react'

interface PillProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  label: string
  active?: boolean
  size?: 'sm' | 'md'
}

export function Pill({ label, active = false, size = 'md', className = '', ...rest }: PillProps) {
  const sizeClass = size === 'sm' ? 'text-2xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
  const stateClass = active
    ? 'bg-accent-soft text-text border-line-accent'
    : 'bg-transparent text-text-muted border-line hover:text-text-secondary hover:border-line-2'
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`inline-flex items-center justify-center gap-1.5 border rounded-pill font-medium tracking-wide uppercase transition-colors ${sizeClass} ${stateClass} ${className}`}
      {...rest}
    >
      {label}
    </button>
  )
}
