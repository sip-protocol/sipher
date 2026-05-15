import { describe, it, expect, vi } from 'vitest'
import type { Connection } from '@solana/web3.js'
import { verifySignature } from '../../src/sentinel/verify-signature.js'
import type { PendingSigningFlag } from '../../src/sentinel/pending-signing.js'

const ENTRY: PendingSigningFlag = {
  sessionId: 's1',
  toolName: 'send',
  wallet: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
  serializedTx: 'BASE64TX',
  network: 'devnet',
  toolInput: {},
  createdAt: 0,
  resolver: () => {},
  rejecter: () => {},
  timeoutHandle: setTimeout(() => {}, 0) as unknown as NodeJS.Timeout,
}
clearTimeout(ENTRY.timeoutHandle)

const SIGNATURE = '3QCoHcJ1NNg_fake_for_tests'

function makeConnection(overrides: Partial<{
  getSignatureStatuses: typeof Connection.prototype.getSignatureStatuses
  getTransaction: typeof Connection.prototype.getTransaction
}>): Connection {
  const conn = {
    getSignatureStatuses:
      overrides.getSignatureStatuses ??
      vi.fn().mockResolvedValue({ value: [null] }),
    getTransaction:
      overrides.getTransaction ?? vi.fn().mockResolvedValue(null),
  } as unknown as Connection
  return conn
}

describe('verifySignature', () => {
  it('returns ok when signature is confirmed and fee payer matches entry.wallet', async () => {
    const connection = makeConnection({
      getSignatureStatuses: vi.fn().mockResolvedValue({
        value: [{ slot: 42, confirmationStatus: 'confirmed', err: null }],
      }),
      getTransaction: vi.fn().mockResolvedValue({
        transaction: {
          message: {
            accountKeys: [
              { toBase58: () => ENTRY.wallet },
              { toBase58: () => 'Other11111111111111111111111111111111111111' },
            ],
          },
        },
      }),
    })

    const result = await verifySignature(SIGNATURE, ENTRY, { connection })
    expect(result).toEqual({ ok: true, slot: 42 })
  })

  it('accepts finalized confirmationStatus', async () => {
    const connection = makeConnection({
      getSignatureStatuses: vi.fn().mockResolvedValue({
        value: [{ slot: 99, confirmationStatus: 'finalized', err: null }],
      }),
      getTransaction: vi.fn().mockResolvedValue({
        transaction: {
          message: {
            accountKeys: [{ toBase58: () => ENTRY.wallet }],
          },
        },
      }),
    })

    const result = await verifySignature(SIGNATURE, ENTRY, { connection })
    expect(result.ok).toBe(true)
  })

  it('returns not_confirmed when getSignatureStatuses returns null', async () => {
    const connection = makeConnection({
      getSignatureStatuses: vi.fn().mockResolvedValue({ value: [null] }),
    })
    const result = await verifySignature(SIGNATURE, ENTRY, { connection })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('not_confirmed')
  })

  it('returns not_confirmed when err is set on the status', async () => {
    const connection = makeConnection({
      getSignatureStatuses: vi.fn().mockResolvedValue({
        value: [{ slot: 1, confirmationStatus: 'confirmed', err: { InstructionError: [0, 'Custom'] } }],
      }),
    })
    const result = await verifySignature(SIGNATURE, ENTRY, { connection })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('not_confirmed')
      expect(result.detail).toMatch(/InstructionError|Custom/)
    }
  })

  it('returns not_confirmed when confirmationStatus is "processed"', async () => {
    const connection = makeConnection({
      getSignatureStatuses: vi.fn().mockResolvedValue({
        value: [{ slot: 1, confirmationStatus: 'processed', err: null }],
      }),
    })
    const result = await verifySignature(SIGNATURE, ENTRY, { connection })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('not_confirmed')
  })

  it('returns wallet_mismatch when fee payer differs from entry.wallet', async () => {
    const connection = makeConnection({
      getSignatureStatuses: vi.fn().mockResolvedValue({
        value: [{ slot: 7, confirmationStatus: 'confirmed', err: null }],
      }),
      getTransaction: vi.fn().mockResolvedValue({
        transaction: {
          message: {
            accountKeys: [
              { toBase58: () => 'SomeOtherWallet11111111111111111111111111111' },
            ],
          },
        },
      }),
    })
    const result = await verifySignature(SIGNATURE, ENTRY, { connection })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('wallet_mismatch')
  })

  it('returns not_confirmed when getTransaction returns null after confirmed status', async () => {
    const connection = makeConnection({
      getSignatureStatuses: vi.fn().mockResolvedValue({
        value: [{ slot: 7, confirmationStatus: 'confirmed', err: null }],
      }),
      getTransaction: vi.fn().mockResolvedValue(null),
    })
    const result = await verifySignature(SIGNATURE, ENTRY, { connection })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('not_confirmed')
  })

  it('returns rpc_error when getSignatureStatuses throws', async () => {
    const connection = makeConnection({
      getSignatureStatuses: vi.fn().mockRejectedValue(new Error('connect ETIMEDOUT')),
    })
    const result = await verifySignature(SIGNATURE, ENTRY, { connection })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('rpc_error')
      expect(result.detail).toMatch(/ETIMEDOUT/)
    }
  })

  it('returns rpc_error when getTransaction throws', async () => {
    const connection = makeConnection({
      getSignatureStatuses: vi.fn().mockResolvedValue({
        value: [{ slot: 5, confirmationStatus: 'confirmed', err: null }],
      }),
      getTransaction: vi.fn().mockRejectedValue(new Error('rpc 500')),
    })
    const result = await verifySignature(SIGNATURE, ENTRY, { connection })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('rpc_error')
  })

  it('returns timeout when verification exceeds timeoutMs', async () => {
    const connection = makeConnection({
      getSignatureStatuses: vi.fn().mockImplementation(
        () => new Promise(() => {}), // never resolves
      ),
    })
    const result = await verifySignature(SIGNATURE, ENTRY, { connection, timeoutMs: 30 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('timeout')
  })
})
