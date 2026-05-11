import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

// ─── Provider mocks ──────────────────────────────────────────────────────────
// App.tsx mounts the full Solana wallet-adapter + auth provider tree. For
// a route-mount smoke test we replace each provider with a pass-through so
// nothing reaches the network. Mocks must be declared BEFORE the App import
// so the module-graph rewrites pick them up.

vi.mock('@solana/wallet-adapter-react', () => ({
  ConnectionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  WalletProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useWallet: () => ({
    connected: false,
    publicKey: null,
    wallet: null,
    signMessage: undefined,
    disconnect: vi.fn(),
  }),
}))

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  WalletModalProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useWalletModal: () => ({ setVisible: vi.fn(), visible: false }),
}))

// We can't simply pass-through BrowserRouter because AppShell calls
// useLocation(); leaving it bare would explode. Replace BrowserRouter with
// a MemoryRouter that reads the current window pathname at construction
// time — the per-test push to window.history works the same way as
// production navigation, so tests just call window.history.pushState then
// render.
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: ReactNode }) => (
      <actual.MemoryRouter initialEntries={[window.location.pathname]}>
        {children}
      </actual.MemoryRouter>
    ),
  }
})

vi.mock('../providers/AuthSyncProvider', async () => {
  const { makeFakeAuthState } = await import('../test-utils/makeFakeAuthState')
  return {
    AuthSyncProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    useAuthSyncContext: () => makeFakeAuthState(),
  }
})

vi.mock('../providers/ToastProvider', () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useToast: () => ({ show: vi.fn(() => 'id'), dismiss: vi.fn() }),
}))

vi.mock('../hooks/useAuthState', async () => {
  const { makeFakeAuthState } = await import('../test-utils/makeFakeAuthState')
  return {
    useAuthState: () => makeFakeAuthState({ status: 'unauthed' }),
  }
})

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ token: null, isAdmin: false, publicKey: null }),
}))

vi.mock('../hooks/useSSE', () => ({
  useSSE: () => ({ events: [] }),
}))

vi.mock('../lib/networkConfig', () => ({
  fetchNetworkConfig: vi.fn(),
  useNetworkConfigStore: (selector: (s: unknown) => unknown) =>
    selector({ config: { network: 'devnet', publicRpcUrl: '', beta: false }, error: null }),
}))

// Bypass Wallet Standard discovery + autoConnect side-effects entirely.
vi.mock('../components/Header', () => ({ default: () => <header data-testid="mock-header" /> }))
vi.mock('../components/BottomNav', () => ({ default: () => <nav data-testid="mock-bottom-nav" /> }))
vi.mock('../components/Footer', () => ({ Footer: () => <footer /> }))
vi.mock('../components/ChatSidebar', () => ({ default: () => <div data-testid="mock-chat" /> }))
vi.mock('../components/BetaBanner', () => ({ BetaBanner: () => null }))
vi.mock('../components/NetworkBanner', () => ({ NetworkBanner: () => null }))

import App from '../App'

function stubDemoFetch() {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/public/demo/vault')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          wallet: 'demo',
          network: 'devnet',
          balances: { sol: 0, tokens: [], status: 'ok' },
          activity: [],
        }),
      } as Response)
    }
    if (url.includes('/api/public/demo/privacy-score')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          address: 'demo',
          score: 80,
          grade: 'B',
          transactionsAnalyzed: 0,
          factors: {
            addressReuse: { score: 80, detail: '' },
            amountPatterns: { score: 80, detail: '' },
            timingCorrelation: { score: 80, detail: '' },
            counterpartyExposure: { score: 80, detail: '' },
          },
          recommendations: [],
        }),
      } as Response)
    }
    if (url.includes('/api/public/demo/activity')) {
      return Promise.resolve({ ok: true, json: async () => ({ activity: [] }) } as Response)
    }
    // ShieldedVolumeCard + MultiChainVaultGrid issue /api/chains[/aggregate]
    return Promise.resolve({
      ok: true,
      json: async () => ({ chains: [], totalTvlSol: 0, chainCount: 0, liveChainCount: 0, asOf: 't' }),
    } as Response)
  })
}

beforeEach(() => {
  // jsdom doesn't implement history navigation deeply; reset before each.
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App routing', () => {
  it('mounts DashboardView at / (smoke)', () => {
    window.history.pushState({}, '', '/')
    render(<App />)
    // DashboardView renders the unauthed tagline when status !== authed.
    expect(
      screen.getByText(/Multi-chain privacy command center/),
    ).toBeInTheDocument()
  })

  it('mounts DemoView at /demo', async () => {
    window.history.pushState({}, '', '/demo')
    stubDemoFetch()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('demo-banner')).toBeInTheDocument()
    })
    expect(screen.getByText(/demo mode/i)).toBeInTheDocument()
  })

  it('hides Header + BottomNav chrome on /demo', () => {
    window.history.pushState({}, '', '/demo')
    stubDemoFetch()
    render(<App />)
    expect(screen.queryByTestId('mock-header')).toBeNull()
    expect(screen.queryByTestId('mock-bottom-nav')).toBeNull()
  })

  it('shows Header + BottomNav chrome on / (regression guard)', () => {
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(screen.getByTestId('mock-header')).toBeInTheDocument()
    expect(screen.getByTestId('mock-bottom-nav')).toBeInTheDocument()
  })

  it('does NOT hide chrome on /demo-foo (prefix-match footgun guard)', () => {
    // /demo-foo is a hypothetical future route that should NOT inherit
    // /demo's chrome-hidden treatment. Using pathname.startsWith('/demo')
    // would match it; an exact-match Set scopes the hide correctly to /demo
    // alone.
    window.history.pushState({}, '', '/demo-foo')
    render(<App />)
    expect(screen.getByTestId('mock-header')).toBeInTheDocument()
    expect(screen.getByTestId('mock-bottom-nav')).toBeInTheDocument()
  })
})
