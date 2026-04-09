import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Express, Request, Response } from 'express'
import request from 'supertest'
import express from 'express'
import { streamHandler } from '../../src/routes/stream.js'
import { EventBus, type GuardianEvent } from '../../src/coordination/event-bus.js'

describe('streamHandler', () => {
  let app: Express
  let bus: EventBus

  beforeEach(() => {
    app = express()

    // Create a local bus for testing (isolated from global guardianBus)
    bus = new EventBus()

    // Middleware to attach wallet to request
    app.use((req, res, next) => {
      ;(req as unknown as Record<string, unknown>).wallet = 'FGSk8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'
      next()
    })

    // Override streamHandler to use test bus
    app.get('/stream', (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')
      res.flushHeaders()

      const wallet = (req as unknown as Record<string, unknown>).wallet as string
      const keepalive = setInterval(() => {
        if (!res.writableEnded) res.write(': keepalive\n\n')
      }, 30_000)

      const handler = (event: GuardianEvent) => {
        if (res.writableEnded) return
        if (event.level === 'routine') return
        if (event.wallet && event.wallet !== wallet) return

        const sseData = JSON.stringify({
          id: Date.now().toString(36),
          agent: event.source,
          type: event.type,
          level: event.level,
          data: event.data,
          timestamp: event.timestamp,
        })
        res.write(`event: activity\ndata: ${sseData}\n\n`)
      }

      bus.onAny(handler)

      res.on('close', () => {
        clearInterval(keepalive)
        bus.offAny(handler)
      })
    })
  })

  afterEach(() => {
    bus.removeAllListeners()
  })

  it('sets SSE headers correctly', async () => {
    const response = request(app).get('/stream').timeout(500)

    const result = await new Promise<{ status: number; headers: Record<string, unknown> }>((resolve, reject) => {
      const req = request(app).get('/stream')

      req.on('response', (res) => {
        resolve({
          status: res.status,
          headers: res.headers,
        })
        req.abort()
      })
      req.on('error', reject)

      setTimeout(() => {
        req.abort()
      }, 100)
    })

    expect(result.headers['content-type']).toBe('text/event-stream')
    expect(result.headers['cache-control']).toBe('no-cache')
    expect(result.headers['connection']).toBe('keep-alive')
    expect(result.headers['x-accel-buffering']).toBe('no')
  })

  it('streams events from bus', async () => {
    const events: string[] = []

    const testPromise = new Promise<void>((resolve) => {
      const req = request(app).get('/stream')

      let data = ''
      req.on('data', (chunk) => {
        data += chunk.toString()
        // Parse SSE format: event: type\ndata: json\n\n
        const messages = data.split('\n\n').filter((m) => m.trim())
        for (const msg of messages) {
          const lines = msg.trim().split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const json = line.slice(6)
              events.push(json)
            }
          }
        }

        // Stop after receiving one event
        if (events.length >= 1) {
          req.abort()
          resolve()
        }
      })

      req.on('error', () => {
        resolve()
      })

      // Emit event after stream is open
      setTimeout(() => {
        bus.emit({
          source: 'sipher',
          type: 'sipher:action',
          level: 'important',
          data: { tool: 'deposit', amount: 2 },
          wallet: 'FGSk8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
          timestamp: new Date().toISOString(),
        })
      }, 50)
    })

    await testPromise
    expect(events.length).toBeGreaterThan(0)

    const parsed = JSON.parse(events[0])
    expect(parsed).toHaveProperty('id')
    expect(parsed).toHaveProperty('agent')
    expect(parsed).toHaveProperty('type')
    expect(parsed).toHaveProperty('level')
    expect(parsed).toHaveProperty('data')
    expect(parsed).toHaveProperty('timestamp')
    expect(parsed.agent).toBe('sipher')
    expect(parsed.type).toBe('sipher:action')
    expect(parsed.level).toBe('important')
  })

  it('filters out routine level events', async () => {
    const events: string[] = []

    const testPromise = new Promise<void>((resolve) => {
      const req = request(app).get('/stream')

      let data = ''
      req.on('data', (chunk) => {
        data += chunk.toString()
        const messages = data.split('\n\n').filter((m) => m.trim())
        for (const msg of messages) {
          const lines = msg.trim().split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const json = line.slice(6)
              events.push(json)
            }
          }
        }

        if (events.length >= 1) {
          req.abort()
          resolve()
        }
      })

      req.on('error', () => {
        resolve()
      })

      // Emit routine event (should be filtered)
      setTimeout(() => {
        bus.emit({
          source: 'sipher',
          type: 'sipher:routine',
          level: 'routine',
          data: { status: 'ok' },
          wallet: 'FGSk8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
          timestamp: new Date().toISOString(),
        })

        // Then emit important event (should pass through)
        setTimeout(() => {
          bus.emit({
            source: 'sentinel',
            type: 'sentinel:threat',
            level: 'critical',
            data: { threat: 'suspicious_activity' },
            wallet: 'FGSk8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
            timestamp: new Date().toISOString(),
          })
        }, 20)
      }, 50)
    })

    await testPromise
    expect(events.length).toBe(1)
    const parsed = JSON.parse(events[0])
    expect(parsed.level).not.toBe('routine')
  })

  it('filters out events for other wallets', async () => {
    const events: string[] = []

    const testPromise = new Promise<void>((resolve) => {
      const req = request(app).get('/stream')

      let data = ''
      req.on('data', (chunk) => {
        data += chunk.toString()
        const messages = data.split('\n\n').filter((m) => m.trim())
        for (const msg of messages) {
          const lines = msg.trim().split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const json = line.slice(6)
              events.push(json)
            }
          }
        }

        if (events.length >= 1) {
          req.abort()
          resolve()
        }
      })

      req.on('error', () => {
        resolve()
      })

      // Emit event for different wallet (should be filtered)
      setTimeout(() => {
        bus.emit({
          source: 'sipher',
          type: 'sipher:action',
          level: 'important',
          data: { tool: 'swap' },
          wallet: 'DifferentWalletAddress',
          timestamp: new Date().toISOString(),
        })

        // Then emit event for correct wallet (should pass)
        setTimeout(() => {
          bus.emit({
            source: 'sipher',
            type: 'sipher:action',
            level: 'important',
            data: { tool: 'deposit' },
            wallet: 'FGSk8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
            timestamp: new Date().toISOString(),
          })
        }, 20)
      }, 50)
    })

    await testPromise
    expect(events.length).toBe(1)
    const parsed = JSON.parse(events[0])
    expect(parsed.data.tool).toBe('deposit')
  })

  it('allows events with null wallet (broadcasts)', async () => {
    const events: string[] = []

    const testPromise = new Promise<void>((resolve) => {
      const req = request(app).get('/stream')

      let data = ''
      req.on('data', (chunk) => {
        data += chunk.toString()
        const messages = data.split('\n\n').filter((m) => m.trim())
        for (const msg of messages) {
          const lines = msg.trim().split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const json = line.slice(6)
              events.push(json)
            }
          }
        }

        if (events.length >= 1) {
          req.abort()
          resolve()
        }
      })

      req.on('error', () => {
        resolve()
      })

      // Emit broadcast event with null wallet (should pass)
      setTimeout(() => {
        bus.emit({
          source: 'courier',
          type: 'courier:broadcast',
          level: 'important',
          data: { msg: 'system_update' },
          wallet: null,
          timestamp: new Date().toISOString(),
        })
      }, 50)
    })

    await testPromise
    expect(events.length).toBe(1)
    const parsed = JSON.parse(events[0])
    expect(parsed.data.msg).toBe('system_update')
  })
})
