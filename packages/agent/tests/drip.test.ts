import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { closeDb, getScheduledOpsBySession, getOrCreateSession } from '../src/db.js'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

const { dripTool, executeDrip } = await import('../src/tools/drip.js')

const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'

describe('drip tool definition', () => {
  it('has correct name', () => {
    expect(dripTool.name).toBe('drip')
  })
})

describe('executeDrip', () => {
  it('creates N drip ops over specified days', async () => {
    const result = await executeDrip({
      wallet: WALLET, amount: 1000, token: 'USDC', recipient: 'addr',
      days: 5, walletSignature: 'sig',
    })
    expect(result.action).toBe('drip')
    expect(result.drips).toHaveLength(5)
    const total = result.drips.reduce((s, d) => s + d.amount, 0)
    expect(total).toBeCloseTo(1000, 0)
  })

  it('amounts are randomized +-10% of equal split', async () => {
    const result = await executeDrip({
      wallet: WALLET, amount: 1000, token: 'USDC', recipient: 'addr',
      days: 10, walletSignature: 'sig',
    })
    const equalSplit = 100 // 1000 / 10
    for (const drip of result.drips) {
      expect(drip.amount).toBeGreaterThanOrEqual(equalSplit * 0.85)
      expect(drip.amount).toBeLessThanOrEqual(equalSplit * 1.15)
    }
  })

  it('spreads execution over the correct number of days', async () => {
    const result = await executeDrip({
      wallet: WALLET, amount: 500, token: 'SOL', recipient: 'addr',
      days: 5, walletSignature: 'sig',
    })
    const first = result.drips[0].executesAt
    const last = result.drips[result.drips.length - 1].executesAt
    const spreadDays = (last - first) / (24 * 3600_000)
    expect(spreadDays).toBeGreaterThan(3.5)
    expect(spreadDays).toBeLessThan(5.5)
  })

  it('creates scheduled_ops in DB', async () => {
    await executeDrip({
      wallet: WALLET, amount: 300, token: 'SOL', recipient: 'addr',
      days: 3, walletSignature: 'sig',
    })
    const session = getOrCreateSession(WALLET)
    const ops = getScheduledOpsBySession(session.id)
    expect(ops).toHaveLength(3)
    expect(ops.every(op => op.action === 'send')).toBe(true)
  })

  it('throws when days is less than 1', async () => {
    await expect(executeDrip({
      wallet: WALLET, amount: 100, token: 'SOL', recipient: 'addr',
      days: 0, walletSignature: 'sig',
    })).rejects.toThrow(/days/i)
  })

  it('defaults to 5 days when not specified', async () => {
    const result = await executeDrip({
      wallet: WALLET, amount: 500, token: 'SOL', recipient: 'addr', walletSignature: 'sig',
    })
    expect(result.drips).toHaveLength(5)
  })
})
