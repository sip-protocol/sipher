interface GaugeProps {
  value: number
  max: number
  gradeLabel?: string
  size?: number
  strokeWidth?: number
  ariaLabel?: string
}

export function Gauge({
  value,
  max,
  gradeLabel,
  size = 200,
  strokeWidth = 10,
  ariaLabel = 'Gauge',
}: GaugeProps) {
  const clamped = Math.min(Math.max(value, 0), max)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const fillRatio = clamped / max
  const dashOffset = circumference * (1 - fillRatio)

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={max}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90 absolute inset-0">
        <defs>
          <linearGradient id="gauge-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-cyan)" />
            <stop offset="100%" stopColor="var(--color-accent)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#gauge-stroke)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: 'stroke-dashoffset var(--duration-slower) var(--ease-spring)',
            filter: 'var(--drop-glow-accent)',
          }}
        />
      </svg>
      <div className="flex flex-col items-center z-raised">
        <div className="flex items-baseline">
          <span
            className="font-mono text-6xl text-text leading-none"
            style={{ fontWeight: 'var(--weight-regular)' }}
          >
            {clamped}
          </span>
          <span className="font-mono text-xl text-text-muted leading-none">/{max}</span>
        </div>
        {gradeLabel && (
          <span
            className="text-2xs text-text-muted mt-2"
            style={{ letterSpacing: 'var(--tracking-widest)' }}
          >
            {gradeLabel}
          </span>
        )}
      </div>
    </div>
  )
}
