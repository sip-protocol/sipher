import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { closeDb, getScheduledOp, getScheduledOpsBySession, getOrCreateSession } from '../src/db.js'

beforeEach(() => { process.env.DB_PATH = ':memory:' })
afterEach(() => { closeDb(); delete process.env.DB_PATH })

const { sweepTool, executeSweep } = await import('../src/tools/sweep.js')
const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'

describe('sweep tool definition', () => {
  it('has correct name', () => { expect(sweepTool.name).toBe('sweep') })
})

describe('executeSweep', () => {
  it('creates a persistent sweep scheduled op', async () => {
    const result = await executeSweep({
      wallet: WALLET, token: 'SOL', walletSignature: 'sig',
    })
    expect(result.action).toBe('sweep')
    expect(result.status).toBe('success')
    expect(result.sweep.opId).toBeDefined()

    const op = getScheduledOp(result.sweep.opId)!
    expect(op.action).toBe('sweep')
    expect(op.params.wallet).toBe(WALLET)
    expect(op.params.token).toBe('SOL')
    expect(op.max_exec).toBeGreaterThan(1000)
    expect(op.status).toBe('pending')
  })

  it('sets next_exec to near-immediate', async () => {
    const result = await executeSweep({
      wallet: WALLET, token: 'SOL', walletSignature: 'sig',
    })
    const op = getScheduledOp(result.sweep.opId)!
    expect(op.next_exec - Date.now()).toBeLessThan(61_000)
  })

  it('sets long expiry (30 days default)', async () => {
    const result = await executeSweep({
      wallet: WALLET, token: 'SOL', walletSignature: 'sig',
    })
    const op = getScheduledOp(result.sweep.opId)!
    const thirtyDays = 30 * 24 * 3600_000
    expect(op.expires_at - Date.now()).toBeGreaterThan(thirtyDays - 60_000)
  })

  it('throws when wallet is missing', async () => {
    await expect(executeSweep({ token: 'SOL', walletSignature: 'sig' } as any))
      .rejects.toThrow(/wallet/i)
  })

  it('prevents duplicate sweep for same wallet+token', async () => {
    await executeSweep({ wallet: WALLET, token: 'SOL', walletSignature: 'sig' })
    await expect(executeSweep({ wallet: WALLET, token: 'SOL', walletSignature: 'sig' }))
      .rejects.toThrow(/already.*active/i)
  })
})
