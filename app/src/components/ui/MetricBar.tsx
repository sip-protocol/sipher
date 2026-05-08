interface MetricBarProps {
  label: string
  value: number
  helper?: string
  max?: number
  className?: string
}

export function MetricBar({ label, value, helper, max = 100, className = '' }: MetricBarProps) {
  const clamped = Math.min(Math.max(value, 0), max)
  const pct = (clamped / max) * 100
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-base text-text">{label}</span>
        <span className="text-base font-mono text-text">{value}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-px bg-line rounded-pill overflow-hidden"
      >
        <div
          data-testid="metric-bar-fill"
          className="h-full rounded-pill transition-[width] duration-base ease-out"
          style={{
            width: `${pct}%`,
            background: 'var(--gradient-progress)',
          }}
        />
      </div>
      {helper && <span className="text-2xs text-text-muted">{helper}</span>}
    </div>
  )
}
