import { type Request, type Response } from 'express'
import { guardianBus, type GuardianEvent } from '../coordination/event-bus.js'

export function streamHandler(req: Request, res: Response): void {
  const wallet = (req as unknown as Record<string, unknown>).wallet as string

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  // Keepalive every 30s
  const keepalive = setInterval(() => {
    if (!res.writableEnded) res.write(': keepalive\n\n')
  }, 30_000)

  // Listen to all events, filter by wallet scope
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

  guardianBus.onAny(handler)

  res.on('close', () => {
    clearInterval(keepalive)
    guardianBus.offAny(handler)
  })
}
