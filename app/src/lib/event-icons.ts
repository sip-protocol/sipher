import {
  ArrowDown,
  ArrowUp,
  PaperPlaneTilt,
  ArrowsLeftRight,
  DownloadSimple,
  ArrowCounterClockwise,
  Eye,
  ShieldWarning,
  Shield,
  Megaphone,
  Circle,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'

export const EVENT_ICONS: Record<string, Icon> = {
  deposit: ArrowDown,
  withdraw: ArrowUp,
  send: PaperPlaneTilt,
  swap: ArrowsLeftRight,
  claim: DownloadSimple,
  refund: ArrowCounterClockwise,
  scan: Eye,
  'sentinel.flag': ShieldWarning,
  'sentinel.block': Shield,
  'herald.posted': Megaphone,
}

export function resolveEventIcon(type: string): Icon {
  if (type in EVENT_ICONS) return EVENT_ICONS[type]
  for (const key of Object.keys(EVENT_ICONS)) {
    if (type.startsWith(key + '.')) return EVENT_ICONS[key]
  }
  return Circle
}
