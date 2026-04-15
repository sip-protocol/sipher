import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { Request, Response } from 'express'
import { streamHandler } from '../../src/routes/stream.js'
import { guardianBus } from '../../src/coordination/event-bus.js'

// ─────────────────────────────────────────────────────────────────────────────
// streamHandler — SSE subscriber to guardianBus.
// Tested at the handler boundary: call with a mock (req, res), emit through
// guardianBus, observe what res.write received. Avoids real HTTP so the tests
// are deterministic (no SSE-connection timing).
// ─────────────────────────────────────────────────────────────────────────────

const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'
const OTHER_WALLET = 'OtherWallet111111111111111111111111111111111'

interface Recorded {
  headers: Record<string, string>
  writes: string[]
  ended: boolean
}

function mockReqRes(wallet: string): { req: Request; res: Response; recorded: Recorded } {
  const recorded: Recorded = { headers: {}, writes: [], ended: false }

  const req = { } as unknown as Request
  ;(req as unknown as Record<string, unknown>).wallet = wallet

  const listeners: Record<string, Array<() => void>> = {}
  const res = {
    setHeader(name: string, value: string | number) {
      recorded.headers[name.toLowerCase()] = String(value)
    },
    flushHeaders() {},
    write(chunk: string) {
      recorded.writes.push(chunk)
      return true
    },
    get writableEnded() {
      return recorded.ended
    },
    end() {
      recorded.ended = true
    },
    on(event: string, cb: () => void) {
      listeners[event] = listeners[event] ?? []
      listeners[event].push(cb)
      return res as unknown as Response
    },
  } as unknown as Response

  ;(res as unknown as { __fire: (event: string) => void }).__fire = (event: string) => {
    for (const cb of listeners[event] ?? []) cb()
  }

  return { req, res, recorded }
}

/** Parse a chunk like "event: activity\ndata: {json}\n\n" into { event, data } */
function parseSse(chunk: string): { event: string; data: unknown } {
  const lines = chunk.trim().split('\n')
  const event = lines.find((l) => l.startsWith('event: '))?.slice(7) ?? ''
  const data = lines.find((l) => l.startsWith('data: '))?.slice(6) ?? ''
  return { event, data: JSON.parse(data) }
}

describe('streamHandler', () => {
  let fire: (event: string) => void

  beforeEach(() => {
    guardianBus.removeAllListeners()
  })

  afterEach(() => {
    guardianBus.removeAllListeners()
    if (fire) fire('close')
  })

  it('sets SSE headers correctly', () => {
    const { req, res, recorded } = mockReqRes(WALLET)
    fire = (res as unknown as { __fire: (e: string) => void }).__fire
    streamHandler(req, res)

    expect(recorded.headers['content-type']).toBe('text/event-stream')
    expect(recorded.headers['cache-control']).toBe('no-cache')
    expect(recorded.headers['connection']).toBe('keep-alive')
    expect(recorded.headers['x-accel-buffering']).toBe('no')
  })

  it('streams events from bus', () => {
    const { req, res, recorded } = mockReqRes(WALLET)
    fire = (res as unknown as { __fire: (e: string) => void }).__fire
    streamHandler(req, res)

    guardianBus.emit({
      source: 'sipher',
      type: 'sipher:action',
      level: 'important',
      data: { tool: 'deposit', amount: 2 },
      wallet: WALLET,
      timestamp: new Date().toISOString(),
    })

    expect(recorded.writes).toHaveLength(1)
    const parsed = parseSse(recorded.writes[0])
    expect(parsed.event).toBe('activity')
    const payload = parsed.data as Record<string, unknown>
    expect(payload.agent).toBe('sipher')
    expect(payload.type).toBe('sipher:action')
    expect(payload.level).toBe('important')
    expect(payload.id).toBeDefined()
    expect(payload.timestamp).toBeDefined()
  })

  it('filters out routine level events', () => {
    const { req, res, recorded } = mockReqRes(WALLET)
    fire = (res as unknown as { __fire: (e: string) => void }).__fire
    streamHandler(req, res)

    guardianBus.emit({
      source: 'sipher',
      type: 'sipher:routine',
      level: 'routine',
      data: { status: 'ok' },
      wallet: WALLET,
      timestamp: new Date().toISOString(),
    })
    guardianBus.emit({
      source: 'sentinel',
      type: 'sentinel:threat',
      level: 'critical',
      data: { threat: 'suspicious_activity' },
      wallet: WALLET,
      timestamp: new Date().toISOString(),
    })

    expect(recorded.writes).toHaveLength(1)
    const parsed = parseSse(recorded.writes[0])
    expect((parsed.data as Record<string, unknown>).level).toBe('critical')
  })

  it('filters out events for other wallets', () => {
    const { req, res, recorded } = mockReqRes(WALLET)
    fire = (res as unknown as { __fire: (e: string) => void }).__fire
    streamHandler(req, res)

    guardianBus.emit({
      source: 'sipher',
      type: 'sipher:action',
      level: 'important',
      data: { tool: 'swap' },
      wallet: OTHER_WALLET,
      timestamp: new Date().toISOString(),
    })
    guardianBus.emit({
      source: 'sipher',
      type: 'sipher:action',
      level: 'important',
      data: { tool: 'deposit' },
      wallet: WALLET,
      timestamp: new Date().toISOString(),
    })

    expect(recorded.writes).toHaveLength(1)
    const parsed = parseSse(recorded.writes[0])
    expect((parsed.data as { data: { tool: string } }).data.tool).toBe('deposit')
  })

  it('allows events with null wallet (broadcasts)', () => {
    const { req, res, recorded } = mockReqRes(WALLET)
    fire = (res as unknown as { __fire: (e: string) => void }).__fire
    streamHandler(req, res)

    guardianBus.emit({
      source: 'courier',
      type: 'courier:broadcast',
      level: 'important',
      data: { msg: 'system_update' },
      wallet: null,
      timestamp: new Date().toISOString(),
    })

    expect(recorded.writes).toHaveLength(1)
    const parsed = parseSse(recorded.writes[0])
    expect((parsed.data as { data: { msg: string } }).data.msg).toBe('system_update')
    expect(parsed.event).toBe('confirm') // courier:* maps to 'confirm'
  })
})
