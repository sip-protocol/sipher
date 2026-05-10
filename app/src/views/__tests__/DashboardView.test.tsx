import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardView from '../DashboardView'
import { onAuthClear } from '../../store/onAuthClear'

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('../../hooks/useAuthState', async () => {
  const { makeFakeAuthState } = await import('../../test-utils/makeFakeAuthState')
  return {
    useAuthState: () => makeFakeAuthState({ status: 'authed', token: 'tok', publicKey: 'W' }),
  }
})

import { apiFetch } from '../../api/client'

const fakePrivacyScore = {
  data: {
    score: 80,
    grade: 'A',
    factors: {
      addressReuse: { score: 80, detail: 'detail-reuse' },
      amountPatterns: { score: 80, detail: 'detail-amount' },
      timingCorrelation: { score: 80, detail: 'detail-timing' },
      counterpartyExposure: { score: 80, detail: 'detail-counterparty' },
    },
    recommendations: [],
    transactionsAnalyzed: 1,
  },
}

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

  // Path-based mock so the four fetches (vault, activity, privacy score,
  // chains, chain aggregate, stealth index) can resolve in any order.
  ;(apiFetch as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
    if (path === '/api/vault') {
      return Promise.resolve({ wallet: 'W', balances: { sol: 1, tokens: [], status: 'ok' } })
    }
    if (path === '/api/activity') {
      return Promise.resolve({
        activity: [
          {
            id: '1',
            agent: 'a',
            type: 'send.success',
            level: 'info',
            title: 't',
            detail: null,
            created_at: 't',
          },
        ],
      })
    }
    if (path === '/v1/privacy/score') {
      return Promise.resolve(fakePrivacyScore)
    }
    if (path === '/api/chains') {
      return Promise.resolve({ chains: [] })
    }
    if (path === '/api/chains/aggregate') {
      return Promise.resolve({ totalTvlSol: 0, chainCount: 0, liveChainCount: 0, asOf: 't' })
    }
    if (path === '/api/stealth/index') {
      return Promise.resolve({ tree: [], rootWallet: 'W' })
    }
    return Promise.reject(new Error('unexpected path: ' + path))
  })
})

describe('DashboardView', () => {
  it('clears privacy data on auth-clear', async () => {
    render(
      <MemoryRouter>
        <DashboardView events={[]} />
      </MemoryRouter>,
    )

    // Wait for privacy score data to render — MetricBar's "Anonymity set"
    // label only appears once `data` is non-null.
    await waitFor(() => {
      expect(screen.getByText(/Anonymity set/i)).toBeInTheDocument()
    })

    act(() => onAuthClear.clearAll())

    // After clear, privacy data falls back to null and MetricBar rows hide.
    await waitFor(() => {
      expect(screen.queryByText(/Anonymity set/i)).not.toBeInTheDocument()
    })
  })

  it('aborts in-flight /api/vault and /api/activity on unmount', async () => {
    const capturedSignals: AbortSignal[] = []
    ;(apiFetch as ReturnType<typeof vi.fn>).mockImplementation((path: string, opts?: { signal?: AbortSignal }) => {
      if (path === '/api/vault' || path === '/api/activity') {
        if (opts?.signal) capturedSignals.push(opts.signal)
        return new Promise(() => {}) // never resolves so the signal stays in flight
      }
      // privacy-score and chains paths still resolve so the rest of the view mounts cleanly
      if (path === '/v1/privacy/score') return Promise.resolve(fakePrivacyScore)
      if (path === '/api/chains') return Promise.resolve({ chains: [] })
      if (path === '/api/chains/aggregate') {
        return Promise.resolve({ totalTvlSol: 0, chainCount: 0, liveChainCount: 0, asOf: 't' })
      }
      if (path === '/api/stealth/index') return Promise.resolve({ tree: [], rootWallet: 'W' })
      return Promise.reject(new Error('unexpected path: ' + path))
    })
    const { unmount } = render(
      <MemoryRouter>
        <DashboardView events={[]} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(capturedSignals.length).toBe(2))
    expect(capturedSignals.every((s) => s.aborted === false)).toBe(true)
    unmount()
    expect(capturedSignals.every((s) => s.aborted === true)).toBe(true)
  })
})
