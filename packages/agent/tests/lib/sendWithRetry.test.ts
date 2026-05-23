import { describe, expect, it, vi } from 'vitest'
import type { Connection } from '@solana/web3.js'
import { sendAndConfirmWithRetry } from '../../src/lib/sendWithRetry.js'

const FAKE_SIGNATURE = '5J7XHm...fake'
const FAKE_BLOCKHASH = 'HF3...fake'
const FAKE_BYTES = new Uint8Array([1, 2, 3])
const LAST_VALID_HEIGHT = 100

function makeConnection(overrides: Partial<Connection> = {}): Connection {
  return {
    sendRawTransaction: vi.fn(async () => FAKE_SIGNATURE),
    confirmTransaction: vi.fn(async () => ({ value: { err: null } })),
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
    const conn = makeConnection()
    const { sleep } = makeFakeSleep()

    const sig = await sendAndConfirmWithRetry(
      conn,
      FAKE_BYTES,
      FAKE_BLOCKHASH,
      LAST_VALID_HEIGHT,
      { sleep, resubmitIntervalMs: 1 },
    )

    expect(sig).toBe(FAKE_SIGNATURE)
    expect(conn.sendRawTransaction).toHaveBeenCalledTimes(1)
    expect(conn.confirmTransaction).toHaveBeenCalledOnce()
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
})
