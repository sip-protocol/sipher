import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { GuardianEvent } from '../../src/coordination/event-bus.js'

describe('SentinelAdapter', () => {
  beforeEach(() => {
    process.env.DB_PATH = ':memory:'
    vi.resetModules()
  })
  afterEach(() => { delete process.env.DB_PATH })

  async function freshDb() {
    const { closeDb, getDb } = await import('../../src/db.js')
    closeDb()
    getDb()
  }

  function makeFakeCore() {
    return { analyze: vi.fn().mockResolvedValue({ recommendation: 'allow', reasons: [] }) }
  }

  it('invokes core.analyze for sentinel:threat events', async () => {
    await freshDb()
    const { guardianBus } = await import('../../src/coordination/event-bus.js')
    const { SentinelAdapter } = await import('../../src/sentinel/adapter.js')
    const core = makeFakeCore()
    const adapter = new SentinelAdapter(guardianBus, core as never)
    adapter.start()

    const ev: GuardianEvent = {
      source: 'sentinel', type: 'sentinel:threat', level: 'critical',
      data: { address: 'bad' }, wallet: 'w1', timestamp: new Date().toISOString(),
    }
    guardianBus.emit(ev)
    await new Promise((r) => setTimeout(r, 10))
    expect(core.analyze).toHaveBeenCalledWith(expect.objectContaining({ type: 'sentinel:threat' }))
    adapter.stop()
  })

  it('skips its own emissions (loop prevention)', async () => {
    await freshDb()
    const { guardianBus } = await import('../../src/coordination/event-bus.js')
    const { SentinelAdapter } = await import('../../src/sentinel/adapter.js')
    const core = makeFakeCore()
    const adapter = new SentinelAdapter(guardianBus, core as never)
    adapter.start()

    for (const type of ['sentinel:action-taken', 'sentinel:pending-action', 'sentinel:veto', 'sentinel:alert']) {
      guardianBus.emit({
        source: 'sentinel', type, level: 'important',
        data: {}, wallet: null, timestamp: new Date().toISOString(),
      })
    }
    await new Promise((r) => setTimeout(r, 10))
    expect(core.analyze).not.toHaveBeenCalled()
    adapter.stop()
  })

  it('skips sipher:action events (preflight path handles those)', async () => {
    await freshDb()
    const { guardianBus } = await import('../../src/coordination/event-bus.js')
    const { SentinelAdapter } = await import('../../src/sentinel/adapter.js')
    const core = makeFakeCore()
    const adapter = new SentinelAdapter(guardianBus, core as never)
    adapter.start()

    guardianBus.emit({
      source: 'sipher', type: 'sipher:action', level: 'important',
      data: { tool: 'send' }, wallet: 'w1', timestamp: new Date().toISOString(),
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(core.analyze).not.toHaveBeenCalled()
    adapter.stop()
  })

  it('respects SENTINEL_MODE=off (never invokes core)', async () => {
    await freshDb()
    process.env.SENTINEL_MODE = 'off'
    const { guardianBus } = await import('../../src/coordination/event-bus.js')
    const { SentinelAdapter } = await import('../../src/sentinel/adapter.js')
    const core = makeFakeCore()
    const adapter = new SentinelAdapter(guardianBus, core as never)
    adapter.start()

    guardianBus.emit({
      source: 'sentinel', type: 'sentinel:threat', level: 'critical',
      data: {}, wallet: 'w1', timestamp: new Date().toISOString(),
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(core.analyze).not.toHaveBeenCalled()
    adapter.stop()
    delete process.env.SENTINEL_MODE
  })

  it('respects kill switch', async () => {
    await freshDb()
    vi.doMock('../../src/routes/squad-api.js', () => ({ isKillSwitchActive: () => true }))
    const { guardianBus } = await import('../../src/coordination/event-bus.js')
    const { SentinelAdapter } = await import('../../src/sentinel/adapter.js')
    const core = makeFakeCore()
    const adapter = new SentinelAdapter(guardianBus, core as never)
    adapter.start()

    guardianBus.emit({
      source: 'sentinel', type: 'sentinel:threat', level: 'critical',
      data: {}, wallet: 'w1', timestamp: new Date().toISOString(),
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(core.analyze).not.toHaveBeenCalled()
    adapter.stop()
    vi.doUnmock('../../src/routes/squad-api.js')
  })

  it('invokes on arbitrary critical events from any source', async () => {
    await freshDb()
    const { guardianBus } = await import('../../src/coordination/event-bus.js')
    const { SentinelAdapter } = await import('../../src/sentinel/adapter.js')
    const core = makeFakeCore()
    const adapter = new SentinelAdapter(guardianBus, core as never)
    adapter.start()

    guardianBus.emit({
      source: 'courier', type: 'courier:failed', level: 'critical',
      data: { action: 'recurring' }, wallet: 'w1', timestamp: new Date().toISOString(),
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(core.analyze).toHaveBeenCalled()
    adapter.stop()
  })
})
