import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivacyScoreCard } from '../PrivacyScoreCard'
import { useAppStore } from '../../stores/app'

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

beforeEach(() => {
  useAppStore.setState({ activeView: 'dashboard' }, false)
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
    render(<PrivacyScoreCard data={fakeData} delta={4} />)
    expect(screen.getByText('72')).toBeInTheDocument()
    expect(screen.getByText('GOOD')).toBeInTheDocument()
    expect(screen.getByText('+4')).toBeInTheDocument()
  })

  it('renders all 4 factor MetricBars with their detail copy', () => {
    render(<PrivacyScoreCard data={fakeData} />)
    expect(screen.getByText('Anonymity set')).toBeInTheDocument()
    expect(screen.getByText('1,284 active depositors')).toBeInTheDocument()
    expect(screen.getByText('Time decay')).toBeInTheDocument()
    expect(screen.getByText('Withdraw routing')).toBeInTheDocument()
    expect(screen.getByText('Address hygiene')).toBeInTheDocument()
  })

  it('renders gauge at 0 with em-dash grade when data is null', () => {
    render(<PrivacyScoreCard data={null} />)
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('View report button navigates to privacyReport view via store', () => {
    render(<PrivacyScoreCard data={fakeData} />)
    fireEvent.click(screen.getByRole('button', { name: /view report/i }))
    expect(useAppStore.getState().activeView).toBe('privacyReport')
  })

  it('omits delta block when delta is undefined', () => {
    render(<PrivacyScoreCard data={fakeData} />)
    expect(screen.queryByText(/vs last week/)).toBeInTheDocument()
    expect(screen.queryByText('+4')).not.toBeInTheDocument()
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
    render(<PrivacyScoreCard data={fakeData} />)
    fireEvent.click(screen.getByRole('button', { name: /view report/i }))
    expect(screen.getByTestId('unauthed-empty-state')).toBeInTheDocument()
    expect(screen.getByText(/privacy score report/i)).toBeInTheDocument()
  })

  it('does NOT navigate to privacyReport when clicked unauthed', () => {
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
    render(<PrivacyScoreCard data={fakeData} />)
    fireEvent.click(screen.getByRole('button', { name: /view report/i }))
    expect(useAppStore.getState().activeView).toBe('dashboard')
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
    render(<PrivacyScoreCard data={fakeData} />)
    fireEvent.click(screen.getByRole('button', { name: /view report/i }))
    expect(screen.getByTestId('unauthed-empty-state')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }))
    expect(screen.queryByTestId('unauthed-empty-state')).toBeNull()
  })
})
