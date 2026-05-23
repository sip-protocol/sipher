import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Connection } from '@solana/web3.js'
import { sendAndConfirmWithRetry } from '../sendWithRetry'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function makeConnection(overrides: Partial<{
  sendRawTransaction: ReturnType<typeof vi.fn>
  confirmTransaction: ReturnType<typeof vi.fn>
}> = {}): Connection {
  const send = overrides.sendRawTransaction ?? vi.fn().mockResolvedValue('SIG_FAKE')
  const confirm = overrides.confirmTransaction ?? vi.fn().mockResolvedValue({ value: { err: null } })
  return {
    sendRawTransaction: send,
    confirmTransaction: confirm,
  } as unknown as Connection
}

describe('sendAndConfirmWithRetry', () => {
  const SIGNED = new Uint8Array([1, 2, 3])
  const BLOCKHASH = 'fake-blockhash'
  const LAST_VALID = 12345
  const FAST_INTERVAL = 10

  beforeEach(() => {
    vi.useRealTimers()
  })

  it('returns the signature on first-attempt confirmation without resubmits', async () => {
    const send = vi.fn().mockResolvedValue('SIG_OK')
    const confirm = vi.fn().mockResolvedValue({ value: { err: null } })
    const conn = makeConnection({ sendRawTransaction: send, confirmTransaction: confirm })

    const result = await sendAndConfirmWithRetry(conn, SIGNED, BLOCKHASH, LAST_VALID, {
      resubmitIntervalMs: FAST_INTERVAL,
    })

    expect(result).toBe('SIG_OK')
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(SIGNED, { skipPreflight: true, maxRetries: 0 })
    expect(confirm).toHaveBeenCalledWith(
      { signature: 'SIG_OK', blockhash: BLOCKHASH, lastValidBlockHeight: LAST_VALID },
      'confirmed',
    )
  })

  it('resubmits in the background while confirmation is pending', async () => {
    const send = vi.fn().mockResolvedValue('SIG_RESEND')
    const confirmDeferred = deferred<{ value: { err: null } }>()
    const confirm = vi.fn().mockReturnValue(confirmDeferred.promise)
    const conn = makeConnection({ sendRawTransaction: send, confirmTransaction: confirm })

    const sleep = vi.fn().mockImplementation(
      (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    )

    const inFlight = sendAndConfirmWithRetry(conn, SIGNED, BLOCKHASH, LAST_VALID, {
      resubmitIntervalMs: 5,
      sleep,
    })

    // Wait long enough for ~3 resubmit ticks (5ms each + scheduler jitter)
    await new Promise((r) => setTimeout(r, 50))

    expect(send.mock.calls.length).toBeGreaterThan(1)

    confirmDeferred.resolve({ value: { err: null } })
    const result = await inFlight
    expect(result).toBe('SIG_RESEND')

    const sendsBeforeStop = send.mock.calls.length
    await new Promise((r) => setTimeout(r, 30))
    expect(send.mock.calls.length).toBe(sendsBeforeStop)
  })

  it('swallows resubmit errors without aborting the confirm flow', async () => {
    let callCount = 0
    const send = vi.fn().mockImplementation(() => {
      callCount += 1
      if (callCount === 1) return Promise.resolve('SIG_TRANSIENT')
      return Promise.reject(new Error('rate limited'))
    })
    const confirmDeferred = deferred<{ value: { err: null } }>()
    const confirm = vi.fn().mockReturnValue(confirmDeferred.promise)
    const conn = makeConnection({ sendRawTransaction: send, confirmTransaction: confirm })

    const inFlight = sendAndConfirmWithRetry(conn, SIGNED, BLOCKHASH, LAST_VALID, {
      resubmitIntervalMs: 5,
    })

    await new Promise((r) => setTimeout(r, 30))
    expect(send.mock.calls.length).toBeGreaterThan(1)

    confirmDeferred.resolve({ value: { err: null } })
    await expect(inFlight).resolves.toBe('SIG_TRANSIENT')
  })

  it('propagates the first-send error without entering the resubmit loop', async () => {
    const send = vi.fn().mockRejectedValue(new Error('wallet not connected'))
    const confirm = vi.fn()
    const conn = makeConnection({ sendRawTransaction: send, confirmTransaction: confirm })

    await expect(
      sendAndConfirmWithRetry(conn, SIGNED, BLOCKHASH, LAST_VALID, {
        resubmitIntervalMs: FAST_INTERVAL,
      }),
    ).rejects.toThrow('wallet not connected')

    expect(send).toHaveBeenCalledTimes(1)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('propagates "block height exceeded" from confirmTransaction and stops resubmits', async () => {
    const send = vi.fn().mockResolvedValue('SIG_EXPIRED')
    const confirm = vi.fn().mockRejectedValue(new Error('block height exceeded'))
    const conn = makeConnection({ sendRawTransaction: send, confirmTransaction: confirm })

    await expect(
      sendAndConfirmWithRetry(conn, SIGNED, BLOCKHASH, LAST_VALID, {
        resubmitIntervalMs: 5,
      }),
    ).rejects.toThrow('block height exceeded')

    const sendsAtFailure = send.mock.calls.length
    await new Promise((r) => setTimeout(r, 30))
    expect(send.mock.calls.length).toBe(sendsAtFailure)
  })
})
