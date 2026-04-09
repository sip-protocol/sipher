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
      wallet: event.wallet ?? null,
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
    case 'courier:executed':
      return `Executed scheduled op: ${(data.action as string) ?? 'unknown'}`
    case 'courier:failed':
      return `Failed scheduled op: ${(data.action as string) ?? 'unknown'} — ${(data.error as string) ?? ''}`
    default:
      return (data.message as string) ?? event.type
  }
}
