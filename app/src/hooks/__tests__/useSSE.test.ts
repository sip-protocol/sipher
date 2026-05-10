import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { connectSSE } from '../../api/sse'
import { useSSE } from '../useSSE'
import { onAuthClear } from '../../store/onAuthClear'

vi.mock('../../api/sse', () => ({
  connectSSE: vi.fn(),
}))

vi.mock('../useAuthState', async () => {
  const { makeFakeAuthState } = await import('../../test-utils/makeFakeAuthState')
  return {
    useAuthState: () => makeFakeAuthState({ status: 'authed', token: 'tok' }),
  }
})

beforeEach(() => {
  onAuthClear._resetForTests()
  ;(connectSSE as ReturnType<typeof vi.fn>).mockReset()
})

describe('useSSE', () => {
  it('clears events when onAuthClear.clearAll fires', async () => {
    let onMessageCb: ((e: MessageEvent) => void) | null = null
    ;(connectSSE as ReturnType<typeof vi.fn>).mockImplementation(
      async (_token, onMessage) => {
        onMessageCb = onMessage
        return { close: vi.fn(), onerror: null } as unknown as EventSource
      },
    )

    const { result } = renderHook(() => useSSE())

    // Wait for the async connectSSE to resolve and capture the callback.
    await waitFor(() => expect(onMessageCb).not.toBeNull())

    // Inject an event so events.length > 0 before the clear.
    act(() => {
      onMessageCb?.({
        data: JSON.stringify({
          id: '1',
          agent: 'a',
          type: 't',
          level: 'info',
          data: {},
          timestamp: 'x',
        }),
      } as MessageEvent)
    })
    await waitFor(() => expect(result.current.events).toHaveLength(1))

    // Fire auth-clear and assert the events array drained.
    act(() => onAuthClear.clearAll())
    await waitFor(() => expect(result.current.events).toHaveLength(0))
  })

  it('keeps events on transient EventSource error and only flips connected to false', async () => {
    let onMessageCb: ((e: MessageEvent) => void) | null = null
    const onerrorRef: { current: (() => void) | null } = { current: null }

    ;(connectSSE as ReturnType<typeof vi.fn>).mockImplementation(
      async (_token, onMessage) => {
        onMessageCb = onMessage
        const source = {
          close: vi.fn(),
          get onerror() { return onerrorRef.current },
          set onerror(v: (() => void) | null) { onerrorRef.current = v },
        }
        return source as unknown as EventSource
      },
    )

    const { result } = renderHook(() => useSSE())
    await waitFor(() => expect(onMessageCb).not.toBeNull())
    await waitFor(() => expect(result.current.connected).toBe(true))

    act(() => {
      onMessageCb?.({
        data: JSON.stringify({
          id: '1',
          agent: 'a',
          type: 't',
          level: 'info',
          data: {},
          timestamp: 'x',
        }),
      } as MessageEvent)
    })
    await waitFor(() => expect(result.current.events).toHaveLength(1))

    // Transient EventSource blip: connected flips false but events are NOT
    // wiped — users keep seeing their activity feed across short network
    // hiccups. Auth-clear (the test above) is the only path that drains
    // events.
    act(() => {
      onerrorRef.current?.()
    })
    await waitFor(() => expect(result.current.connected).toBe(false))
    expect(result.current.events).toHaveLength(1)
  })
})
