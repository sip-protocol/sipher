import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createPendingSigning,
  resolvePendingSigning,
  rejectPendingSigning,
  clearAllSigning,
  getPendingSigning,
  _setTimeoutMsForTests,
} from '../../src/sentinel/pending-signing.js'

const SAMPLE = {
  sessionId: 's1',
  toolName: 'send' as const,
  wallet: 'WalletABC',
  serializedTx: 'base64-tx',
  network: 'devnet' as const,
  toolInput: { amount: 1, token: 'SOL', recipient: 'alice.sol' },
}

describe('pending-signing registry', () => {
  beforeEach(() => {
    _setTimeoutMsForTests(60_000)
    for (const s of ['s1', 's2']) clearAllSigning(s)
  })

  it('createPendingSigning issues a unique flagId per call', () => {
    const a = createPendingSigning(SAMPLE)
    const b = createPendingSigning(SAMPLE)
    expect(a.flagId).not.toBe(b.flagId)
    a.promise.catch(() => {})
    b.promise.catch(() => {})
  })

  it('resolvePendingSigning resolves the promise with the provided signature', async () => {
    const { flagId, promise } = createPendingSigning(SAMPLE)
    const ok = resolvePendingSigning(flagId, 'SIG_XYZ_88_CHAR_BASE58')
    expect(ok).toBe(true)
    await expect(promise).resolves.toBe('SIG_XYZ_88_CHAR_BASE58')
  })

  it('resolvePendingSigning returns false on unknown flagId', () => {
    expect(resolvePendingSigning('nope', 'SIG')).toBe(false)
  })

  it('rejectPendingSigning rejects the promise with the given reason', async () => {
    const { flagId, promise } = createPendingSigning(SAMPLE)
    promise.catch(() => {})
    const ok = rejectPendingSigning(flagId, 'cancelled_by_user')
    expect(ok).toBe(true)
    await expect(promise).rejects.toThrow('cancelled_by_user')
  })

  it('timeout auto-rejects with "operation timed out"', async () => {
    _setTimeoutMsForTests(20)
    const { promise } = createPendingSigning(SAMPLE)
    await expect(promise).rejects.toThrow('operation timed out')
  })

  it('clearAllSigning rejects entries for the given sessionId with "client_disconnected"', async () => {
    const a = createPendingSigning({ ...SAMPLE, sessionId: 's1' })
    const b = createPendingSigning({ ...SAMPLE, sessionId: 's2' })
    a.promise.catch(() => {})
    clearAllSigning('s1')
    await expect(a.promise).rejects.toThrow('client_disconnected')
    expect(getPendingSigning(a.flagId)).toBeUndefined()
    expect(getPendingSigning(b.flagId)).toBeDefined()
    b.promise.catch(() => {})
  })

  it('getPendingSigning returns the full entry shape', () => {
    const { flagId, promise } = createPendingSigning(SAMPLE)
    promise.catch(() => {})
    const entry = getPendingSigning(flagId)
    expect(entry).toBeDefined()
    expect(entry?.sessionId).toBe('s1')
    expect(entry?.toolName).toBe('send')
    expect(entry?.wallet).toBe('WalletABC')
    expect(entry?.serializedTx).toBe('base64-tx')
    expect(entry?.network).toBe('devnet')
  })

  it('resolved entries are removed from the registry', () => {
    const { flagId } = createPendingSigning(SAMPLE)
    resolvePendingSigning(flagId, 'SIG')
    expect(getPendingSigning(flagId)).toBeUndefined()
  })

  it('rejected entries are removed from the registry', () => {
    const { flagId, promise } = createPendingSigning(SAMPLE)
    promise.catch(() => {})
    rejectPendingSigning(flagId, 'cancelled')
    expect(getPendingSigning(flagId)).toBeUndefined()
  })

  it('onExpire callback fires with flagId when timeout hits', async () => {
    _setTimeoutMsForTests(20)
    const onExpire = vi.fn()
    const { flagId, promise } = createPendingSigning({ ...SAMPLE, onExpire })
    promise.catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(onExpire).toHaveBeenCalledWith(flagId)
  })

  it('onExpire is NOT called when resolvePendingSigning runs first', async () => {
    const onExpire = vi.fn()
    const { flagId, promise } = createPendingSigning({ ...SAMPLE, onExpire })
    resolvePendingSigning(flagId, 'SIG')
    await expect(promise).resolves.toBe('SIG')
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('onExpire is NOT called when rejectPendingSigning runs first', async () => {
    const onExpire = vi.fn()
    const { flagId, promise } = createPendingSigning({ ...SAMPLE, onExpire })
    promise.catch(() => {})
    rejectPendingSigning(flagId, 'cancelled_by_user')
    await expect(promise).rejects.toThrow('cancelled_by_user')
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('rejection still fires even when onExpire throws (suppressed)', async () => {
    _setTimeoutMsForTests(20)
    const onExpire = vi.fn(() => {
      throw new Error('boom')
    })
    const { promise } = createPendingSigning({ ...SAMPLE, onExpire })
    await expect(promise).rejects.toThrow('operation timed out')
    expect(onExpire).toHaveBeenCalledTimes(1)
  })
})
