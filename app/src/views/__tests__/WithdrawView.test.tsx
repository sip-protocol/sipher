import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const setActiveView = vi.fn()
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

vi.mock('../../stores/app', async () => {
  const actual = await vi.importActual<typeof import('../../stores/app')>('../../stores/app')
  return {
    ...actual,
    useAppStore: Object.assign(
      (selector: (s: { setActiveView: typeof setActiveView }) => unknown) =>
        selector({ setActiveView }),
      { getState: () => ({ setActiveView }) },
    ),
  }
})

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

beforeEach(() => {
  mockedFetch.mockReset()
  setActiveView.mockReset()
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
    render(<WithdrawView />)
    await waitFor(() => {
      expect(screen.getByText('SOL')).toBeInTheDocument()
    })
  })

  it('renders Back chip that calls setActiveView("vault")', async () => {
    mockedFetch.mockResolvedValueOnce({ positions: [], available: true, network: 'devnet' })
    render(<WithdrawView />)
    const back = await screen.findByRole('button', { name: /back to vault/i })
    fireEvent.click(back)
    expect(setActiveView).toHaveBeenCalledWith('vault')
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

    render(<WithdrawView />)
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
    render(<WithdrawView />)
    expect(screen.getByText(/devnet only/i)).toBeInTheDocument()
    // RefundList should not render on mainnet
    expect(screen.queryByText('SOL')).not.toBeInTheDocument()
  })
})
