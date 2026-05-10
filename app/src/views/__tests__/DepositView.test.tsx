import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { AuthState } from '../../hooks/useAuthState'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

let networkValue: 'devnet' | 'mainnet' = 'devnet'

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
}))

let currentAuth: AuthState = {
  status: 'authed',
  token: 'test-token',
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

vi.mock('../../hooks/useTransactionSigner', () => ({
  useTransactionSigner: () => ({
    signAndBroadcast: vi.fn().mockResolvedValue({ signature: 'CONFIRMED_SIG' }),
    status: 'idle' as const,
    setStatus: vi.fn(),
    reset: vi.fn(),
  }),
}))

vi.mock('../../lib/networkConfig', () => ({
  useNetworkConfigStore: <T,>(selector: (s: { config: { network: string } }) => T) =>
    selector({ config: { network: networkValue } }),
}))

import DepositView from '../DepositView'
import { apiFetch } from '../../api/client'

function renderDeposit() {
  return render(
    <MemoryRouter>
      <DepositView />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  ;(apiFetch as ReturnType<typeof vi.fn>).mockReset()
  navigateMock.mockReset()
  networkValue = 'devnet'
  currentAuth = {
    status: 'authed',
    token: 'test-token',
    expiresAt: null,
    isAdmin: false,
    publicKey: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
    authenticate: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    error: null,
  }
})

describe('DepositView', () => {
  it('renders the form with AssetSelector and an amount input', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        wallet: 'C1phr...85N',
        balances: { sol: 5, tokens: [], status: 'ok' },
      })
      .mockResolvedValueOnce({ positions: [], available: true, network: 'devnet' })

    renderDeposit()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'SOL' })).toBeInTheDocument()
      expect(screen.getByPlaceholderText('0.0')).toBeInTheDocument()
    })
  })

  it('renders Back to Vault chip that navigates to /vault', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        wallet: 'C1phr...85N',
        balances: { sol: 5, tokens: [], status: 'ok' },
      })
      .mockResolvedValueOnce({ positions: [], available: true, network: 'devnet' })

    renderDeposit()
    const back = await screen.findByRole('button', { name: /back to vault/i })
    fireEvent.click(back)
    expect(navigateMock).toHaveBeenCalledWith('/vault')
  })

  it('renders disabled state and banner copy when network is mainnet', async () => {
    networkValue = 'mainnet'
    renderDeposit()
    expect(screen.getByText(/devnet only/i)).toBeInTheDocument()
    // Form should not be rendered on mainnet (no AssetSelector, no AmountForm)
    expect(screen.queryByPlaceholderText('0.0')).not.toBeInTheDocument()
  })

  it('renders UnauthedEmptyState when status is unauthed', () => {
    currentAuth = {
      ...currentAuth,
      status: 'unauthed',
      token: null,
      publicKey: null,
    }
    renderDeposit()
    expect(screen.getByTestId('unauthed-empty-state')).toBeInTheDocument()
    expect(screen.getByText(/shielded deposit/i)).toBeInTheDocument()
    // Deposit form must be absent when unauthed
    expect(screen.queryByPlaceholderText('0.0')).not.toBeInTheDocument()
  })
})
