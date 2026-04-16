import { type EventBus, type GuardianEvent } from './event-bus.js'
import { insertActivity, logAgentEvent } from '../db.js'

export function attachLogger(bus: EventBus): void {
  bus.onAny((event: GuardianEvent) => {
    // Always log to agent_events
    logAgentEvent(event.source, null, event.type, event.data)

    // Only log important + critical to activity_stream
    if (event.level === 'routine') return

    insertActivity({
      agent: event.source,
      level: event.level,
      type: event.type.split(':')[1] ?? event.type,
      title: formatTitle(event),
      detail: JSON.stringify(event.data),
      wallet: event.wallet ?? undefined,
    })
  })
}

function formatTitle(event: GuardianEvent): string {
  const data = event.data as Record<string, unknown>
  switch (event.type) {
    case 'sipher:action':
      return `Executed ${data.tool as string}: ${(data.message as string) ?? JSON.stringify(data)}`
    case 'sipher:alert':
      return `Alert: ${(data.message as string) ?? 'Security warning'}`
    case 'sentinel:unclaimed':
      return `Unclaimed stealth payment: ${(data.amount as number) ?? '?'} SOL`
    case 'sentinel:threat':
      return `Threat detected: ${(data.address as string) ?? 'unknown address'}`
    case 'sentinel:expired':
      return `Vault deposit expired: ${(data.amount as number) ?? '?'} SOL`
    case 'sentinel:balance':
      return `Vault balance changed: ${(data.balance as number) ?? '?'} SOL`
    case 'sentinel:alert': {
      const title = (data.title as string) ?? 'SENTINEL alert'
      const severity = (data.severity as string) ?? 'warn'
      return `[${severity}] ${title}`
    }
    case 'sentinel:action-taken': {
      const actionType = (data.actionType as string) ?? 'action'
      return `SENTINEL executed ${actionType}`
    }
    case 'sentinel:pending-action': {
      const actionType = (data.actionType as string) ?? 'action'
      const delayMs = (data.delayMs as number) ?? 0
      return `SENTINEL scheduled ${actionType} in ${Math.round(delayMs / 1000)}s (cancellable)`
    }
    case 'sentinel:action-cancelled': {
      const actionType = (data.actionType as string) ?? 'action'
      const by = (data.cancelledBy as string) ?? 'sentinel'
      return `SENTINEL cancelled ${actionType} (by ${by})`
    }
    case 'sentinel:veto':
      return `SENTINEL veto: ${(data.reason as string) ?? 'blocked SIPHER action'}`
    case 'sentinel:risk-report': {
      const risk = (data.risk as string) ?? 'unknown'
      const rec = (data.recommendation as string) ?? 'allow'
      return `SENTINEL risk=${risk}, recommendation=${rec}`
    }
    case 'courier:executed':
      return `Executed scheduled op: ${(data.action as string) ?? 'unknown'}`
    case 'courier:failed':
      return `Failed scheduled op: ${(data.action as string) ?? 'unknown'} — ${(data.error as string) ?? ''}`
    default:
      return (data.message as string) ?? event.type
  }
}
