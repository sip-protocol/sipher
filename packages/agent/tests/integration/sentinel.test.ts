import { describe, it, expect, vi } from 'vitest'

// Mock @sipher/sdk — matches exactly what scanner.ts imports:
//   createConnection, getVaultBalance, scanForPayments, WSOL_MINT
vi.mock('@sipher/sdk', () => ({
  createConnection: vi.fn(() => ({})),
  getVaultBalance: vi.fn().mockResolvedValue({
    balance: BigInt(5_000_000_000),
    available: BigInt(5_000_000_000),
    exists: true,
  }),
  scanForPayments: vi.fn().mockResolvedValue({
    payments: [],
    eventsScanned: 0,
    hasMore: false,
  }),
  WSOL_MINT: { toBase58: () => 'So11111111111111111111111111111111111111112' },
}))

import { EventBus } from '../../src/coordination/event-bus.js'
import { SentinelWorker, SENTINEL_IDENTITY } from '../../src/sentinel/sentinel.js'
import { getSentinelConfig } from '../../src/sentinel/config.js'
import { shouldAutoRefund, isRefundSafe, generateIdempotencyKey } from '../../src/sentinel/refund-guard.js'
import { detectExpiredDeposit, detectThreat, toGuardianEvent } from '../../src/sentinel/detector.js'

describe('SENTINEL Integration', () => {
  it('SENTINEL_IDENTITY is correct', () => {
    expect(SENTINEL_IDENTITY.name).toBe('SENTINEL')
    expect(SENTINEL_IDENTITY.role).toBe('Blockchain Monitor')
    expect(SENTINEL_IDENTITY.llm).toBe(false)
  })

  it('config + refund-guard work together', () => {
    const config = getSentinelConfig()
    expect(shouldAutoRefund(0.5, config.autoRefundThreshold)).toBe(true)
    expect(shouldAutoRefund(5, config.autoRefundThreshold)).toBe(false)
  })

  it('detector → toGuardianEvent → EventBus flow', () => {
    const bus = new EventBus()
    const received: any[] = []
    bus.on('sentinel:threat', (e) => received.push(e))
    const detection = detectThreat({ address: '8xAb', reason: 'OFAC', wallet: 'w1' })
    const event = toGuardianEvent(detection)
    bus.emit({ ...event, timestamp: new Date().toISOString() })
    expect(received).toHaveLength(1)
    expect(received[0].level).toBe('critical')
  })

  it('worker lifecycle', () => {
    const worker = new SentinelWorker()
    worker.addWallet('wallet-1')
    expect(worker.getWallets()).toEqual(['wallet-1'])
    worker.start()
    expect(worker.isRunning()).toBe(true)
    worker.stop()
    expect(worker.isRunning()).toBe(false)
  })

  it('refund guard idempotency', () => {
    const key1 = generateIdempotencyKey('pda-1', 1700000000)
    const key2 = generateIdempotencyKey('pda-1', 1700000000)
    expect(key1).toBe(key2)
    expect(isRefundSafe('pda-1', [])).toBe(true)
  })

  it('expired deposit detection branches', () => {
    const small = detectExpiredDeposit({ depositPda: 'p1', amount: 0.3, wallet: 'w1', threshold: 1 })
    expect(small.data.autoRefund).toBe(true)
    const large = detectExpiredDeposit({ depositPda: 'p2', amount: 5, wallet: 'w1', threshold: 1 })
    expect(large.data.autoRefund).toBe(false)
  })
})
