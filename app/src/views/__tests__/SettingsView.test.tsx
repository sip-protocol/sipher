import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useNetworkConfigStore } from '../../lib/networkConfig'
import { makeFakeAuthState } from '../../test-utils/makeFakeAuthState'

const setActiveViewMock = vi.fn()
vi.mock('../../stores/app', () => ({
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({ setActiveView: setActiveViewMock, activeView: 'settings' }),
}))

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

describe('SettingsView', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    setActiveViewMock.mockReset()
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
    render(<SettingsView />)
    await waitFor(() => {
      expect(setActiveViewMock).toHaveBeenCalledWith('dashboard')
    })
  })

  it('renders network chip from useNetworkConfigStore', async () => {
    useAuthStateMock.mockReturnValue(
      makeFakeAuthState({ publicKey: 'X', token: 't', status: 'authed', isAdmin: true }),
    )
    apiFetchMock.mockResolvedValue(sentinelConfigFixture)
    const { default: SettingsView } = await import('../SettingsView')
    render(<SettingsView />)
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
    render(<SettingsView />)
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
    render(<SettingsView />)
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
    render(<SettingsView />)
    await waitFor(() => {
      expect(screen.getByText(/\$1\.23/)).toBeInTheDocument()
      expect(screen.getByText(/\$10/)).toBeInTheDocument()
    })
  })
})
