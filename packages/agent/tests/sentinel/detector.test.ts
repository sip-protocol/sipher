import { describe, it, expect } from 'vitest'
import {
  detectUnclaimedPayment,
  detectExpiredDeposit,
  detectThreat,
  detectLargeTransfer,
  detectBalanceChange,
  toGuardianEvent,
} from '../../src/sentinel/detector.js'

describe('detector', () => {
  it('detectUnclaimedPayment returns sentinel:unclaimed at important level', () => {
    const result = detectUnclaimedPayment({
      ephemeralPubkey: 'abc123',
      amount: 1.5,
      wallet: 'FGSk...BWr',
    })
    expect(result.event).toBe('sentinel:unclaimed')
    expect(result.level).toBe('important')
    expect(result.data.amount).toBe(1.5)
    expect(result.data.ephemeralPubkey).toBe('abc123')
    expect(result.wallet).toBe('FGSk...BWr')
  })

  it('detectExpiredDeposit below threshold sets autoRefund: true and level: important', () => {
    const result = detectExpiredDeposit({
      depositPda: 'pda1',
      amount: 0.05,
      wallet: 'FGSk...BWr',
      threshold: 1.0,
    })
    expect(result.event).toBe('sentinel:expired')
    expect(result.level).toBe('important')
    expect(result.data.autoRefund).toBe(true)
    expect(result.data.amount).toBe(0.05)
    expect(result.data.depositPda).toBe('pda1')
  })

  it('detectExpiredDeposit at or above threshold sets autoRefund: false and level: critical', () => {
    const result = detectExpiredDeposit({
      depositPda: 'pda2',
      amount: 2.0,
      wallet: 'FGSk...BWr',
      threshold: 1.0,
    })
    expect(result.event).toBe('sentinel:refund-pending')
    expect(result.level).toBe('critical')
    expect(result.data.autoRefund).toBe(false)
    expect(result.data.amount).toBe(2.0)
  })

  it('detectThreat returns sentinel:threat at critical level', () => {
    const result = detectThreat({
      address: 'badAddr',
      reason: 'flagged by Chainalysis',
      wallet: 'FGSk...BWr',
    })
    expect(result.event).toBe('sentinel:threat')
    expect(result.level).toBe('critical')
    expect(result.data.address).toBe('badAddr')
    expect(result.data.reason).toBe('flagged by Chainalysis')
    expect(result.wallet).toBe('FGSk...BWr')
  })

  it('detectLargeTransfer returns sentinel:large-transfer at important level', () => {
    const result = detectLargeTransfer({
      amount: 500,
      from: 'senderAddr',
      wallet: 'FGSk...BWr',
      threshold: 100,
    })
    expect(result.event).toBe('sentinel:large-transfer')
    expect(result.level).toBe('important')
    expect(result.data.amount).toBe(500)
    expect(result.data.from).toBe('senderAddr')
    expect(result.wallet).toBe('FGSk...BWr')
  })

  it('detectBalanceChange returns sentinel:balance with calculated delta', () => {
    const result = detectBalanceChange({
      previousBalance: 10,
      currentBalance: 7.5,
      wallet: 'FGSk...BWr',
    })
    expect(result.event).toBe('sentinel:balance')
    expect(result.level).toBe('important')
    expect(result.data.delta).toBeCloseTo(-2.5)
    expect(result.data.previousBalance).toBe(10)
    expect(result.data.currentBalance).toBe(7.5)
    expect(result.wallet).toBe('FGSk...BWr')
  })

  it('toGuardianEvent converts Detection to GuardianEvent shape without timestamp', () => {
    const detection = detectThreat({
      address: 'badAddr',
      reason: 'flagged',
      wallet: 'FGSk...BWr',
    })
    const event = toGuardianEvent(detection)
    expect(event.source).toBe('sentinel')
    expect(event.type).toBe('sentinel:threat')
    expect(event.level).toBe('critical')
    expect(event.data.address).toBe('badAddr')
    expect(event.wallet).toBe('FGSk...BWr')
    // timestamp is excluded from Omit<GuardianEvent, 'timestamp'>
    expect('timestamp' in event).toBe(false)
  })
})
