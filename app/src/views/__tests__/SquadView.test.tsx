import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SquadView from '../SquadView'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: vi.fn(),
}))

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
}))

import { useAuthState } from '../../hooks/useAuthState'
import { apiFetch } from '../../api/client'
import { makeFakeAuthState } from '../../test-utils/makeFakeAuthState'

function renderSquad(token = 't') {
  return render(
    <MemoryRouter>
      <SquadView token={token} />
    </MemoryRouter>,
  )
}

describe('SquadView admin gating', () => {
  beforeEach(() => {
    navigateMock.mockClear()
    vi.mocked(apiFetch).mockReset()
  })

  it('redirects to dashboard when !isAdmin and renders null', () => {
    vi.mocked(useAuthState).mockReturnValue(
      makeFakeAuthState({ status: 'authed', token: 't', publicKey: 'pk', isAdmin: false }),
    )
    const { container } = renderSquad()
    expect(navigateMock).toHaveBeenCalledWith('/')
    expect(container.firstChild).toBeNull()
  })

  it('does NOT redirect when isAdmin', async () => {
    vi.mocked(useAuthState).mockReturnValue(
      makeFakeAuthState({ status: 'authed', token: 't', publicKey: 'pk', isAdmin: true }),
    )
    vi.mocked(apiFetch).mockResolvedValue({
      agents: [],
      stats: { toolCalls: 0, walletSessions: 0, xPosts: 0, xReplies: 0, blocksScanned: 0, alerts: 0 },
      coordination: [],
      killSwitch: false,
    })
    const { container } = renderSquad()
    await waitFor(() => {
      expect(container.firstChild).not.toBeNull()
    })
    expect(navigateMock).not.toHaveBeenCalled()
  })
})

describe('SquadView sentinel identity', () => {
  beforeEach(() => {
    vi.mocked(useAuthState).mockReturnValue(
      makeFakeAuthState({ status: 'authed', token: 't', publicKey: 'pk', isAdmin: true }),
    )
    vi.mocked(apiFetch).mockResolvedValue({
      agents: [],
      stats: { toolCalls: 0, walletSessions: 0, xPosts: 0, xReplies: 0, blocksScanned: 0, alerts: 0 },
      coordination: [],
      killSwitch: false,
    })
  })

  it('renders SENTINEL eyebrow chip', async () => {
    const { container } = renderSquad()
    await waitFor(() => {
      expect(screen.getByText('SENTINEL')).toBeInTheDocument()
    })
    const chip = container.querySelector('[class*="text-sentinel"]')
    expect(chip).toBeTruthy()
  })
})

describe('SquadView KillSwitch tones', () => {
  beforeEach(() => {
    vi.mocked(useAuthState).mockReturnValue(
      makeFakeAuthState({ status: 'authed', token: 't', publicKey: 'pk', isAdmin: true }),
    )
  })

  it('uses success tones when killSwitch active', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      agents: [],
      stats: { toolCalls: 0, walletSessions: 0, xPosts: 0, xReplies: 0, blocksScanned: 0, alerts: 0 },
      coordination: [],
      killSwitch: true,
    })
    renderSquad()
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
    renderSquad()
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /pause all vault ops/i })
      expect(btn.className).toMatch(/border-danger/)
      expect(btn.className).toMatch(/text-danger/)
    })
  })
})

describe('SquadView AbortController', () => {
  beforeEach(() => {
    // mockClear wipes call history but leaks any mockImplementation set in
    // a prior test in this describe; mockReset clears both. Re-seed the
    // happy-path default so future tests added to this block can still
    // assert on a clean default fixture instead of a never-resolving stub.
    vi.mocked(apiFetch).mockReset()
    vi.mocked(apiFetch).mockResolvedValue({
      agents: [],
      stats: { toolCalls: 0, walletSessions: 0, xPosts: 0, xReplies: 0, blocksScanned: 0, alerts: 0 },
      coordination: [],
      killSwitch: false,
    })
    vi.mocked(useAuthState).mockReturnValue(
      makeFakeAuthState({ status: 'authed', token: 't', publicKey: 'pk', isAdmin: true }),
    )
  })

  it('aborts in-flight /api/squad load on unmount', async () => {
    let capturedSignal: AbortSignal | undefined
    vi.mocked(apiFetch).mockImplementation((_path, opts) => {
      capturedSignal = (opts as { signal?: AbortSignal } | undefined)?.signal
      return new Promise(() => {}) // never resolves
    })
    const { unmount } = renderSquad()
    await waitFor(() => expect(capturedSignal).toBeDefined())
    expect(capturedSignal?.aborted).toBe(false)
    unmount()
    expect(capturedSignal?.aborted).toBe(true)
  })
})
