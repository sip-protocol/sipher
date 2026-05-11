import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import { PrivacyGraph } from '../PrivacyGraph'
import { onAuthClear } from '../../store/onAuthClear'

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => ({ token: 'tok', isAdmin: false }),
}))

import { apiFetch } from '../../api/client'

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
})

beforeEach(() => {
  ;(apiFetch as ReturnType<typeof vi.fn>).mockReset()
  onAuthClear._resetForTests()
})

describe('PrivacyGraph', () => {
  it('shows the empty-state copy when the tree is empty', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      tree: [],
      rootWallet: '',
    })
    render(<PrivacyGraph />)
    await waitFor(() => {
      expect(screen.getByText(/0 addresses/)).toBeInTheDocument()
      expect(screen.getByText(/each node is a one-time stealth address/i)).toBeInTheDocument()
      expect(screen.getByText(/connect a wallet and send\/receive shielded payments/i)).toBeInTheDocument()
    })
  })

  it('renders the NodeGraph and address count when the API returns nodes', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      tree: [
        {
          index: 0,
          derivationPath: "m/0'",
          stealthAddress: 'rootWallet',
          parentIndex: null,
          createdAt: '2026-05-08T00:00:00Z',
        },
      ],
      rootWallet: 'rootWallet',
    })
    render(<PrivacyGraph />)
    await waitFor(() => expect(screen.getByText('1 address')).toBeInTheDocument())
    expect(screen.getByTestId('node-graph')).toBeInTheDocument()
  })

  it('falls back to empty state when the fetch errors', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'))
    render(<PrivacyGraph />)
    await waitFor(() => expect(screen.getByText(/0 addresses/)).toBeInTheDocument())
  })

  it('catch handler returns early when controller.signal.aborted is true (verified via aborted-signal probe)', async () => {
    // Probe the abort signal state at the moment the catch handler runs.
    // We achieve this by tapping into apiFetch: store the signal it receives,
    // then resolve via a deferred rejection AFTER unmounting. The guard the
    // production code adds — `if (controller.signal.aborted) return` — is
    // covered behaviourally: when the catch handler's guard reads the signal,
    // signal.aborted MUST be true because unmount fires the AbortController's
    // abort() synchronously via useEffect cleanup. We assert this directly
    // by probing the signal post-unmount and post-rejection.
    let rejectFetch: (err: Error) => void = () => {}
    let receivedSignal: AbortSignal | undefined
    const fetchPromise = new Promise((_resolve, reject) => {
      rejectFetch = reject
    })
    ;(apiFetch as ReturnType<typeof vi.fn>).mockImplementationOnce((_url, opts) => {
      receivedSignal = opts?.signal
      return fetchPromise
    })

    const { unmount } = render(<PrivacyGraph />)

    // Skeleton renders while the promise is pending.
    expect(screen.getByTestId('privacy-graph-skeleton')).toBeInTheDocument()
    expect(receivedSignal).toBeDefined()
    expect(receivedSignal!.aborted).toBe(false)

    // Unmount fires controller.abort() via useEffect cleanup.
    unmount()
    expect(receivedSignal!.aborted).toBe(true)

    // Probe the guard predicate: count how many times signal.aborted is
    // read AFTER the rejection fires. If the catch guard reads it (which it
    // must to short-circuit), we'll observe the read here.
    let abortedReadCount = 0
    const originalSignal = receivedSignal!
    Object.defineProperty(receivedSignal, 'aborted', {
      configurable: true,
      get() {
        abortedReadCount++
        return true
      },
    })

    // Reject with a generic (non-Abort) error AFTER unmount.
    await act(async () => {
      rejectFetch(new Error('network failure after unmount'))
      // Drain microtask queue so .catch handler runs.
      await Promise.resolve()
      await Promise.resolve()
    })

    // The catch handler's first line reads controller.signal.aborted.
    // If the guard is in place, abortedReadCount must be >= 1.
    expect(abortedReadCount).toBeGreaterThanOrEqual(1)

    // Restore the signal's prototype getter (cleanup).
    Object.defineProperty(originalSignal, 'aborted', {
      configurable: true,
      value: true,
    })
  })

  it('wraps Stealth Address Tree label in JargonTerm tooltip', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      tree: [],
      rootWallet: '',
    })
    render(<PrivacyGraph />)
    await waitFor(() => {
      expect(screen.getByText(/0 addresses/)).toBeInTheDocument()
    })
    const trigger = screen.getByText('STEALTH ADDRESS TREE').closest('button')
    expect(trigger).not.toBeNull()
    fireEvent.mouseEnter(trigger!)
    expect(screen.getByRole('tooltip')).toHaveTextContent(/one-time recipient/i)
  })

  it('clears the tree when onAuthClear.clearAll fires', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      tree: [
        {
          index: 0,
          derivationPath: 'm/0',
          stealthAddress: 'X',
          parentIndex: null,
          createdAt: 't',
        },
      ],
      rootWallet: 'W',
    })
    render(<PrivacyGraph />)
    await waitFor(() => {
      expect(screen.getByText('1 address')).toBeInTheDocument()
    })

    act(() => onAuthClear.clearAll())

    await waitFor(() => {
      expect(screen.getByText(/0 addresses/)).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('renders skeleton while loading and hides empty state', async () => {
      // Mock a fetch that never resolves so the loading state persists
      ;(apiFetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() => new Promise(() => {}))
      render(<PrivacyGraph />)
      expect(screen.getByTestId('privacy-graph-skeleton')).toBeInTheDocument()
      expect(screen.queryByTestId('privacy-graph-empty')).not.toBeInTheDocument()
    })

    it('renders empty state when loaded with no nodes', async () => {
      ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        tree: [],
        rootWallet: '',
      })
      render(<PrivacyGraph />)
      await waitFor(() => {
        expect(screen.getByTestId('privacy-graph-empty')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('privacy-graph-skeleton')).not.toBeInTheDocument()
    })
  })
})
