import { describe, expect, it, vi } from 'vitest'
import type { Connection } from '@solana/web3.js'
import {
  sendAndConfirmWithRetry,
  TransactionFailedOnChainError,
} from '../../src/lib/sendWithRetry.js'

const FAKE_SIGNATURE = '5J7XHm...fake'
const FAKE_BLOCKHASH = 'HF3...fake'
const FAKE_BYTES = new Uint8Array([1, 2, 3])
const LAST_VALID_HEIGHT = 100

function makeConnection(overrides: Partial<Connection> = {}): Connection {
  return {
    sendRawTransaction: vi.fn(async () => FAKE_SIGNATURE),
    confirmTransaction: vi.fn(async () => ({ value: { err: null } })),
    getSignatureStatuses: vi.fn(async () => ({ value: [null] })),
    ...overrides,
  } as unknown as Connection
}

// Deterministic sleep: tracks elapsed virtual ms and resolves immediately.
function makeFakeSleep() {
  const sleeps: number[] = []
  return {
    sleeps,
    sleep: (ms: number) => {
      sleeps.push(ms)
      return Promise.resolve()
    },
  }
}

describe('sendAndConfirmWithRetry (backend)', () => {
  it('returns signature on happy-path confirmation', async () => {
    // Uses real setTimeout (no injected sleep) so the resubmit loop's
    // first tick is a macrotask, not a microtask. confirmTransaction mock
    // resolves via microtask first, setting stopped=true before the timer
    // fires. Mirrors the FE original's approach. The resubmit loop exits
    // on the first tick (if (stopped) return).
    const conn = makeConnection()

    const sig = await sendAndConfirmWithRetry(
      conn,
      FAKE_BYTES,
      FAKE_BLOCKHASH,
      LAST_VALID_HEIGHT,
      { resubmitIntervalMs: 1 },
    )

    expect(sig).toBe(FAKE_SIGNATURE)
    expect(conn.sendRawTransaction).toHaveBeenCalledTimes(1)
    expect(conn.sendRawTransaction).toHaveBeenCalledWith(FAKE_BYTES, {
      skipPreflight: true,
      maxRetries: 0,
    })
    expect(conn.confirmTransaction).toHaveBeenCalledOnce()
    expect(conn.confirmTransaction).toHaveBeenCalledWith(
      { signature: FAKE_SIGNATURE, blockhash: FAKE_BLOCKHASH, lastValidBlockHeight: LAST_VALID_HEIGHT },
      'confirmed',
    )
  })

  it('resubmits while confirmation is pending', async () => {
    let resolveConfirm: (v: { value: { err: null } }) => void = () => {}
    const conn = makeConnection({
      confirmTransaction: vi.fn(
        () => new Promise<{ value: { err: null } }>((r) => { resolveConfirm = r }),
      ) as unknown as Connection['confirmTransaction'],
    })
    const { sleep, sleeps } = makeFakeSleep()

    const pending = sendAndConfirmWithRetry(
      conn,
      FAKE_BYTES,
      FAKE_BLOCKHASH,
      LAST_VALID_HEIGHT,
      { sleep, resubmitIntervalMs: 1 },
    )

    // Yield enough microtasks for the resubmit loop to fire at least twice
    for (let i = 0; i < 10; i++) await Promise.resolve()

    // Now resolve confirmation
    resolveConfirm({ value: { err: null } })
    const sig = await pending

    expect(sig).toBe(FAKE_SIGNATURE)
    expect((conn.sendRawTransaction as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1)
    expect(sleeps.length).toBeGreaterThan(0)
  })

  it('swallows resubmit errors without failing the outer promise', async () => {
    let firstCall = true
    const conn = makeConnection({
      sendRawTransaction: vi.fn(async () => {
        if (firstCall) { firstCall = false; return FAKE_SIGNATURE }
        throw new Error('429 Too Many Requests')
      }) as unknown as Connection['sendRawTransaction'],
    })
    const { sleep } = makeFakeSleep()

    const sig = await sendAndConfirmWithRetry(
      conn,
      FAKE_BYTES,
      FAKE_BLOCKHASH,
      LAST_VALID_HEIGHT,
      { sleep, resubmitIntervalMs: 1 },
    )

    expect(sig).toBe(FAKE_SIGNATURE)
  })

  it('propagates first-send errors and stops the loop', async () => {
    const conn = makeConnection({
      sendRawTransaction: vi.fn(async () => {
        throw new Error('SendTransactionError: invalid signature')
      }) as unknown as Connection['sendRawTransaction'],
    })
    const { sleep } = makeFakeSleep()

    await expect(
      sendAndConfirmWithRetry(conn, FAKE_BYTES, FAKE_BLOCKHASH, LAST_VALID_HEIGHT, {
        sleep,
        resubmitIntervalMs: 1,
      }),
    ).rejects.toThrow('SendTransactionError')
  })

  it('propagates blockheight-exceeded errors from confirmTransaction', async () => {
    const expired = new Error('TransactionExpiredBlockheightExceededError')
    expired.name = 'TransactionExpiredBlockheightExceededError'
    const conn = makeConnection({
      confirmTransaction: vi.fn(async () => { throw expired }) as unknown as Connection['confirmTransaction'],
    })
    const { sleep } = makeFakeSleep()

    await expect(
      sendAndConfirmWithRetry(conn, FAKE_BYTES, FAKE_BLOCKHASH, LAST_VALID_HEIGHT, {
        sleep,
        resubmitIntervalMs: 1,
      }),
    ).rejects.toMatchObject({ name: 'TransactionExpiredBlockheightExceededError' })
  })

  it('throws TransactionFailedOnChainError when confirmTransaction resolves with non-null err', async () => {
    // The current bug (sipher#299): we used to discard confirmTransaction's
    // result and return signature even when value.err was non-null. The fix
    // is to inspect the result and throw a typed error so /api/tx/broadcast
    // can return 502 TX_FAILED_ON_CHAIN instead of 200 with a failed signature.
    const programErr = { InstructionError: [0, { Custom: 3012 }] }
    const conn = makeConnection({
      confirmTransaction: vi.fn(async () => ({ value: { err: programErr } })) as unknown as Connection['confirmTransaction'],
    })

    await expect(
      sendAndConfirmWithRetry(conn, FAKE_BYTES, FAKE_BLOCKHASH, LAST_VALID_HEIGHT, {
        resubmitIntervalMs: 1,
      }),
    ).rejects.toBeInstanceOf(TransactionFailedOnChainError)

    // The thrown error must expose signature + err so the route handler can
    // build a structured 502 envelope.
    try {
      await sendAndConfirmWithRetry(conn, FAKE_BYTES, FAKE_BLOCKHASH, LAST_VALID_HEIGHT, {
        resubmitIntervalMs: 1,
      })
    } catch (e) {
      expect(e).toBeInstanceOf(TransactionFailedOnChainError)
      const failed = e as TransactionFailedOnChainError
      expect(failed.signature).toBe(FAKE_SIGNATURE)
      expect(failed.err).toEqual(programErr)
    }
  })

  it('throws TransactionFailedOnChainError when getSignatureStatuses detects err before confirmation', async () => {
    // Defense-in-depth path (sipher#299 Option 3): if confirmTransaction's
    // WebSocket subscription is slow to fire, the parallel getSignatureStatuses
    // poll detects the program error first and bails immediately instead of
    // letting the request hang until CF cuts off at 100s.
    const programErr = { InstructionError: [0, { Custom: 1 }] }
    const conn = makeConnection({
      // Never resolves — forces the poll to win the race.
      confirmTransaction: vi.fn(() => new Promise(() => {})) as unknown as Connection['confirmTransaction'],
      getSignatureStatuses: vi.fn(async () => ({
        value: [{ slot: 100, confirmations: null, err: programErr, confirmationStatus: 'confirmed' }],
      })) as unknown as Connection['getSignatureStatuses'],
    })
    const { sleep } = makeFakeSleep()

    await expect(
      sendAndConfirmWithRetry(conn, FAKE_BYTES, FAKE_BLOCKHASH, LAST_VALID_HEIGHT, {
        sleep,
        resubmitIntervalMs: 1,
      }),
    ).rejects.toMatchObject({
      name: 'TransactionFailedOnChainError',
      signature: FAKE_SIGNATURE,
      err: programErr,
    })
  })

  it('keeps polling while status is null and resolves on success', async () => {
    // While the tx is pending (RPC has not yet seen it OR returned no err),
    // the poll should not throw. Confirmation eventually resolves with no err
    // and we return the signature.
    let confirmCallCount = 0
    let resolveConfirm: (v: { value: { err: null } }) => void = () => {}
    const conn = makeConnection({
      confirmTransaction: vi.fn(() => {
        confirmCallCount += 1
        return new Promise<{ value: { err: null } }>((r) => { resolveConfirm = r })
      }) as unknown as Connection['confirmTransaction'],
      // null = tx not yet seen by RPC. The poll loop must not throw in this case.
      getSignatureStatuses: vi.fn(async () => ({ value: [null] })) as unknown as Connection['getSignatureStatuses'],
    })
    const { sleep, sleeps } = makeFakeSleep()

    const pending = sendAndConfirmWithRetry(conn, FAKE_BYTES, FAKE_BLOCKHASH, LAST_VALID_HEIGHT, {
      sleep,
      resubmitIntervalMs: 1,
    })

    // Let the poll fire a few times against the null-status mock.
    for (let i = 0; i < 10; i++) await Promise.resolve()
    expect(confirmCallCount).toBe(1)

    // Now resolve confirmation with no err — should return signature.
    resolveConfirm({ value: { err: null } })
    const sig = await pending

    expect(sig).toBe(FAKE_SIGNATURE)
    expect(sleeps.length).toBeGreaterThan(0)
    expect(vi.mocked(conn.getSignatureStatuses)).toHaveBeenCalled()
  })
})
