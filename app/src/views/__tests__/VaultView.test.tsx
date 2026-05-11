import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { onAuthClear } from '../../store/onAuthClear'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

let networkValue: 'devnet' | 'mainnet' = 'devnet'

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
}))

const useAuthStateMock = vi.fn()
vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => useAuthStateMock(),
}))

vi.mock('../../lib/networkConfig', () => ({
  useNetworkConfigStore: <T,>(selector: (s: { config: { network: string } }) => T) =>
    selector({ config: { network: networkValue } }),
}))

import VaultView from '../VaultView'
import { apiFetch } from '../../api/client'

const mockedFetch = apiFetch as ReturnType<typeof vi.fn>

const fakeVault = {
  wallet: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
  network: 'devnet',
  balances: { sol: 5, tokens: [], status: 'ok' },
}
interface PositionsResponse {
  positions: Array<{
    mint: string
    symbol: string
    balance: string
    balanceUiAmount: number
    lockedAmount: string
    decimals: number
    lastDepositAt: number
    refundableAt: number
    cooldownActive: boolean
    depositRecordAddress: string
  }>
  available: boolean
  network: string
}

const emptyPositions: PositionsResponse = { positions: [], available: true, network: 'devnet' }
const fakeTree = {
  tree: [
    {
      index: 0,
      derivationPath: "m/0'",
      stealthAddress: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
      parentIndex: null,
      createdAt: '2026-05-08',
    },
  ],
  rootWallet: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
}

const populatedPositions: PositionsResponse = {
  positions: [
    {
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      balance: '1000000000',
      balanceUiAmount: 1,
      lockedAmount: '0',
      decimals: 9,
      lastDepositAt: 0,
      refundableAt: 0,
      cooldownActive: false,
      depositRecordAddress: 'DepositRecord1111111111111111111111111111111',
    },
  ],
  available: true,
  network: 'devnet',
}

function renderVault() {
  return render(
    <MemoryRouter>
      <VaultView />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockedFetch.mockReset()
  navigateMock.mockReset()
  networkValue = 'devnet'
  onAuthClear._resetForTests()
  useAuthStateMock.mockReturnValue({
    status: 'authed' as const,
    token: 'test-token',
    expiresAt: null,
    isAdmin: false,
    publicKey: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
    authenticate: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    error: null,
  })
})

function mockThreeFetches(positionsResponse: PositionsResponse = emptyPositions) {
  mockedFetch.mockImplementation((path: string) => {
    if (path === '/api/vault') return Promise.resolve(fakeVault)
    if (path === '/api/vault/positions') return Promise.resolve(positionsResponse)
    if (path === '/api/stealth/index') return Promise.resolve(fakeTree)
    return Promise.reject(new Error('unexpected path: ' + path))
  })
}

describe('VaultView (split-panel)', () => {
  it('fires three parallel fetches on mount', async () => {
    mockThreeFetches()
    renderVault()
    await waitFor(() => {
      expect(mockedFetch).toHaveBeenCalledWith('/api/vault', expect.anything())
      expect(mockedFetch).toHaveBeenCalledWith('/api/vault/positions', expect.anything())
      expect(mockedFetch).toHaveBeenCalledWith('/api/stealth/index', expect.anything())
    })
  })

  it('renders ShieldedVault and UnshieldedWallet panels', async () => {
    mockThreeFetches()
    renderVault()
    await waitFor(() => {
      expect(screen.getByText(/SHIELDED VAULT/)).toBeInTheDocument()
      expect(screen.getByText(/UNSHIELDED WALLET/)).toBeInTheDocument()
    })
  })

  it('Shield to vault CTA navigates to /vault/deposit', async () => {
    mockThreeFetches()
    renderVault()
    const cta = await screen.findByRole('button', { name: /shield to vault/i })
    fireEvent.click(cta)
    expect(navigateMock).toHaveBeenCalledWith('/vault/deposit')
  })

  it('Withdraw CTA navigates to /vault/withdraw', async () => {
    mockThreeFetches()
    renderVault()
    const withdrawBtn = await screen.findByRole('button', { name: /withdraw/i })
    fireEvent.click(withdrawBtn)
    expect(navigateMock).toHaveBeenCalledWith('/vault/withdraw')
  })

  it('Withdraw CTA still navigates when positions exist', async () => {
    mockThreeFetches(populatedPositions)
    renderVault()
    const withdrawBtn = await screen.findByRole('button', { name: /withdraw/i })
    fireEvent.click(withdrawBtn)
    expect(navigateMock).toHaveBeenCalledWith('/vault/withdraw')
  })

  it('Withdraw CTA disabled on mainnet', async () => {
    networkValue = 'mainnet'
    mockThreeFetches()
    renderVault()
    const withdrawBtn = await screen.findByRole('button', { name: /withdraw/i })
    expect(withdrawBtn).toBeDisabled()
  })

  it('Shield to vault CTA disabled on mainnet', async () => {
    networkValue = 'mainnet'
    mockThreeFetches()
    renderVault()
    const cta = await screen.findByRole('button', { name: /shield to vault/i })
    expect(cta).toBeDisabled()
  })

  it('clears vault, positions, and stealth tree on onAuthClear.clearAll', async () => {
    mockThreeFetches(populatedPositions)
    renderVault()
    await waitFor(() => {
      expect(screen.getByText('1 positions')).toBeInTheDocument()
    })
    act(() => onAuthClear.clearAll())
    await waitFor(() => {
      expect(screen.getByText('0 positions')).toBeInTheDocument()
    })
  })

  it('renders UnauthedEmptyState when status is unauthed', () => {
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
    mockThreeFetches()
    renderVault()
    expect(screen.getByTestId('unauthed-empty-state')).toBeInTheDocument()
    expect(screen.queryByText(/SHIELDED VAULT/)).toBeNull()
    expect(screen.queryByText(/UNSHIELDED WALLET/)).toBeNull()
    expect(screen.queryByRole('button', { name: /withdraw/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /shield to vault/i })).toBeNull()
  })

  it('renders connect-wallet Banner above UnauthedEmptyState when unauthed', () => {
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
    mockThreeFetches()
    renderVault()
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent(/connected-wallet feature|connect your wallet/i)
  })

  it('renders UnauthedEmptyState when status is connecting', () => {
    useAuthStateMock.mockReturnValue({
      status: 'connecting' as const,
      token: null,
      publicKey: null,
      isAdmin: false,
      expiresAt: null,
      authenticate: () => Promise.resolve(),
      disconnect: () => Promise.resolve(),
      error: null,
    })
    mockThreeFetches()
    renderVault()
    expect(screen.getByTestId('unauthed-empty-state')).toBeInTheDocument()
  })

  it('does not fire fetches when unauthed', () => {
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
    renderVault()
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  describe('SEO metadata', () => {
    it('renders SIPHER — Vault title and og description', async () => {
      mockThreeFetches()
      renderVault()
      await waitFor(() => {
        expect(document.title).toBe('SIPHER — Vault')
      })
      expect(document.querySelector('meta[property="og:description"]')?.getAttribute('content'))
        .toBe('Shielded vault for private deposits and withdrawals on Solana.')
    })
  })
})
