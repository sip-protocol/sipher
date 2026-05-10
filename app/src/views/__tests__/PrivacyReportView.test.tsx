import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PrivacyReportView from '../PrivacyReportView'
import type { AuthState } from '../../hooks/useAuthState'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
}))

let currentAuth: AuthState = {
  status: 'authed',
  token: 'abc',
  expiresAt: null,
  isAdmin: false,
  publicKey: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
  authenticate: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
  error: null,
}

vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => currentAuth,
}))

import { apiFetch } from '../../api/client'

const fakePayload = {
  data: {
    score: 72,
    grade: 'GOOD',
    factors: {
      addressReuse: { score: 84, detail: 'reuse detail' },
      amountPatterns: { score: 91, detail: 'patterns detail' },
    },
    recommendations: ['Use a fresh address', 'Wait 24h between deposits'],
    transactionsAnalyzed: 1284,
  },
}

function renderReport() {
  return render(
    <MemoryRouter>
      <PrivacyReportView />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  ;(apiFetch as ReturnType<typeof vi.fn>).mockReset()
  navigateMock.mockReset()
  currentAuth = {
    status: 'authed',
    token: 'abc',
    expiresAt: null,
    isAdmin: false,
    publicKey: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
    authenticate: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    error: null,
  }
})

describe('PrivacyReportView', () => {
  it('renders the score gauge once data loads', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakePayload)
    renderReport()
    await waitFor(() => expect(screen.getByText('72')).toBeInTheDocument())
    expect(screen.getByText('GOOD')).toBeInTheDocument()
    expect(screen.getByText(/1,284 transactions analyzed/)).toBeInTheDocument()
  })

  it('renders factor breakdown with humanized labels', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakePayload)
    renderReport()
    await waitFor(() => expect(screen.getByText('Address Reuse')).toBeInTheDocument())
    expect(screen.getByText('Amount Patterns')).toBeInTheDocument()
    expect(screen.getByText('reuse detail')).toBeInTheDocument()
  })

  it('lists recommendations when present', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakePayload)
    renderReport()
    await waitFor(() => expect(screen.getByText(/Use a fresh address/)).toBeInTheDocument())
    expect(screen.getByText(/Wait 24h between deposits/)).toBeInTheDocument()
  })

  it('Back button returns to Dashboard via navigate("/")', () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakePayload)
    renderReport()
    fireEvent.click(screen.getByRole('button', { name: /back to dashboard/i }))
    expect(navigateMock).toHaveBeenCalledWith('/')
  })

  it('shows loading copy before data arrives', () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(new Promise(() => {}))
    renderReport()
    expect(screen.getByText(/Loading privacy report/)).toBeInTheDocument()
  })

  it('shows error copy when fetch fails', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    renderReport()
    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument())
  })

  it('renders UnauthedEmptyState when status is unauthed', () => {
    currentAuth = {
      ...currentAuth,
      status: 'unauthed',
      token: null,
      publicKey: null,
    }
    renderReport()
    expect(screen.getByTestId('unauthed-empty-state')).toBeInTheDocument()
    expect(screen.getByText(/privacy score report/i)).toBeInTheDocument()
    // Score gauge / loading copy must be absent when unauthed
    expect(screen.queryByText(/Loading privacy report/)).not.toBeInTheDocument()
  })
})
