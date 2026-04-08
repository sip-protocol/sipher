import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { closeDb, getScheduledOpsBySession, getOrCreateSession } from '../src/db.js'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

const { splitSendTool, executeSplitSend } = await import('../src/tools/split-send.js')

const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'

describe('splitSend tool definition', () => {
  it('has correct name', () => {
    expect(splitSendTool.name).toBe('splitSend')
  })
})

describe('executeSplitSend', () => {
  it('auto-determines 2 chunks for amount < 100', async () => {
    const result = await executeSplitSend({
      wallet: WALLET, amount: 50, token: 'SOL', recipient: 'addr', walletSignature: 'sig',
    })
    expect(result.chunks).toHaveLength(2)
    const total = result.chunks.reduce((s, c) => s + c.amount, 0)
    expect(total).toBeCloseTo(50, 4)
  })

  it('auto-determines 3 chunks for amount < 1000', async () => {
    const result = await executeSplitSend({
      wallet: WALLET, amount: 500, token: 'USDC', recipient: 'addr', walletSignature: 'sig',
    })
    expect(result.chunks).toHaveLength(3)
  })

  it('auto-determines 4 chunks for amount < 10000', async () => {
    const result = await executeSplitSend({
      wallet: WALLET, amount: 5000, token: 'USDC', recipient: 'addr', walletSignature: 'sig',
    })
    expect(result.chunks).toHaveLength(4)
  })

  it('auto-determines 5 chunks for amount >= 10000', async () => {
    const result = await executeSplitSend({
      wallet: WALLET, amount: 50000, token: 'USDC', recipient: 'addr', walletSignature: 'sig',
    })
    expect(result.chunks).toHaveLength(5)
  })

  it('respects user override for chunk count', async () => {
    const result = await executeSplitSend({
      wallet: WALLET, amount: 50, token: 'SOL', recipient: 'addr', chunks: 7, walletSignature: 'sig',
    })
    expect(result.chunks).toHaveLength(7)
  })

  it('chunk amounts sum to total', async () => {
    const result = await executeSplitSend({
      wallet: WALLET, amount: 1234.56, token: 'USDC', recipient: 'addr', walletSignature: 'sig',
    })
    const total = result.chunks.reduce((s, c) => s + c.amount, 0)
    expect(total).toBeCloseTo(1234.56, 2)
  })

  it('creates one scheduled_op per chunk', async () => {
    const result = await executeSplitSend({
      wallet: WALLET, amount: 100, token: 'SOL', recipient: 'addr', walletSignature: 'sig',
    })
    const session = getOrCreateSession(WALLET)
    const ops = getScheduledOpsBySession(session.id)
    expect(ops).toHaveLength(result.chunks.length)
    expect(ops.every(op => op.action === 'send')).toBe(true)
    expect(ops.every(op => op.max_exec === 1)).toBe(true)
  })

  it('staggers execution times over spread window', async () => {
    const result = await executeSplitSend({
      wallet: WALLET, amount: 200, token: 'SOL', recipient: 'addr', walletSignature: 'sig',
    })
    const times = result.chunks.map(c => c.executesAt)
    // Should be sorted ascending (or equal for close chunks)
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThanOrEqual(times[i - 1])
    }
    // Spread should be within 6 hours default (plus jitter tolerance)
    const spread = times[times.length - 1] - times[0]
    expect(spread).toBeLessThan(7 * 3600_000)
  })

  it('throws when amount is zero', async () => {
    await expect(executeSplitSend({
      wallet: WALLET, amount: 0, token: 'SOL', recipient: 'addr', walletSignature: 'sig',
    })).rejects.toThrow(/amount/i)
  })
})
