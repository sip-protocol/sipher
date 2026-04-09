import { AGENTS, type AgentName } from '../lib/agents'

export default function AgentDot({ agent, size = 6 }: { agent: AgentName, size?: number }) {
  const color = AGENTS[agent].color
  return (
    <div
      className="rounded-full shrink-0"
      style={{ width: size, height: size, backgroundColor: color }}
    />
  )
}
