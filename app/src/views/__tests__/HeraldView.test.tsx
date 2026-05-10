import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import HeraldView from '../HeraldView'

const setActiveViewMock = vi.fn()

vi.mock('../../stores/app', () => ({
  useAppStore: (selector: (s: unknown) => unknown) => selector({ setActiveView: setActiveViewMock }),
}))

vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: vi.fn(),
}))

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn().mockResolvedValue({
    queue: [],
    budget: { spent: 0, limit: 100, gate: 'open', percentage: 0 },
    dms: [],
    recentPosts: [],
  }),
}))

import { useAuthState } from '../../hooks/useAuthState'

describe('HeraldView admin gating', () => {
  beforeEach(() => {
    setActiveViewMock.mockClear()
  })

  it('redirects to dashboard when !isAdmin and renders null', () => {
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: false,
    } as ReturnType<typeof useAuthState>)
    const { container } = render(<HeraldView token="t" />)
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
    const { container } = render(<HeraldView token="t" />)
    await waitFor(() => {
      expect(container.firstChild).not.toBeNull()
    })
    expect(setActiveViewMock).not.toHaveBeenCalled()
  })
})

describe('HeraldView budget bar colors', () => {
  beforeEach(() => {
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: true,
    } as ReturnType<typeof useAuthState>)
  })

  it('uses success-soft when budget < 80%', async () => {
    const { apiFetch } = await import('../../api/client')
    vi.mocked(apiFetch).mockResolvedValueOnce({
      queue: [],
      budget: { spent: 30, limit: 100, gate: 'open', percentage: 30 },
      dms: [],
      recentPosts: [],
    })
    const { container } = render(<HeraldView token="t" />)
    await waitFor(() => {
      expect(container.querySelector('[class*="bg-success-soft"]')).toBeTruthy()
    })
  })

  it('uses warning-soft when budget >= 80%', async () => {
    const { apiFetch } = await import('../../api/client')
    vi.mocked(apiFetch).mockResolvedValueOnce({
      queue: [],
      budget: { spent: 85, limit: 100, gate: 'limited', percentage: 85 },
      dms: [],
      recentPosts: [],
    })
    const { container } = render(<HeraldView token="t" />)
    await waitFor(() => {
      expect(container.querySelector('[class*="bg-warning-soft"]')).toBeTruthy()
    })
  })

  it('uses danger-soft when budget >= 95%', async () => {
    const { apiFetch } = await import('../../api/client')
    vi.mocked(apiFetch).mockResolvedValueOnce({
      queue: [],
      budget: { spent: 96, limit: 100, gate: 'blocked', percentage: 96 },
      dms: [],
      recentPosts: [],
    })
    const { container } = render(<HeraldView token="t" />)
    await waitFor(() => {
      expect(container.querySelector('[class*="bg-danger-soft"]')).toBeTruthy()
    })
  })
})
