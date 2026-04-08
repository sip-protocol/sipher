import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { closeDb, getScheduledOp } from '../src/db.js'

beforeEach(() => { process.env.DB_PATH = ':memory:' })
afterEach(() => { closeDb(); delete process.env.DB_PATH })

const { recurringTool, executeRecurring } = await import('../src/tools/recurring.js')
const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'

describe('recurring tool definition', () => {
  it('has correct name', () => { expect(recurringTool.name).toBe('recurring') })
  it('requires maxExecutions', () => {
    expect(recurringTool.input_schema.required).toContain('maxExecutions')
  })
})

describe('executeRecurring', () => {
  it('creates a single recurring scheduled op', async () => {
    const result = await executeRecurring({
      wallet: WALLET, amount: 500, token: 'USDC', recipient: 'addr',
      intervalDays: 14, maxExecutions: 6, walletSignature: 'sig',
    })
    expect(result.action).toBe('recurring')
    expect(result.scheduled.opId).toBeDefined()
    expect(result.scheduled.maxExecutions).toBe(6)
    expect(result.scheduled.intervalDays).toBe(14)

    const op = getScheduledOp(result.scheduled.opId)!
    expect(op.max_exec).toBe(6)
    expect(op.params.intervalMs).toBe(14 * 24 * 3600_000)
    expect(op.status).toBe('pending')
  })

  it('first execution is approximately intervalDays from now', async () => {
    const result = await executeRecurring({
      wallet: WALLET, amount: 100, token: 'SOL', recipient: 'addr',
      intervalDays: 7, maxExecutions: 4, walletSignature: 'sig',
    })
    const op = getScheduledOp(result.scheduled.opId)!
    const delayDays = (op.next_exec - Date.now()) / (24 * 3600_000)
    // Should be within ~1 day of 7 (jitter +-24h)
    expect(delayDays).toBeGreaterThan(5.5)
    expect(delayDays).toBeLessThan(8.5)
  })

  it('stores amountJitterPct in params', async () => {
    const result = await executeRecurring({
      wallet: WALLET, amount: 100, token: 'SOL', recipient: 'addr',
      intervalDays: 7, maxExecutions: 2, walletSignature: 'sig',
    })
    const op = getScheduledOp(result.scheduled.opId)!
    expect(op.params.amountJitterPct).toBe(0.05) // default 5%
  })

  it('throws when maxExecutions is missing', async () => {
    await expect(executeRecurring({
      wallet: WALLET, amount: 100, token: 'SOL', recipient: 'addr',
      intervalDays: 7, walletSignature: 'sig',
    } as any)).rejects.toThrow(/maxExecutions/i)
  })

  it('throws when intervalDays is zero', async () => {
    await expect(executeRecurring({
      wallet: WALLET, amount: 100, token: 'SOL', recipient: 'addr',
      intervalDays: 0, maxExecutions: 3, walletSignature: 'sig',
    })).rejects.toThrow(/interval/i)
  })

  it('sets expiry based on total schedule duration', async () => {
    const result = await executeRecurring({
      wallet: WALLET, amount: 100, token: 'SOL', recipient: 'addr',
      intervalDays: 7, maxExecutions: 4, walletSignature: 'sig',
    })
    const op = getScheduledOp(result.scheduled.opId)!
    // Expires after: maxExecutions * interval + buffer
    const expectedMinExpiry = Date.now() + 4 * 7 * 24 * 3600_000
    expect(op.expires_at).toBeGreaterThan(expectedMinExpiry)
  })
})
