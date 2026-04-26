import { resolveEventIcon } from '../lib/event-icons'

interface Props {
  type: string
  color: string
  live?: boolean
  size?: number
}

export default function EventIcon({ type, color, live = false, size = 14 }: Props) {
  const Icon = resolveEventIcon(type)
  return (
    <span className={`inline-flex shrink-0 ${live ? 'animate-pulse' : ''}`}>
      <Icon size={size} color={color} weight="fill" />
    </span>
  )
}
