import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import SquadView from '../SquadView'

const setActiveViewMock = vi.fn()

vi.mock('../../stores/app', () => ({
  useAppStore: (selector: (s: unknown) => unknown) => selector({ setActiveView: setActiveViewMock }),
}))

vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: vi.fn(),
}))

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
}))

import { useAuthState } from '../../hooks/useAuthState'
import { apiFetch } from '../../api/client'

describe('SquadView admin gating', () => {
  beforeEach(() => {
    setActiveViewMock.mockClear()
    vi.mocked(apiFetch).mockReset()
  })

  it('redirects to dashboard when !isAdmin and renders null', () => {
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: false,
    } as ReturnType<typeof useAuthState>)
    const { container } = render(<SquadView token="t" />)
    expect(setActiveViewMock).toHaveBeenCalledWith('dashboard')
    expect(container.firstChild).toBeNull()
  })

  it('does NOT redirect when isAdmin', async () => {
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: true,
    } as ReturnType<typeof useAuthState>)
    vi.mocked(apiFetch).mockResolvedValue({
      agents: [],
      stats: { toolCalls: 0, walletSessions: 0, xPosts: 0, xReplies: 0, blocksScanned: 0, alerts: 0 },
      coordination: [],
      killSwitch: false,
    })
    const { container } = render(<SquadView token="t" />)
    await waitFor(() => {
      expect(container.firstChild).not.toBeNull()
    })
    expect(setActiveViewMock).not.toHaveBeenCalled()
  })
})

describe('SquadView sentinel identity', () => {
  beforeEach(() => {
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: true,
    } as ReturnType<typeof useAuthState>)
    vi.mocked(apiFetch).mockResolvedValue({
      agents: [],
      stats: { toolCalls: 0, walletSessions: 0, xPosts: 0, xReplies: 0, blocksScanned: 0, alerts: 0 },
      coordination: [],
      killSwitch: false,
    })
  })

  it('renders SENTINEL eyebrow chip', async () => {
    const { container } = render(<SquadView token="t" />)
    await waitFor(() => {
      expect(screen.getByText('SENTINEL')).toBeInTheDocument()
    })
    const chip = container.querySelector('[class*="text-sentinel"]')
    expect(chip).toBeTruthy()
  })
})

describe('SquadView KillSwitch tones', () => {
  beforeEach(() => {
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: true,
    } as ReturnType<typeof useAuthState>)
  })

  it('uses success tones when killSwitch active', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      agents: [],
      stats: { toolCalls: 0, walletSessions: 0, xPosts: 0, xReplies: 0, blocksScanned: 0, alerts: 0 },
      coordination: [],
      killSwitch: true,
    })
    render(<SquadView token="t" />)
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /resume operations/i })
      expect(btn.className).toMatch(/border-success/)
      expect(btn.className).toMatch(/text-success/)
    })
  })

  it('uses danger tones when killSwitch inactive', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      agents: [],
      stats: { toolCalls: 0, walletSessions: 0, xPosts: 0, xReplies: 0, blocksScanned: 0, alerts: 0 },
      coordination: [],
      killSwitch: false,
    })
    render(<SquadView token="t" />)
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /pause all vault ops/i })
      expect(btn.className).toMatch(/border-danger/)
      expect(btn.className).toMatch(/text-danger/)
    })
  })
})
