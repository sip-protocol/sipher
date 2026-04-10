import { AGENTS, type AgentName } from '../lib/agents'
import { timeAgo } from '../lib/format'

interface Action {
  label: string
  onClick: () => void
}

interface Props {
  agent: AgentName
  title: string
  detail?: string
  time: string
  level: string
  actions?: Action[]
}

export default function ActivityEntry({ agent, title, detail, time, level, actions }: Props) {
  const agentConfig = AGENTS[agent] ?? { name: agent.toUpperCase(), color: 'var(--color-text-muted)' }
  const isCritical = level === 'critical'

  return (
    <div
      className={[
        'bg-card border border-elevated rounded-lg p-3.5 flex flex-col gap-2',
        isCritical ? 'border-l-[3px] border-l-yellow' : '',
      ].join(' ')}
    >
      {/* Top row: dot + agent name + time */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: agentConfig.color }}
          />
          <span
            className="text-[11px] font-semibold tracking-widest uppercase"
            style={{ color: agentConfig.color }}
          >
            {agentConfig.name}
          </span>
        </div>
        <span className="text-text-muted text-[11px]">{timeAgo(time)}</span>
      </div>

      {/* Title */}
      <p className="text-[14px] text-text leading-snug">{title}</p>

      {/* Detail — monospace, for TX hashes, metrics, etc. */}
      {detail && (
        <p className="text-[12px] text-text-muted font-mono break-all">{detail}</p>
      )}

      {/* Actions */}
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className="border border-elevated bg-bg text-[11px] px-3 py-1.5 rounded-lg font-medium text-text hover:bg-elevated transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
