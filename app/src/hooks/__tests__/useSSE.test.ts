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
})
