import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventBus, type GuardianEvent } from '../../src/coordination/event-bus.js'

describe('EventBus', () => {
  let bus: EventBus

  beforeEach(() => {
    bus = new EventBus()
  })

  it('emits and receives typed events', () => {
    const handler = vi.fn()
    bus.on('sipher:action', handler)
    const event: GuardianEvent = {
      source: 'sipher',
      type: 'sipher:action',
      level: 'important',
      data: { tool: 'deposit', amount: 2 },
      wallet: 'FGSk...BWr',
      timestamp: new Date().toISOString(),
    }
    bus.emit(event)
    expect(handler).toHaveBeenCalledWith(event)
  })

  it('wildcard listener receives all events', () => {
    const handler = vi.fn()
    bus.onAny(handler)
    bus.emit({
      source: 'sipher',
      type: 'sipher:action',
      level: 'important',
      data: {},
      timestamp: new Date().toISOString(),
    })
    bus.emit({
      source: 'sentinel',
      type: 'sentinel:threat',
      level: 'critical',
      data: {},
      timestamp: new Date().toISOString(),
    })
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('removeListener stops delivery', () => {
    const handler = vi.fn()
    bus.on('sipher:action', handler)
    bus.off('sipher:action', handler)
    bus.emit({
      source: 'sipher',
      type: 'sipher:action',
      level: 'important',
      data: {},
      timestamp: new Date().toISOString(),
    })
    expect(handler).not.toHaveBeenCalled()
  })

  it('multiple handlers on the same event', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    bus.on('herald:message', handler1)
    bus.on('herald:message', handler2)
    const event: GuardianEvent = {
      source: 'herald',
      type: 'herald:message',
      level: 'routine',
      data: { msg: 'test' },
      timestamp: new Date().toISOString(),
    }
    bus.emit(event)
    expect(handler1).toHaveBeenCalledWith(event)
    expect(handler2).toHaveBeenCalledWith(event)
  })

  it('wildcard listener receives event alongside specific listener', () => {
    const specificHandler = vi.fn()
    const wildcardHandler = vi.fn()
    bus.on('courier:delivery', specificHandler)
    bus.onAny(wildcardHandler)
    const event: GuardianEvent = {
      source: 'courier',
      type: 'courier:delivery',
      level: 'routine',
      data: {},
      timestamp: new Date().toISOString(),
    }
    bus.emit(event)
    expect(specificHandler).toHaveBeenCalledWith(event)
    expect(wildcardHandler).toHaveBeenCalledWith(event)
  })

  it('removeAllListeners clears all handlers', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    const handler3 = vi.fn()
    bus.on('sentinel:alert', handler1)
    bus.on('sipher:action', handler2)
    bus.onAny(handler3)

    bus.removeAllListeners()

    bus.emit({
      source: 'sentinel',
      type: 'sentinel:alert',
      level: 'critical',
      data: {},
      timestamp: new Date().toISOString(),
    })
    bus.emit({
      source: 'sipher',
      type: 'sipher:action',
      level: 'important',
      data: {},
      timestamp: new Date().toISOString(),
    })

    expect(handler1).not.toHaveBeenCalled()
    expect(handler2).not.toHaveBeenCalled()
    expect(handler3).not.toHaveBeenCalled()
  })

  it('event with null wallet is allowed', () => {
    const handler = vi.fn()
    bus.on('courier:broadcast', handler)
    const event: GuardianEvent = {
      source: 'courier',
      type: 'courier:broadcast',
      level: 'routine',
      data: {},
      wallet: null,
      timestamp: new Date().toISOString(),
    }
    bus.emit(event)
    expect(handler).toHaveBeenCalledWith(event)
  })

  it('event data can contain arbitrary nested objects', () => {
    const handler = vi.fn()
    bus.on('sipher:complex', handler)
    const event: GuardianEvent = {
      source: 'sipher',
      type: 'sipher:complex',
      level: 'important',
      data: {
        nested: {
          deeply: {
            value: 42,
            array: [1, 2, 3],
          },
        },
      },
      timestamp: new Date().toISOString(),
    }
    bus.emit(event)
    expect(handler).toHaveBeenCalledWith(event)
  })
})
