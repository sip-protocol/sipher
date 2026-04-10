import type { ReactNode } from 'react'

interface Props {
  label: string
  value: string
  sub?: string
  icon: ReactNode
  color?: string
}

export default function MetricCard({ label, value, sub, icon, color }: Props) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-text-muted tracking-widest uppercase">
          {label}
        </span>
        <span className="text-text-muted">{icon}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="text-[22px] font-mono font-bold leading-none"
          style={color ? { color } : undefined}
        >
          {value}
        </span>
        {sub && <span className="text-[11px] font-mono text-text-muted">{sub}</span>}
      </div>
    </div>
  )
}
