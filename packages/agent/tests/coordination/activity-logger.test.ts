import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventBus, type GuardianEvent } from '../../packages/agent/src/coordination/event-bus.js'
import { attachLogger } from '../../packages/agent/src/coordination/activity-logger.js'
import { getActivity, getAgentEvents, getDb, closeDb } from '../../packages/agent/src/db.js'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
  getDb() // init
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

describe('ActivityLogger', () => {
  it('logs important events to activity_stream', () => {
    const bus = new EventBus()
    attachLogger(bus)
    bus.emit({
      source: 'sipher', type: 'sipher:action', level: 'important',
      data: { tool: 'deposit', amount: 2 }, wallet: 'wallet-1',
      timestamp: new Date().toISOString(),
    })
    const rows = getActivity('wallet-1')
    expect(rows).toHaveLength(1)
    expect(rows[0].agent).toBe('sipher')
  })

  it('skips routine events in activity_stream', () => {
    const bus = new EventBus()
    attachLogger(bus)
    bus.emit({
      source: 'sentinel', type: 'sentinel:scan-complete', level: 'routine',
      data: { blocks: 142 }, timestamp: new Date().toISOString(),
    })
    const rows = getActivity(null)
    expect(rows).toHaveLength(0)
  })

  it('logs ALL events to agent_events', () => {
    const bus = new EventBus()
    attachLogger(bus)
    bus.emit({ source: 'sentinel', type: 'sentinel:scan', level: 'routine', data: {}, timestamp: new Date().toISOString() })
    bus.emit({ source: 'sentinel', type: 'sentinel:threat', level: 'critical', data: {}, timestamp: new Date().toISOString() })
    const events = getAgentEvents()
    expect(events).toHaveLength(2)
  })

  it('logs critical events to activity_stream', () => {
    const bus = new EventBus()
    attachLogger(bus)
    bus.emit({
      source: 'sentinel', type: 'sentinel:threat', level: 'critical',
      data: { address: '8xAb...def' }, timestamp: new Date().toISOString(),
    })
    const rows = getActivity(null, { levels: ['critical'] })
    expect(rows).toHaveLength(1)
  })

  it('formats titles for known event types', () => {
    const bus = new EventBus()
    attachLogger(bus)
    bus.emit({
      source: 'courier', type: 'courier:executed', level: 'important',
      data: { action: 'drip' }, timestamp: new Date().toISOString(),
    })
    const rows = getActivity(null)
    expect(rows[0].title).toContain('drip')
  })

  it('formats sipher:action title', () => {
    const bus = new EventBus()
    attachLogger(bus)
    bus.emit({
      source: 'sipher', type: 'sipher:action', level: 'important',
      data: { tool: 'send', message: 'Sent 1 SOL' }, timestamp: new Date().toISOString(),
    })
    const rows = getActivity(null)
    expect(rows[0].title).toContain('send')
  })

  it('formats sipher:alert title', () => {
    const bus = new EventBus()
    attachLogger(bus)
    bus.emit({
      source: 'sipher', type: 'sipher:alert', level: 'critical',
      data: { message: 'High fee detected' }, timestamp: new Date().toISOString(),
    })
    const rows = getActivity(null)
    expect(rows[0].title).toContain('High fee detected')
  })

  it('formats sentinel:unclaimed title', () => {
    const bus = new EventBus()
    attachLogger(bus)
    bus.emit({
      source: 'sentinel', type: 'sentinel:unclaimed', level: 'important',
      data: { amount: 2.5 }, timestamp: new Date().toISOString(),
    })
    const rows = getActivity(null)
    expect(rows[0].title).toContain('2.5')
  })

  it('formats sentinel:threat title', () => {
    const bus = new EventBus()
    attachLogger(bus)
    bus.emit({
      source: 'sentinel', type: 'sentinel:threat', level: 'critical',
      data: { address: 'BadAddr123' }, timestamp: new Date().toISOString(),
    })
    const rows = getActivity(null)
    expect(rows[0].title).toContain('BadAddr123')
  })

  it('formats sentinel:expired title', () => {
    const bus = new EventBus()
    attachLogger(bus)
    bus.emit({
      source: 'sentinel', type: 'sentinel:expired', level: 'important',
      data: { amount: 5.0 }, timestamp: new Date().toISOString(),
    })
    const rows = getActivity(null)
    expect(rows[0].title).toContain('5')
  })

  it('formats sentinel:balance title', () => {
    const bus = new EventBus()
    attachLogger(bus)
    bus.emit({
      source: 'sentinel', type: 'sentinel:balance', level: 'routine',
      data: { balance: 10.5 }, timestamp: new Date().toISOString(),
    })
    const rows = getActivity(null, { levels: ['routine'] })
    expect(rows).toHaveLength(0) // routine not logged to activity_stream
  })

  it('formats courier:executed title', () => {
    const bus = new EventBus()
    attachLogger(bus)
    bus.emit({
      source: 'courier', type: 'courier:executed', level: 'important',
      data: { action: 'recurring-send' }, timestamp: new Date().toISOString(),
    })
    const rows = getActivity(null)
    expect(rows[0].title).toContain('recurring-send')
  })

  it('formats courier:failed title', () => {
    const bus = new EventBus()
    attachLogger(bus)
    bus.emit({
      source: 'courier', type: 'courier:failed', level: 'critical',
      data: { action: 'sweep', error: 'Insufficient SOL' }, timestamp: new Date().toISOString(),
    })
    const rows = getActivity(null)
    expect(rows[0].title).toContain('sweep')
    expect(rows[0].title).toContain('Insufficient SOL')
  })

  it('stores detail as JSON', () => {
    const bus = new EventBus()
    attachLogger(bus)
    const eventData = { tool: 'deposit', amount: 10, nested: { key: 'value' } }
    bus.emit({
      source: 'sipher', type: 'sipher:action', level: 'important',
      data: eventData, timestamp: new Date().toISOString(),
    })
    const rows = getActivity(null)
    const detail = JSON.parse(rows[0].detail as string)
    expect(detail).toEqual(eventData)
  })

  it('handles events with wallet=null', () => {
    const bus = new EventBus()
    attachLogger(bus)
    bus.emit({
      source: 'courier', type: 'courier:broadcast', level: 'important',
      data: { msg: 'System update' }, wallet: null, timestamp: new Date().toISOString(),
    })
    const rows = getActivity(null)
    expect(rows).toHaveLength(1)
    expect(rows[0].wallet).toBeNull()
  })

  it('logs both activity_stream and agent_events for important events', () => {
    const bus = new EventBus()
    attachLogger(bus)
    bus.emit({
      source: 'sipher', type: 'sipher:action', level: 'important',
      data: { tool: 'swap' }, wallet: 'w1', timestamp: new Date().toISOString(),
    })
    const activity = getActivity(null)
    const events = getAgentEvents()
    expect(activity).toHaveLength(1)
    expect(events).toHaveLength(1)
  })

  it('logs routine events to agent_events only', () => {
    const bus = new EventBus()
    attachLogger(bus)
    bus.emit({
      source: 'sentinel', type: 'sentinel:scanned', level: 'routine',
      data: { blocks: 10 }, timestamp: new Date().toISOString(),
    })
    const activity = getActivity(null)
    const events = getAgentEvents()
    expect(activity).toHaveLength(0)
    expect(events).toHaveLength(1)
  })
})
