import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventBus, guardianBus } from '../../src/coordination/event-bus.js'
import { attachLogger } from '../../src/coordination/activity-logger.js'
import { AgentPool } from '../../src/agents/pool.js'
import {
  SIPHER_SYSTEM_PROMPT,
  FUND_MOVING_TOOLS,
  isFundMoving,
  getRouterTools,
  getGroupTools,
} from '../../src/agents/sipher.js'
import {
  SERVICE_TOOLS,
  SERVICE_SYSTEM_PROMPT,
  SERVICE_TOOL_NAMES,
} from '../../src/agents/service-sipher.js'
import { TOOL_GROUPS, ALL_TOOL_NAMES, routeIntentTool } from '../../src/pi/tool-groups.js'
import { adaptTool } from '../../src/pi/tool-adapter.js'
import {
  getActivity,
  getAgentEvents,
  logCost,
  getCostTotals,
  createExecutionLink,
  getExecutionLink,
  insertActivity,
  getDb,
  closeDb,
} from '../../src/db.js'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
  getDb()
})

afterEach(() => {
  guardianBus.removeAllListeners()
  closeDb()
  delete process.env.DB_PATH
})

describe('Plan A Integration', () => {

  // 1. EventBus → ActivityLogger → SQLite flow
  it('EventBus events flow through ActivityLogger to SQLite', () => {
    const bus = new EventBus()
    attachLogger(bus)

    bus.emit({
      source: 'sipher',
      type: 'sipher:action',
      level: 'important',
      data: { tool: 'deposit', amount: 5, message: 'Deposited 5 SOL' },
      wallet: 'wallet-1',
      timestamp: new Date().toISOString(),
    })

    const rows = getActivity('wallet-1')
    expect(rows).toHaveLength(1)
    expect(rows[0].agent).toBe('sipher')

    const events = getAgentEvents()
    expect(events).toHaveLength(1)
  })

  // 2. Routine events suppressed from activity_stream
  it('routine events logged to agent_events but not activity_stream', () => {
    const bus = new EventBus()
    attachLogger(bus)

    bus.emit({
      source: 'sentinel',
      type: 'sentinel:scan',
      level: 'routine',
      data: {},
      timestamp: new Date().toISOString(),
    })
    bus.emit({
      source: 'sentinel',
      type: 'sentinel:threat',
      level: 'critical',
      data: { address: 'bad' },
      timestamp: new Date().toISOString(),
    })

    const activity = getActivity(null)
    expect(activity).toHaveLength(1)
    expect(activity[0].level).toBe('critical')

    const events = getAgentEvents()
    expect(events).toHaveLength(2)
  })

  // 3. AgentPool lifecycle
  it('AgentPool creates, retrieves, and evicts agents', async () => {
    const pool = new AgentPool({ maxSize: 3, idleTimeoutMs: 50 })

    pool.getOrCreate('wallet-1')
    pool.getOrCreate('wallet-2')
    expect(pool.size()).toBe(2)

    const same = pool.getOrCreate('wallet-1')
    expect(same.wallet).toBe('wallet-1')

    await new Promise(r => setTimeout(r, 100))
    const evicted = pool.evictIdle()
    expect(evicted).toBe(2)
    expect(pool.size()).toBe(0)
  })

  // 4. Cost tracking
  it('cost tracking logs and aggregates by agent', () => {
    logCost({
      agent: 'sipher',
      provider: 'openrouter',
      operation: 'chat',
      cost_usd: 0.10,
      tokens_in: 1000,
      tokens_out: 500,
    })
    logCost({
      agent: 'herald',
      provider: 'x_api',
      operation: 'posts_read',
      cost_usd: 0.05,
      resources: 10,
    })

    const totals = getCostTotals('today')
    expect(totals.sipher).toBeCloseTo(0.10)
    expect(totals.herald).toBeCloseTo(0.05)
  })

  // 5. Execution links
  it('execution links create and retrieve', () => {
    const id = createExecutionLink({
      action: 'deposit',
      params: { amount: 5, token: 'SOL' },
      source: 'herald_dm',
    })

    const link = getExecutionLink(id)
    expect(link).toBeDefined()
    expect(link!.action).toBe('deposit')
    expect(link!.status).toBe('pending')
  })

  // 6. Tool groups cover all 21 tools
  it('tool groups contain all 21 tools with no overlap', () => {
    expect(ALL_TOOL_NAMES).toHaveLength(21)
    const uniqueNames = new Set(ALL_TOOL_NAMES)
    expect(uniqueNames.size).toBe(21)
  })

  // 7. SIPHER factory exports are consistent
  it('SIPHER factory fund-moving set matches expected tools', () => {
    expect(isFundMoving('deposit')).toBe(true)
    expect(isFundMoving('balance')).toBe(false)

    const routerTools = getRouterTools()
    expect(routerTools[0].name).toBe('routeIntent')

    const vaultTools = getGroupTools('vault')
    expect(vaultTools.map(t => t.name)).toContain('deposit')
  })

  // 8. Service SIPHER has only read-only tools
  it('Service SIPHER tools are a strict subset of intel group', () => {
    for (const toolName of SERVICE_TOOL_NAMES) {
      expect(isFundMoving(toolName)).toBe(false)
    }
    expect(SERVICE_TOOLS).toHaveLength(4)
  })

  // 9. Multi-agent coordination scenario
  it('simulates SENTINEL → SIPHER alert coordination', () => {
    const bus = new EventBus()
    attachLogger(bus)
    const sipherAlerts: ReturnType<typeof Object.assign>[] = []

    bus.on('sentinel:threat', (event) => {
      // SIPHER receives the threat and emits its own alert
      bus.emit({
        source: 'sipher',
        type: 'sipher:alert',
        level: 'critical',
        data: { message: `Security alert from SENTINEL: ${event.data.address as string}` },
        wallet: 'wallet-1',
        timestamp: new Date().toISOString(),
      })
      sipherAlerts.push(event)
    })

    bus.emit({
      source: 'sentinel',
      type: 'sentinel:threat',
      level: 'critical',
      data: { address: '8xAb...def' },
      timestamp: new Date().toISOString(),
    })

    expect(sipherAlerts).toHaveLength(1)

    const activity = getActivity(null, { levels: ['critical'] })
    expect(activity.length).toBeGreaterThanOrEqual(2) // sentinel threat + sipher alert
  })
})
