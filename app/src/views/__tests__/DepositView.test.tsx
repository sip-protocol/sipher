import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const setActiveView = vi.fn()
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
      { getState: () => ({ setActiveView }) }
    ),
  }
})

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

beforeEach(() => {
  ;(apiFetch as ReturnType<typeof vi.fn>).mockReset()
  setActiveView.mockReset()
  networkValue = 'devnet'
})

describe('DepositView', () => {
  it('renders the form with AssetSelector and an amount input', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        wallet: 'C1phr...85N',
        balances: { sol: 5, tokens: [], status: 'ok' },
      })
      .mockResolvedValueOnce({ positions: [], available: true, network: 'devnet' })

    render(<DepositView />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'SOL' })).toBeInTheDocument()
      expect(screen.getByPlaceholderText('0.0')).toBeInTheDocument()
    })
  })

  it('renders Back to Vault chip that calls setActiveView("vault")', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        wallet: 'C1phr...85N',
        balances: { sol: 5, tokens: [], status: 'ok' },
      })
      .mockResolvedValueOnce({ positions: [], available: true, network: 'devnet' })

    render(<DepositView />)
    const back = await screen.findByRole('button', { name: /back to vault/i })
    fireEvent.click(back)
    expect(setActiveView).toHaveBeenCalledWith('vault')
  })

  it('renders disabled state and banner copy when network is mainnet', async () => {
    networkValue = 'mainnet'
    render(<DepositView />)
    expect(screen.getByText(/devnet only/i)).toBeInTheDocument()
    // Form should not be rendered on mainnet (no AssetSelector, no AmountForm)
    expect(screen.queryByPlaceholderText('0.0')).not.toBeInTheDocument()
  })
})
