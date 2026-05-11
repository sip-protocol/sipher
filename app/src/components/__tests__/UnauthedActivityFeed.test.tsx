import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import UnauthedActivityFeed from '../UnauthedActivityFeed'

const mockData = {
  counter: 12345,
  recent: [
    { type: 'send.success', chain: 'solana', amountBand: '1-10', relativeTime: '3 minutes ago' },
    { type: 'swap.success', chain: 'solana', amountBand: '10-100', relativeTime: '8 minutes ago' },
    { type: 'deposit.success', chain: 'solana', amountBand: '<1', relativeTime: '12 minutes ago' },
    { type: 'send.success', chain: 'solana', amountBand: '100-1000', relativeTime: '1 hour ago' },
    { type: 'swap.completed', chain: 'solana', amountBand: '>1000', relativeTime: '2 hours ago' },
  ],
}

function makeResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload,
  } as Response
}

beforeEach(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  global.fetch = vi.fn().mockResolvedValue(makeResponse(mockData))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('<UnauthedActivityFeed />', () => {
  it('renders skeleton during initial load', () => {
    // Block the fetch from resolving so we land on the skeleton state.
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}))
    render(<UnauthedActivityFeed />)
    expect(screen.getByTestId('activity-feed-skeleton')).toBeInTheDocument()
  })

  it('renders counter + recent rows after fetch', async () => {
    render(<UnauthedActivityFeed />)
    await waitFor(() => expect(screen.getByText(/12,345/)).toBeInTheDocument())
    expect(screen.getByText(/3 minutes ago/)).toBeInTheDocument()
    expect(screen.getByText(/swap.success/i)).toBeInTheDocument()
  })

  it('does not poll when document.visibilityState is hidden', async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<UnauthedActivityFeed />)
    // Initial mount fetches once unconditionally (the visibility gate fires only
    // inside the interval callback, see component impl).
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('polls every 60s when visible', async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<UnauthedActivityFeed />)
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
  })

  it('renders graceful empty-state on fetch error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network'))
    render(<UnauthedActivityFeed />)
    await waitFor(() =>
      expect(screen.getByText(/live activity unavailable/i)).toBeInTheDocument(),
    )
  })

  it('aborts in-flight fetch on unmount', async () => {
    let capturedSignal: AbortSignal | undefined
    global.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined
      return new Promise(() => {}) // never resolves
    })
    const { unmount } = render(<UnauthedActivityFeed />)
    await waitFor(() => expect(capturedSignal).toBeDefined())
    expect(capturedSignal?.aborted).toBe(false)
    unmount()
    expect(capturedSignal?.aborted).toBe(true)
  })
})
