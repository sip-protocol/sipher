import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { closeDb, getScheduledOp } from '../src/db.js'

beforeEach(() => { process.env.DB_PATH = ':memory:' })
afterEach(() => { closeDb(); delete process.env.DB_PATH })

const { scheduleSendTool, executeScheduleSend } = await import('../src/tools/schedule-send.js')

describe('scheduleSend tool definition', () => {
  it('has correct name', () => { expect(scheduleSendTool.name).toBe('scheduleSend') })
  it('requires wallet, amount, token, recipient', () => {
    const req = scheduleSendTool.input_schema.required as string[]
    expect(req).toContain('wallet')
    expect(req).toContain('amount')
    expect(req).toContain('token')
    expect(req).toContain('recipient')
  })
})

describe('executeScheduleSend', () => {
  it('creates a scheduled op with exact delay', async () => {
    const result = await executeScheduleSend({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 100, token: 'USDC', recipient: 'RecipientAddr11111111111111111111',
      delayMinutes: 60, walletSignature: 'sig123',
    })
    expect(result.action).toBe('scheduleSend')
    expect(result.status).toBe('success')
    expect(result.scheduled.opId).toBeDefined()
    expect(result.scheduled.executesAt).toBeGreaterThan(Date.now() + 55 * 60_000)
    const op = getScheduledOp(result.scheduled.opId)!
    expect(op.action).toBe('send')
    expect(op.params.amount).toBe(100)
    expect(op.max_exec).toBe(1)
    expect(op.status).toBe('pending')
  })

  it('creates a scheduled op with random delay range', async () => {
    const result = await executeScheduleSend({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 50, token: 'SOL', recipient: 'RecipientAddr11111111111111111111',
      delayMinutesMin: 60, delayMinutesMax: 120, walletSignature: 'sig',
    })
    const op = getScheduledOp(result.scheduled.opId)!
    const delayMs = op.next_exec - Date.now()
    expect(delayMs).toBeGreaterThan(55 * 60_000)
    expect(delayMs).toBeLessThan(125 * 60_000)
  })

  it('defaults delay to 30-60 minutes when not specified', async () => {
    const result = await executeScheduleSend({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 10, token: 'SOL', recipient: 'RecipientAddr11111111111111111111',
      walletSignature: 'sig',
    })
    const op = getScheduledOp(result.scheduled.opId)!
    const delayMs = op.next_exec - Date.now()
    expect(delayMs).toBeGreaterThan(25 * 60_000)
    expect(delayMs).toBeLessThan(65 * 60_000)
  })

  it('sets expiry to delay + 1 hour', async () => {
    const result = await executeScheduleSend({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 10, token: 'SOL', recipient: 'addr',
      delayMinutes: 60, walletSignature: 'sig',
    })
    const op = getScheduledOp(result.scheduled.opId)!
    expect(op.expires_at).toBeGreaterThan(op.next_exec + 50 * 60_000)
  })

  it('throws when wallet is missing', async () => {
    await expect(executeScheduleSend({
      amount: 10, token: 'SOL', recipient: 'addr', walletSignature: 'sig',
    } as any)).rejects.toThrow(/wallet/i)
  })

  it('throws when amount is zero', async () => {
    await expect(executeScheduleSend({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 0, token: 'SOL', recipient: 'addr', walletSignature: 'sig',
    })).rejects.toThrow(/amount/i)
  })
})
