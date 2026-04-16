import type { EventBus, GuardianEvent } from '../coordination/event-bus.js'
import type { SentinelCore } from './core.js'
import { getSentinelConfig } from './config.js'
import { isKillSwitchActive } from '../routes/squad-api.js'

/**
 * SENTINEL's own emitted event types — must not trigger another invocation.
 */
const SENTINEL_SELF_EVENTS = new Set([
  'sentinel:action-taken',
  'sentinel:action-cancelled',
  'sentinel:action-error',
  'sentinel:pending-action',
  'sentinel:execute-error',
  'sentinel:veto',
  'sentinel:alert',
  'sentinel:audit-failure',
  'sentinel:rate-limit-hit',
  'sentinel:schema-violation',
  'sentinel:budget-warning',
  'sentinel:mode-changed',
  'sentinel:blacklist-added',
  'sentinel:blacklist-removed',
])

/**
 * Reactive event types that wake SentinelCore.
 */
const REACTIVE_TRIGGER_TYPES = new Set([
  'sentinel:threat',
  'sentinel:refund-pending',
  'sentinel:unclaimed',
  'sentinel:expired',
  'sentinel:large-transfer',
])

export class SentinelAdapter {
  private handler: ((event: GuardianEvent) => void) | null = null

  constructor(private bus: EventBus, private core: SentinelCore) {}

  start(): void {
    if (this.handler) return
    this.handler = (event: GuardianEvent) => {
      void this.handleEvent(event)
    }
    this.bus.onAny(this.handler)
  }

  stop(): void {
    if (this.handler) {
      this.bus.offAny(this.handler)
      this.handler = null
    }
  }

  private async handleEvent(event: GuardianEvent): Promise<void> {
    const config = getSentinelConfig()

    // Mode: off → never invoke
    if (config.mode === 'off') return

    // Kill switch: skip
    if (isKillSwitchActive()) return

    // Loop prevention: SENTINEL's own events
    if (SENTINEL_SELF_EVENTS.has(event.type)) return

    // SIPHER fund actions go through preflight, not reactive
    if (event.type === 'sipher:action') return

    // Gate by type OR critical level (any source)
    const isReactiveTrigger = REACTIVE_TRIGGER_TYPES.has(event.type) || event.level === 'critical'
    if (!isReactiveTrigger) return

    try {
      await this.core.analyze(event)
    } catch (err) {
      // Errors are already persisted inside SentinelCore.run; nothing to re-raise here
      void err
    }
  }
}
