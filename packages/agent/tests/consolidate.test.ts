import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { closeDb, getScheduledOpsBySession, getOrCreateSession } from '../src/db.js'

vi.mock('@sipher/sdk', () => ({
  createConnection: vi.fn().mockReturnValue({
    getSignaturesForAddress: vi.fn().mockResolvedValue([]),
    getParsedTransactions: vi.fn().mockResolvedValue([]),
  }),
  scanForPayments: vi.fn().mockResolvedValue({
    payments: [
      { txSignature: 'tx1', stealthAddress: { toBase58: () => 'stealth1' }, transferAmount: 1000000000n, feeAmount: 5000000n, timestamp: 1700000000 },
      { txSignature: 'tx2', stealthAddress: { toBase58: () => 'stealth2' }, transferAmount: 2000000000n, feeAmount: 10000000n, timestamp: 1700000100 },
      { txSignature: 'tx3', stealthAddress: { toBase58: () => 'stealth3' }, transferAmount: 500000000n, feeAmount: 2500000n, timestamp: 1700000200 },
    ],
    eventsScanned: 100,
    hasMore: false,
  }),
}))

beforeEach(() => { process.env.DB_PATH = ':memory:' })
afterEach(() => { closeDb(); delete process.env.DB_PATH })

const { consolidateTool, executeConsolidate } = await import('../src/tools/consolidate.js')
const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'
const VIEW_KEY = 'ab'.repeat(32)
const SPEND_KEY = 'cd'.repeat(32)

describe('consolidate tool definition', () => {
  it('has correct name', () => { expect(consolidateTool.name).toBe('consolidate') })
})

describe('executeConsolidate', () => {
  it('creates staggered claim ops for unclaimed payments', async () => {
    const result = await executeConsolidate({
      wallet: WALLET, viewingKey: VIEW_KEY, spendingKey: SPEND_KEY, walletSignature: 'sig',
    })
    expect(result.action).toBe('consolidate')
    expect(result.claims).toHaveLength(3)
    expect(result.claims.every(c => c.opId)).toBe(true)
  })

  it('staggers claim times 1-4h apart', async () => {
    const result = await executeConsolidate({
      wallet: WALLET, viewingKey: VIEW_KEY, spendingKey: SPEND_KEY, walletSignature: 'sig',
    })
    for (let i = 1; i < result.claims.length; i++) {
      const gap = result.claims[i].executesAt - result.claims[i - 1].executesAt
      expect(gap).toBeGreaterThanOrEqual(55 * 60_000)   // ~1h min
      expect(gap).toBeLessThanOrEqual(4.5 * 3600_000)    // ~4h max
    }
  })

  it('creates scheduled_ops in DB', async () => {
    await executeConsolidate({
      wallet: WALLET, viewingKey: VIEW_KEY, spendingKey: SPEND_KEY, walletSignature: 'sig',
    })
    const session = getOrCreateSession(WALLET)
    const ops = getScheduledOpsBySession(session.id)
    expect(ops).toHaveLength(3)
    expect(ops.every(op => op.action === 'claim')).toBe(true)
  })

  it('throws when viewing key is missing', async () => {
    await expect(executeConsolidate({
      wallet: WALLET, spendingKey: SPEND_KEY, walletSignature: 'sig',
    } as any)).rejects.toThrow(/viewing/i)
  })
})
