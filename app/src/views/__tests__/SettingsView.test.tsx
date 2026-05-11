import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { useNetworkConfigStore } from '../../lib/networkConfig'
import { makeFakeAuthState } from '../../test-utils/makeFakeAuthState'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const useAuthStateMock = vi.fn()
vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => useAuthStateMock(),
}))

const apiFetchMock = vi.fn()
vi.mock('../../api/client', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

const sentinelConfigFixture = {
  mode: 'advisory',
  preflightScope: 'fund-actions',
  preflightSkipAmount: 0.1,
  largeTransferThreshold: 10,
  threatCheckEnabled: true,
  blacklistAutonomy: true,
  cancelWindowMs: 30000,
  rateLimitFundPerHour: 5,
  rateLimitBlacklistPerHour: 20,
  scanInterval: 60000,
  activeScanInterval: 15000,
  autoRefundThreshold: 1,
  model: 'openrouter:anthropic/claude-sonnet-4.6',
  dailyBudgetUsd: 10,
  dailyCostUsd: 0,
  blockOnError: false,
  fundMovingTools: ['send', 'deposit', 'swap', 'sweep', 'consolidate', 'splitSend', 'scheduleSend', 'drip', 'recurring', 'refund'],
}

function renderSettings(SettingsView: React.ComponentType) {
  return render(
    <MemoryRouter>
      <SettingsView />
    </MemoryRouter>,
  )
}

describe('SettingsView', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    navigateMock.mockReset()
    useAuthStateMock.mockReset()
    useNetworkConfigStore.setState({
      config: {
        network: 'devnet',
        clusterName: 'devnet',
        publicRpcUrl: 'https://api.devnet.solana.com',
        programIds: { sipherVault: 'X', sipPrivacy: 'Y' },
        vaultConfig: 'Z',
        beta: true,
        solscanSuffix: '?cluster=devnet',
      },
      error: null,
    })
  })

  it('redirects non-admin to dashboard', async () => {
    useAuthStateMock.mockReturnValue(
      makeFakeAuthState({ publicKey: 'X', token: 't', status: 'authed', isAdmin: false }),
    )
    const { default: SettingsView } = await import('../SettingsView')
    renderSettings(SettingsView)
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/')
    })
  })

  it('renders network chip from useNetworkConfigStore', async () => {
    useAuthStateMock.mockReturnValue(
      makeFakeAuthState({ publicKey: 'X', token: 't', status: 'authed', isAdmin: true }),
    )
    apiFetchMock.mockResolvedValue(sentinelConfigFixture)
    const { default: SettingsView } = await import('../SettingsView')
    renderSettings(SettingsView)
    await waitFor(() => {
      expect(screen.getByText(/devnet/i)).toBeInTheDocument()
    })
  })

  it('renders SENTINEL mode chip with warning tone for advisory', async () => {
    useAuthStateMock.mockReturnValue(
      makeFakeAuthState({ publicKey: 'X', token: 't', status: 'authed', isAdmin: true }),
    )
    apiFetchMock.mockResolvedValue(sentinelConfigFixture)
    const { default: SettingsView } = await import('../SettingsView')
    renderSettings(SettingsView)
    await waitFor(() => {
      const chip = screen.getByText(/^advisory$/i)
      expect(chip).toBeInTheDocument()
      expect(chip.className).toContain('bg-warning-soft')
    })
  })

  it('renders all 10 fund-moving tools', async () => {
    useAuthStateMock.mockReturnValue(
      makeFakeAuthState({ publicKey: 'X', token: 't', status: 'authed', isAdmin: true }),
    )
    apiFetchMock.mockResolvedValue(sentinelConfigFixture)
    const { default: SettingsView } = await import('../SettingsView')
    renderSettings(SettingsView)
    await waitFor(() => {
      sentinelConfigFixture.fundMovingTools.forEach((tool) => {
        expect(screen.getByText(tool, { selector: 'span' })).toBeInTheDocument()
      })
    })
  })

  it('renders dailyCostUsd / dailyBudgetUsd', async () => {
    useAuthStateMock.mockReturnValue(
      makeFakeAuthState({ publicKey: 'X', token: 't', status: 'authed', isAdmin: true }),
    )
    apiFetchMock.mockResolvedValue({ ...sentinelConfigFixture, dailyCostUsd: 1.23 })
    const { default: SettingsView } = await import('../SettingsView')
    renderSettings(SettingsView)
    await waitFor(() => {
      expect(screen.getByText(/\$1\.23/)).toBeInTheDocument()
      expect(screen.getByText(/\$10/)).toBeInTheDocument()
    })
  })

  it('ignores AbortError thrown directly (not via controller.abort())', async () => {
    // Regression-locker for the convention switch from
    // `if (!signal.aborted)` to `if (err.name === 'AbortError') return`.
    // An AbortError surfaced from a downstream code path (rather than via
    // the local controller) must not paint the error card.
    useAuthStateMock.mockReturnValue(
      makeFakeAuthState({ publicKey: 'X', token: 't', status: 'authed', isAdmin: true }),
    )
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' })
    apiFetchMock.mockRejectedValueOnce(abortError)
    const { default: SettingsView } = await import('../SettingsView')
    const { container } = renderSettings(SettingsView)
    await waitFor(() => {
      expect(container.firstChild).not.toBeNull()
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
