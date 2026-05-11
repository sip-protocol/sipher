import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardView from '../DashboardView'
import { onAuthClear } from '../../store/onAuthClear'
import type { AuthState } from '../../hooks/useAuthState'

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
}))

let currentAuthOverrides: Partial<AuthState> = {
  status: 'authed',
  token: 'tok',
  publicKey: 'W',
}

vi.mock('../../hooks/useAuthState', async () => {
  const { makeFakeAuthState } = await import('../../test-utils/makeFakeAuthState')
  return {
    useAuthState: () => makeFakeAuthState(currentAuthOverrides),
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
  currentAuthOverrides = { status: 'authed', token: 'tok', publicKey: 'W' }

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

  describe('SEO metadata', () => {
    it('renders document.title and og:title meta tags', async () => {
      render(
        <MemoryRouter>
          <DashboardView events={[]} />
        </MemoryRouter>,
      )
      await waitFor(() => {
        expect(document.title).toBe('SIPHER — Multi-chain privacy command center')
      })
      const ogTitle = document.querySelector('meta[property="og:title"]')
      expect(ogTitle?.getAttribute('content')).toBe('SIPHER — Multi-chain privacy command center')
      const ogDescription = document.querySelector('meta[property="og:description"]')
      expect(ogDescription?.getAttribute('content')).toBe(
        'Multi-chain privacy command center for shielded transfers across 9+ chains.',
      )
    })
  })
})

describe('DashboardView — unauthed tagline', () => {
  it('renders the SIPHER tagline when status is unauthed', () => {
    currentAuthOverrides = { status: 'unauthed', token: null, publicKey: null }
    render(
      <MemoryRouter>
        <DashboardView events={[]} />
      </MemoryRouter>,
    )
    expect(
      screen.getByText(
        /Multi-chain privacy command center for shielded transfers across 9\+ chains\./,
      ),
    ).toBeInTheDocument()
  })

  it('does not render the tagline when status is authed', () => {
    currentAuthOverrides = { status: 'authed', token: 'tok', publicKey: 'W' }
    render(
      <MemoryRouter>
        <DashboardView events={[]} />
      </MemoryRouter>,
    )
    expect(
      screen.queryByText(/Multi-chain privacy command center/),
    ).not.toBeInTheDocument()
  })

  it('renders the tagline when status is expired (treated as not-authed)', () => {
    // Spec D-E1-5: tagline gates on status !== 'authed'. Any non-authed
    // state (unauthed / connecting / expired / error) surfaces the tagline.
    currentAuthOverrides = { status: 'expired', token: null, publicKey: 'W' }
    render(
      <MemoryRouter>
        <DashboardView events={[]} />
      </MemoryRouter>,
    )
    expect(
      screen.getByText(/Multi-chain privacy command center/),
    ).toBeInTheDocument()
  })
})

describe('Demo CTA (unauthed)', () => {
  it('renders DemoCtaCard when status is unauthed', () => {
    currentAuthOverrides = { status: 'unauthed', token: null, publicKey: null }
    render(
      <MemoryRouter>
        <DashboardView events={[]} />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('link', { name: /view sample dashboard/i }),
    ).toBeInTheDocument()
  })

  it('does NOT render DemoCtaCard when status is authed', () => {
    currentAuthOverrides = { status: 'authed', token: 'tok', publicKey: 'W' }
    render(
      <MemoryRouter>
        <DashboardView events={[]} />
      </MemoryRouter>,
    )
    expect(
      screen.queryByRole('link', { name: /view sample dashboard/i }),
    ).toBeNull()
  })
})
