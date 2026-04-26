import type { ReactNode } from 'react'

export interface Factor {
  label: string
  score: number
}

interface Props {
  label: string
  value: string
  sub?: string
  icon: ReactNode
  color?: string
  variant?: 'normal' | 'hero'
  factors?: Factor[]
  onClick?: () => void
}

function factorColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#84cc16'
  if (score >= 40) return '#facc15'
  return '#fb923c'
}

export default function MetricCard({
  label,
  value,
  sub,
  icon,
  color,
  variant = 'normal',
  factors,
  onClick,
}: Props) {
  const isHero = variant === 'hero'
  const valueSize = isHero ? 'text-[32px]' : 'text-[22px]'

  return (
    <div
      className={`bg-card border border-border rounded-lg p-4 flex flex-col gap-2 ${
        onClick ? 'cursor-pointer hover:border-elevated transition-colors' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-text-muted tracking-widest uppercase">
          {label}
        </span>
        <span className="text-text-muted">{icon}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={`${valueSize} font-mono font-bold leading-none`}
          style={color ? { color } : undefined}
        >
          {value}
        </span>
        {sub && <span className="text-[11px] font-mono text-text-muted">{sub}</span>}
      </div>
      {isHero && factors && factors.length > 0 && (
        <div className="border-t border-elevated/40 mt-2 pt-3 flex flex-col gap-1.5">
          {factors.map((f) => (
            <div key={f.label} className="flex items-center gap-2 text-[10px] font-mono text-text-muted">
              <span className="flex-1 truncate">{f.label}</span>
              <span className="w-10 h-[3px] bg-elevated rounded-full overflow-hidden">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${Math.min(f.score, 100)}%`, backgroundColor: factorColor(f.score) }}
                />
              </span>
              <span className="w-6 text-right">{f.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
