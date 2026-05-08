import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import PrivacyReportView from '../PrivacyReportView'
import { useAppStore } from '../../stores/app'

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => ({ token: 'abc', isAdmin: false }),
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

beforeEach(() => {
  ;(apiFetch as ReturnType<typeof vi.fn>).mockReset()
  useAppStore.setState({ activeView: 'privacyReport' }, false)
})

describe('PrivacyReportView', () => {
  it('renders the score gauge once data loads', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakePayload)
    render(<PrivacyReportView />)
    await waitFor(() => expect(screen.getByText('72')).toBeInTheDocument())
    expect(screen.getByText('GOOD')).toBeInTheDocument()
    expect(screen.getByText(/1,284 transactions analyzed/)).toBeInTheDocument()
  })

  it('renders factor breakdown with humanized labels', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakePayload)
    render(<PrivacyReportView />)
    await waitFor(() => expect(screen.getByText('Address Reuse')).toBeInTheDocument())
    expect(screen.getByText('Amount Patterns')).toBeInTheDocument()
    expect(screen.getByText('reuse detail')).toBeInTheDocument()
  })

  it('lists recommendations when present', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakePayload)
    render(<PrivacyReportView />)
    await waitFor(() => expect(screen.getByText(/Use a fresh address/)).toBeInTheDocument())
    expect(screen.getByText(/Wait 24h between deposits/)).toBeInTheDocument()
  })

  it('Back button returns to Dashboard via store', () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fakePayload)
    render(<PrivacyReportView />)
    fireEvent.click(screen.getByRole('button', { name: /back to dashboard/i }))
    expect(useAppStore.getState().activeView).toBe('dashboard')
  })

  it('shows loading copy before data arrives', () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(new Promise(() => {}))
    render(<PrivacyReportView />)
    expect(screen.getByText(/Loading privacy report/)).toBeInTheDocument()
  })

  it('shows error copy when fetch fails', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    render(<PrivacyReportView />)
    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument())
  })
})
