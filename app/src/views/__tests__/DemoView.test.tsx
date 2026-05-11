import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { AuthState } from '../../hooks/useAuthState'
import { makeFakeAuthState } from '../../test-utils/makeFakeAuthState'
import DemoView from '../DemoView'

let currentAuthOverrides: Partial<AuthState> = { status: 'unauthed' }
let mockSetVisible: ReturnType<typeof vi.fn>

vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => makeFakeAuthState(currentAuthOverrides),
}))

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: mockSetVisible, visible: false }),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const vaultFixture = {
  wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
  network: 'devnet',
  balances: { sol: 1.5, tokens: [], status: 'ok' },
  activity: [],
}

const activityFixture = { activity: [] }

const privacyFixture = {
  address: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
  score: 82,
  grade: 'B',
  transactionsAnalyzed: 50,
  factors: {
    addressReuse: { score: 80, detail: 'demo-detail' },
    amountPatterns: { score: 85, detail: 'demo-detail' },
    timingCorrelation: { score: 80, detail: 'demo-detail' },
    counterpartyExposure: { score: 82, detail: 'demo-detail' },
  },
  recommendations: [],
}

beforeEach(() => {
  mockNavigate.mockReset()
  mockSetVisible = vi.fn()
  currentAuthOverrides = { status: 'unauthed' }
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (typeof url !== 'string') {
      return Promise.reject(new Error('unexpected fetch url type'))
    }
    if (url.includes('/api/public/demo/vault')) {
      return Promise.resolve({ ok: true, json: async () => vaultFixture } as Response)
    }
    if (url.includes('/api/public/demo/activity')) {
      return Promise.resolve({ ok: true, json: async () => activityFixture } as Response)
    }
    if (url.includes('/api/public/demo/privacy-score')) {
      return Promise.resolve({ ok: true, json: async () => privacyFixture } as Response)
    }
    return Promise.reject(new Error(`unexpected fetch url: ${url}`))
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('<DemoView />', () => {
  it('renders the banner with "Demo mode" copy plus Exit + Connect CTA buttons', async () => {
    render(
      <MemoryRouter>
        <DemoView />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/demo mode/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /exit demo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
  })

  it('navigates to / when the exit-demo button is clicked', () => {
    render(
      <MemoryRouter>
        <DemoView />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /exit demo/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('opens the wallet modal when the connect-wallet button is clicked', () => {
    render(
      <MemoryRouter>
        <DemoView />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }))
    expect(mockSetVisible).toHaveBeenCalledWith(true)
  })

  it('auto-redirects to / when the auth status transitions to authed', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <DemoView />
      </MemoryRouter>,
    )
    expect(mockNavigate).not.toHaveBeenCalled()
    act(() => {
      currentAuthOverrides = { status: 'authed', token: 'tok', publicKey: 'W' }
    })
    rerender(
      <MemoryRouter>
        <DemoView />
      </MemoryRouter>,
    )
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })

  it('fetches /api/public/demo/* with no Authorization header', async () => {
    render(
      <MemoryRouter>
        <DemoView />
      </MemoryRouter>,
    )
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    for (const callArgs of calls) {
      const init = callArgs[1] as RequestInit | undefined
      const headers = (init?.headers ?? {}) as Record<string, string>
      expect(headers.Authorization).toBeUndefined()
      expect(headers.authorization).toBeUndefined()
    }
  })
})
