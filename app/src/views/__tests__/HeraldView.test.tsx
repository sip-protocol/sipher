import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HeraldView from '../HeraldView'
import { makeFakeAuthState } from '../../test-utils/makeFakeAuthState'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

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

function renderHerald(token = 't') {
  return render(
    <MemoryRouter>
      <HeraldView token={token} />
    </MemoryRouter>,
  )
}

describe('HeraldView admin gating', () => {
  beforeEach(() => {
    navigateMock.mockClear()
  })

  it('redirects to dashboard when !isAdmin and renders null', () => {
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: false,
    } as ReturnType<typeof useAuthState>)
    const { container } = renderHerald()
    expect(navigateMock).toHaveBeenCalledWith('/')
    expect(container.firstChild).toBeNull()
  })

  it('does NOT redirect when isAdmin', async () => {
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: true,
    } as ReturnType<typeof useAuthState>)
    const { container } = renderHerald()
    await waitFor(() => {
      expect(container.firstChild).not.toBeNull()
    })
    expect(navigateMock).not.toHaveBeenCalled()
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
    const { container } = renderHerald()
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
    const { container } = renderHerald()
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
    const { container } = renderHerald()
    await waitFor(() => {
      expect(container.querySelector('[class*="bg-danger-soft"]')).toBeTruthy()
    })
  })
})

describe('HeraldView AbortController', () => {
  beforeEach(() => {
    vi.mocked(useAuthState).mockReturnValue(
      makeFakeAuthState({ status: 'authed', token: 't', publicKey: 'pk', isAdmin: true }),
    )
  })

  it('aborts in-flight /api/herald load on unmount', async () => {
    const { apiFetch } = await import('../../api/client')
    let capturedSignal: AbortSignal | undefined
    vi.mocked(apiFetch).mockImplementation((_path, opts) => {
      capturedSignal = (opts as { signal?: AbortSignal } | undefined)?.signal
      return new Promise(() => {}) // never resolves
    })
    const { unmount } = renderHerald()
    await waitFor(() => expect(capturedSignal).toBeDefined())
    expect(capturedSignal?.aborted).toBe(false)
    unmount()
    expect(capturedSignal?.aborted).toBe(true)
  })

  it('does not call apiFetch when token prop is empty even with isAdmin', async () => {
    const { apiFetch } = await import('../../api/client')
    vi.mocked(apiFetch).mockClear()
    const { container } = renderHerald('')
    expect(container.textContent).toMatch(/Connect your wallet to view HERALD activity/i)
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalled()
  })
})
