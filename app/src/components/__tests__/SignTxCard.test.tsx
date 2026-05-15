import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAppStore } from '../../stores/app'
import SignTxCard from '../SignTxCard'

const signAndBroadcastMock = vi.fn()
const useWalletMock = vi.fn()
const useConnectionMock = vi.fn()

vi.mock('../../hooks/useTransactionSigner', () => ({
  useTransactionSigner: () => ({
    signAndBroadcast: signAndBroadcastMock,
    status: 'idle' as const,
    setStatus: vi.fn(),
    reset: vi.fn(),
  }),
}))

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => useWalletMock(),
  useConnection: () => useConnectionMock(),
}))

vi.mock('../../hooks/useAuthState', async () => {
  const { useAppStore: store } = await vi.importActual<
    typeof import('../../stores/app')
  >('../../stores/app')
  return {
    useAuthState: () => ({
      status: 'authed' as const,
      token: store.getState().token,
      expiresAt: null,
      isAdmin: false,
      publicKey: null,
      authenticate: () => Promise.resolve(),
      disconnect: () => Promise.resolve(),
      error: null,
    }),
  }
})

const DEFAULT_PROPS = {
  flagId: 'flag-1',
  toolName: 'send' as const,
  serializedTx: 'BASE64TX',
  network: 'devnet' as const,
  walletPubkey: 'WalletABC',
  display: {
    title: 'Send 1 SOL to alice.sol',
    primaryDetail: 'Stealth recipient',
    secondaryDetails: ['Protocol fee: 0.005 SOL', 'Net amount: 0.995 SOL'],
  },
  onResolved: vi.fn(),
}

describe('SignTxCard', () => {
  beforeEach(() => {
    useAppStore.setState({ token: 't' })
    signAndBroadcastMock.mockReset()
    useWalletMock.mockReturnValue({ publicKey: { toBase58: () => 'WalletABC' } })
    useConnectionMock.mockReturnValue({ connection: { rpcEndpoint: 'https://api.devnet.solana.com' } })
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'accepted' }), { status: 200 })) as typeof fetch
  })

  it('renders title, primaryDetail, secondaryDetails, and Sign button', () => {
    render(<SignTxCard {...DEFAULT_PROPS} />)
    expect(screen.getByText('Send 1 SOL to alice.sol')).toBeInTheDocument()
    expect(screen.getByText('Stealth recipient')).toBeInTheDocument()
    expect(screen.getByText('Protocol fee: 0.005 SOL')).toBeInTheDocument()
    expect(screen.getByText('Net amount: 0.995 SOL')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign with wallet/i })).toBeInTheDocument()
  })

  it('signs, posts /confirm, and calls onResolved("confirm") on happy path', async () => {
    signAndBroadcastMock.mockResolvedValue({ signature: 'SIG_XYZ' })
    const onResolved = vi.fn()
    render(<SignTxCard {...DEFAULT_PROPS} onResolved={onResolved} />)
    await userEvent.click(screen.getByRole('button', { name: /sign with wallet/i }))
    await waitFor(() => expect(signAndBroadcastMock).toHaveBeenCalledWith('BASE64TX'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/tool-signing/flag-1/confirm',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer t' }),
          body: JSON.stringify({ signature: 'SIG_XYZ' }),
        }),
      )
    })
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith('confirm'))
  })

  it('posts /reject and calls onResolved("reject") on Cancel click', async () => {
    const onResolved = vi.fn()
    render(<SignTxCard {...DEFAULT_PROPS} onResolved={onResolved} />)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/tool-signing/flag-1/reject',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith('reject'))
  })

  it('shows error and enables Retry when signAndBroadcast returns error', async () => {
    signAndBroadcastMock.mockResolvedValue({ error: 'User rejected request' })
    render(<SignTxCard {...DEFAULT_PROPS} />)
    await userEvent.click(screen.getByRole('button', { name: /sign with wallet/i }))
    await waitFor(() => expect(screen.getByText(/user rejected request/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('disables Sign and shows reconnect message on wallet mismatch', () => {
    useWalletMock.mockReturnValue({ publicKey: { toBase58: () => 'DIFFERENT' } })
    render(<SignTxCard {...DEFAULT_PROPS} />)
    expect(screen.getByText(/reconnect/i)).toBeInTheDocument()
    const signBtn = screen.getByRole('button', { name: /sign with wallet/i })
    expect(signBtn).toBeDisabled()
  })

  it('disables Sign and shows network mismatch warning when RPC cluster differs', () => {
    useConnectionMock.mockReturnValue({ connection: { rpcEndpoint: 'https://api.mainnet-beta.solana.com' } })
    render(<SignTxCard {...DEFAULT_PROPS} network="devnet" />)
    expect(screen.getByText(/wrong network/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign with wallet/i })).toBeDisabled()
  })

  it('shows confirm-callback error and allows retry when /confirm POST fails', async () => {
    signAndBroadcastMock.mockResolvedValue({ signature: 'SIG_XYZ' })
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'expired' } }), { status: 404 }),
    ) as typeof fetch
    render(<SignTxCard {...DEFAULT_PROPS} />)
    await userEvent.click(screen.getByRole('button', { name: /sign with wallet/i }))
    await waitFor(() => expect(screen.getByText(/expired|session/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('does NOT fire reject beacon when transitioning idle → signing (regression for #74a8886 race)', async () => {
    signAndBroadcastMock.mockResolvedValue({ signature: 'SIG_XYZ' })
    // Spy on global.fetch to count POST /reject vs /confirm
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'accepted' }), { status: 200 }))
    global.fetch = fetchSpy as typeof fetch

    // Also spy on navigator.sendBeacon (not always present in jsdom)
    const beaconSpy = vi.fn()
    Object.defineProperty(window.navigator, 'sendBeacon', {
      value: beaconSpy,
      configurable: true,
    })

    render(<SignTxCard {...DEFAULT_PROPS} />)
    await userEvent.click(screen.getByRole('button', { name: /sign with wallet/i }))
    await waitFor(() => expect(signAndBroadcastMock).toHaveBeenCalled())

    // Assert no /reject fetch fired and no /reject beacon fired during sign flow
    const rejectCalls = fetchSpy.mock.calls.filter(([url]) =>
      typeof url === 'string' && url.includes('/reject'),
    )
    expect(rejectCalls.length).toBe(0)
    const rejectBeacons = beaconSpy.mock.calls.filter(([url]) =>
      typeof url === 'string' && url.includes('/reject'),
    )
    expect(rejectBeacons.length).toBe(0)
  })

  it('fires reject beacon on unmount-while-idle', () => {
    const beaconSpy = vi.fn().mockReturnValue(true)
    Object.defineProperty(window.navigator, 'sendBeacon', {
      value: beaconSpy,
      configurable: true,
    })

    const { unmount } = render(<SignTxCard {...DEFAULT_PROPS} />)
    unmount()

    const rejectBeacons = beaconSpy.mock.calls.filter(([url]) =>
      typeof url === 'string' && url.includes('/reject'),
    )
    expect(rejectBeacons.length).toBe(1)
  })

  describe('expired state', () => {
    it('renders only a Dismiss button (no Sign / Cancel)', () => {
      render(<SignTxCard {...DEFAULT_PROPS} expired />)
      expect(screen.queryByRole('button', { name: /sign with wallet/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
    })

    it('shows the "Expired" hint copy', () => {
      render(<SignTxCard {...DEFAULT_PROPS} expired />)
      expect(screen.getByText(/expired/i)).toBeInTheDocument()
    })

    it('still displays the original title / detail / secondary lines', () => {
      render(<SignTxCard {...DEFAULT_PROPS} expired />)
      expect(screen.getByText('Send 1 SOL to alice.sol')).toBeInTheDocument()
      expect(screen.getByText('Protocol fee: 0.005 SOL')).toBeInTheDocument()
    })

    it('calls onResolved("dismiss") when Dismiss clicked', async () => {
      const onResolved = vi.fn()
      render(<SignTxCard {...DEFAULT_PROPS} expired onResolved={onResolved} />)
      await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
      expect(onResolved).toHaveBeenCalledWith('dismiss')
    })

    it('does NOT fire the reject beacon on unmount when expired', () => {
      const beaconSpy = vi.fn().mockReturnValue(true)
      Object.defineProperty(window.navigator, 'sendBeacon', {
        value: beaconSpy,
        configurable: true,
      })

      const { unmount } = render(<SignTxCard {...DEFAULT_PROPS} expired />)
      unmount()

      const rejectBeacons = beaconSpy.mock.calls.filter(([url]) =>
        typeof url === 'string' && url.includes('/reject'),
      )
      expect(rejectBeacons.length).toBe(0)
    })

    it('region aria-label changes to convey expiry', () => {
      render(<SignTxCard {...DEFAULT_PROPS} expired />)
      expect(screen.getByRole('region', { name: /expired send signing request/i })).toBeInTheDocument()
    })
  })
})
