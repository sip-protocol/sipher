import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const signAndBroadcast = vi.fn()
let networkValue: 'devnet' | 'mainnet' = 'devnet'

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => ({
    status: 'authed' as const,
    token: 'test-token',
    expiresAt: null,
    isAdmin: false,
    publicKey: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
    authenticate: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    error: null,
  }),
}))

vi.mock('../../hooks/useTransactionSigner', () => ({
  useTransactionSigner: () => ({
    signAndBroadcast,
    status: 'idle' as const,
    setStatus: vi.fn(),
    reset: vi.fn(),
  }),
}))

vi.mock('../../lib/networkConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/networkConfig')>()
  return {
    ...actual,
    useNetworkConfigStore: <T,>(
      selector: (s: { config: { network: string; solscanSuffix: string } }) => T,
    ) => selector({ config: { network: networkValue, solscanSuffix: '?cluster=devnet' } }),
  }
})

import WithdrawView from '../WithdrawView'
import { apiFetch } from '../../api/client'

const mockedFetch = apiFetch as ReturnType<typeof vi.fn>

const fakePosition = {
  mint: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  balance: '2500000000',
  balanceUiAmount: 2.5,
  lockedAmount: '0',
  decimals: 9,
  lastDepositAt: 1715000000,
  refundableAt: 1715086400,
  cooldownActive: false,
  depositRecordAddress: 'DEPOSITRECORDPDA',
}

function renderWithdraw() {
  return render(
    <MemoryRouter>
      <WithdrawView />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockedFetch.mockReset()
  navigateMock.mockReset()
  signAndBroadcast.mockReset()
  networkValue = 'devnet'
})

describe('WithdrawView', () => {
  it('renders RefundList with positions from /api/vault/positions', async () => {
    mockedFetch.mockResolvedValueOnce({
      positions: [fakePosition],
      available: true,
      network: 'devnet',
    })
    renderWithdraw()
    await waitFor(() => {
      expect(screen.getByText('SOL')).toBeInTheDocument()
    })
  })

  it('renders Back chip that navigates to /vault', async () => {
    mockedFetch.mockResolvedValueOnce({ positions: [], available: true, network: 'devnet' })
    renderWithdraw()
    const back = await screen.findByRole('button', { name: /back to vault/i })
    fireEvent.click(back)
    expect(navigateMock).toHaveBeenCalledWith('/vault')
  })

  it('clicking Refund calls /api/vault/refund-tx and signAndBroadcast', async () => {
    mockedFetch.mockImplementation((path: string) => {
      if (path === '/api/vault/positions')
        return Promise.resolve({ positions: [fakePosition], available: true, network: 'devnet' })
      if (path === '/api/vault/refund-tx')
        return Promise.resolve({ serializedTx: 'BASE64TX', refundAmount: '2500000000' })
      return Promise.reject(new Error('unexpected: ' + path))
    })
    signAndBroadcast.mockResolvedValueOnce({ signature: 'CONFIRMED_SIG' })

    renderWithdraw()
    const refundBtn = await screen.findByRole('button', { name: /^refund$/i })
    fireEvent.click(refundBtn)
    await waitFor(() => {
      expect(mockedFetch).toHaveBeenCalledWith(
        '/api/vault/refund-tx',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(signAndBroadcast).toHaveBeenCalledWith('BASE64TX')
    })
  })

  it('shows mainnet-disabled copy when network is mainnet', async () => {
    networkValue = 'mainnet'
    renderWithdraw()
    expect(screen.getByText(/devnet only/i)).toBeInTheDocument()
    // RefundList should not render on mainnet
    expect(screen.queryByText('SOL')).not.toBeInTheDocument()
  })
})
