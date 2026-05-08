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
      { getState: () => ({ setActiveView }) },
    ),
  }
})

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

beforeEach(() => {
  mockedFetch.mockReset()
  setActiveView.mockReset()
  networkValue = 'devnet'
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
    render(<VaultView />)
    await waitFor(() => {
      expect(mockedFetch).toHaveBeenCalledWith('/api/vault', expect.anything())
      expect(mockedFetch).toHaveBeenCalledWith('/api/vault/positions', expect.anything())
      expect(mockedFetch).toHaveBeenCalledWith('/api/stealth/index', expect.anything())
    })
  })

  it('renders ShieldedVault and UnshieldedWallet panels', async () => {
    mockThreeFetches()
    render(<VaultView />)
    await waitFor(() => {
      expect(screen.getByText(/SHIELDED VAULT/)).toBeInTheDocument()
      expect(screen.getByText(/UNSHIELDED WALLET/)).toBeInTheDocument()
    })
  })

  it('Shield to vault CTA routes to deposit view', async () => {
    mockThreeFetches()
    render(<VaultView />)
    const cta = await screen.findByRole('button', { name: /shield to vault/i })
    fireEvent.click(cta)
    expect(setActiveView).toHaveBeenCalledWith('deposit')
  })

  it('Withdraw CTA always disabled (PR 6b ships withdraw flow)', async () => {
    mockThreeFetches()
    render(<VaultView />)
    const withdrawBtn = await screen.findByRole('button', { name: /withdraw/i })
    expect(withdrawBtn).toBeDisabled()
    expect(withdrawBtn).toHaveAttribute('title', expect.stringMatching(/coming soon/i))
  })

  it('Withdraw CTA stays disabled even when positions exist', async () => {
    mockThreeFetches(populatedPositions)
    render(<VaultView />)
    const withdrawBtn = await screen.findByRole('button', { name: /withdraw/i })
    expect(withdrawBtn).toBeDisabled()
    fireEvent.click(withdrawBtn)
    expect(setActiveView).not.toHaveBeenCalledWith('withdraw')
  })

  it('Shield to vault CTA disabled on mainnet', async () => {
    networkValue = 'mainnet'
    mockThreeFetches()
    render(<VaultView />)
    const cta = await screen.findByRole('button', { name: /shield to vault/i })
    expect(cta).toBeDisabled()
  })
})
