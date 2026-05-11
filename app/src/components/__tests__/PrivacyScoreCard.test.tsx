import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PrivacyScoreCard } from '../PrivacyScoreCard'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: vi.fn(), visible: false }),
}))

const useAuthStateMock = vi.fn()
vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => useAuthStateMock(),
}))

const fakeData = {
  score: 72,
  grade: 'GOOD',
  factors: {
    addressReuse: { score: 84, detail: '1,284 active depositors' },
    amountPatterns: { score: 91, detail: 'Avg dwell 6d 12h' },
    timingCorrelation: { score: 68, detail: '2 of 3 hops randomized' },
    counterpartyExposure: { score: 54, detail: 'Reused source detected' },
  },
  recommendations: [],
  transactionsAnalyzed: 1284,
}

function renderCard(props: { data: typeof fakeData | null; delta?: number }) {
  return render(
    <MemoryRouter>
      <PrivacyScoreCard data={props.data} delta={props.delta} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  navigateMock.mockReset()
  useAuthStateMock.mockReturnValue({
    status: 'authed' as const,
    token: 'test-token',
    publicKey: 'TestWallet1111111111111111111111111111111111',
    isAdmin: false,
    expiresAt: null,
    authenticate: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    error: null,
  })
})

describe('PrivacyScoreCard', () => {
  it('renders score 72, grade GOOD, and the +4 delta', () => {
    renderCard({ data: fakeData, delta: 4 })
    expect(screen.getByText('72')).toBeInTheDocument()
    expect(screen.getByText('GOOD')).toBeInTheDocument()
    expect(screen.getByText('+4')).toBeInTheDocument()
  })

  it('renders all 4 factor MetricBars with their detail copy', () => {
    renderCard({ data: fakeData })
    expect(screen.getByText('Anonymity set')).toBeInTheDocument()
    expect(screen.getByText('1,284 active depositors')).toBeInTheDocument()
    expect(screen.getByText('Time decay')).toBeInTheDocument()
    expect(screen.getByText('Withdraw routing')).toBeInTheDocument()
    expect(screen.getByText('Address hygiene')).toBeInTheDocument()
  })

  it('renders gauge at 0 with em-dash grade when data is null', () => {
    renderCard({ data: null })
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('View report button navigates to /privacy-report when authed', () => {
    renderCard({ data: fakeData })
    fireEvent.click(screen.getByRole('button', { name: /view report/i }))
    expect(navigateMock).toHaveBeenCalledWith('/privacy-report')
  })

  it('renders nothing for delta section when delta is undefined', () => {
    renderCard({ data: fakeData })
    expect(screen.queryByText(/vs last week/)).toBeNull()
    expect(screen.queryByText('+4')).not.toBeInTheDocument()
  })

  it('renders both delta and " vs last week" when delta is provided', () => {
    renderCard({ data: null, delta: 3 })
    expect(screen.getByText('+3')).toBeInTheDocument()
    expect(screen.getByText(/vs last week/)).toBeInTheDocument()
  })

  it('opens Sheet teaser with UnauthedEmptyState when View report clicked unauthed', () => {
    useAuthStateMock.mockReturnValue({
      status: 'unauthed' as const,
      token: null,
      publicKey: null,
      isAdmin: false,
      expiresAt: null,
      authenticate: () => Promise.resolve(),
      disconnect: () => Promise.resolve(),
      error: null,
    })
    renderCard({ data: fakeData })
    fireEvent.click(screen.getByRole('button', { name: /view report/i }))
    expect(screen.getByTestId('unauthed-empty-state')).toBeInTheDocument()
    expect(screen.getByText(/privacy score report/i)).toBeInTheDocument()
  })

  it('does NOT navigate to /privacy-report when clicked unauthed', () => {
    useAuthStateMock.mockReturnValue({
      status: 'unauthed' as const,
      token: null,
      publicKey: null,
      isAdmin: false,
      expiresAt: null,
      authenticate: () => Promise.resolve(),
      disconnect: () => Promise.resolve(),
      error: null,
    })
    renderCard({ data: fakeData })
    fireEvent.click(screen.getByRole('button', { name: /view report/i }))
    expect(navigateMock).not.toHaveBeenCalled()
    // Assert the alternative path actually fired (Sheet opened). Without this,
    // a future regression that drops `setTeaserOpen(true)` from handleViewReport
    // would silently still pass this test.
    expect(screen.getByTestId('unauthed-empty-state')).toBeInTheDocument()
  })

  it('wraps Privacy Score label in JargonTerm tooltip', () => {
    renderCard({ data: fakeData })
    const trigger = screen.getByText('PRIVACY SCORE').closest('button')
    expect(trigger).not.toBeNull()
    fireEvent.mouseEnter(trigger!)
    expect(screen.getByRole('tooltip')).toHaveTextContent(/composite metric/i)
  })

  it('dismisses Sheet teaser when Close button clicked', () => {
    useAuthStateMock.mockReturnValue({
      status: 'unauthed' as const,
      token: null,
      publicKey: null,
      isAdmin: false,
      expiresAt: null,
      authenticate: () => Promise.resolve(),
      disconnect: () => Promise.resolve(),
      error: null,
    })
    renderCard({ data: fakeData })
    fireEvent.click(screen.getByRole('button', { name: /view report/i }))
    expect(screen.getByTestId('unauthed-empty-state')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }))
    expect(screen.queryByTestId('unauthed-empty-state')).toBeNull()
  })
})
