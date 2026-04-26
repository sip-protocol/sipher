import { AGENTS, type AgentName } from '../lib/agents'
import { timeAgo } from '../lib/format'
import EventIcon from './EventIcon'

interface Action {
  label: string
  onClick: () => void
}

interface Props {
  agent: AgentName
  type?: string
  title: string
  detail?: string
  time: string
  level: string
  isLive?: boolean
  actions?: Action[]
}

export default function ActivityEntry({
  agent,
  type = '',
  title,
  detail,
  time,
  level,
  isLive,
  actions,
}: Props) {
  const agentConfig = AGENTS[agent] ?? { name: agent.toUpperCase(), color: 'var(--color-text-muted)' }
  const isCritical = level === 'critical'

  return (
    <div
      className={[
        'bg-card border border-elevated rounded-lg p-3.5 flex flex-col gap-2',
        isCritical ? 'border-l-[3px] border-l-yellow' : '',
      ].join(' ')}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <EventIcon type={type} color={agentConfig.color} live={isLive} />
          <span
            className="text-[11px] font-semibold tracking-widest uppercase"
            style={{ color: agentConfig.color }}
          >
            {agentConfig.name}
          </span>
        </div>
        <span className="text-text-muted text-[11px]">{timeAgo(time)}</span>
      </div>

      <p className="text-[14px] text-text leading-snug">{title}</p>

      {detail && (
        <p className="text-[12px] text-text-muted font-mono break-all">{detail}</p>
      )}

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
