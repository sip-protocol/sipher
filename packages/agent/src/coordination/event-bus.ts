import { EventEmitter } from 'node:events'

export interface GuardianEvent {
  source: 'sipher' | 'herald' | 'sentinel' | 'courier'
  type: string
  level: 'critical' | 'important' | 'routine'
  data: Record<string, unknown>
  wallet?: string | null
  timestamp: string
}

type EventHandler = (event: GuardianEvent) => void

export class EventBus {
  private emitter = new EventEmitter()
  private static WILDCARD = '__any__'

  on(type: string, handler: EventHandler): void {
    this.emitter.on(type, handler)
  }

  off(type: string, handler: EventHandler): void {
    this.emitter.removeListener(type, handler)
  }

  onAny(handler: EventHandler): void {
    this.emitter.on(EventBus.WILDCARD, handler)
  }

  emit(event: GuardianEvent): void {
    this.emitter.emit(event.type, event)
    this.emitter.emit(EventBus.WILDCARD, event)
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners()
  }
}

export const guardianBus = new EventBus()
