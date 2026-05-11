import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ConnectionQualityIndicator } from '../ConnectionQualityIndicator'

const originalVisibility = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState')

function setVisibility(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => value,
  })
}

function restoreVisibility() {
  if (originalVisibility) {
    Object.defineProperty(Document.prototype, 'visibilityState', originalVisibility)
  }
}

describe('ConnectionQualityIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setVisibility('visible')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    restoreVisibility()
  })

  it('pings the health endpoint on mount when document is visible', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'))
    await act(async () => {
      render(<ConnectionQualityIndicator />)
      await Promise.resolve()
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [calledPath] = fetchSpy.mock.calls[0]
    expect(typeof calledPath === 'string' ? calledPath : '').toMatch(/\/api\/health/)
  })

  it('renders green dot when latency < 500ms', async () => {
    let perfCalls = 0
    vi.spyOn(performance, 'now').mockImplementation(() => {
      perfCalls += 1
      return perfCalls === 1 ? 0 : 100
    })
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'))

    await act(async () => {
      render(<ConnectionQualityIndicator />)
      await Promise.resolve()
      await Promise.resolve()
    })

    const indicator = screen.getByRole('img')
    expect(indicator.className).toMatch(/bg-emerald-500/)
    expect(indicator.getAttribute('aria-label')).toMatch(/Backend reachable/)
    expect(indicator.getAttribute('aria-label')).toMatch(/100ms/)
  })

  it('renders yellow dot when latency is between 500ms and 2000ms', async () => {
    let perfCalls = 0
    vi.spyOn(performance, 'now').mockImplementation(() => {
      perfCalls += 1
      return perfCalls === 1 ? 0 : 1200
    })
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'))

    await act(async () => {
      render(<ConnectionQualityIndicator />)
      await Promise.resolve()
      await Promise.resolve()
    })

    const indicator = screen.getByRole('img')
    expect(indicator.className).toMatch(/bg-amber-500/)
  })

  it('renders red dot when latency exceeds 2000ms', async () => {
    let perfCalls = 0
    vi.spyOn(performance, 'now').mockImplementation(() => {
      perfCalls += 1
      return perfCalls === 1 ? 0 : 2500
    })
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'))

    await act(async () => {
      render(<ConnectionQualityIndicator />)
      await Promise.resolve()
      await Promise.resolve()
    })

    const indicator = screen.getByRole('img')
    expect(indicator.className).toMatch(/bg-red-500/)
  })

  it('renders red dot and Unreachable label on fetch failure', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    await act(async () => {
      render(<ConnectionQualityIndicator />)
      await Promise.resolve()
      await Promise.resolve()
    })

    const indicator = screen.getByRole('img')
    expect(indicator.className).toMatch(/bg-red-500/)
    expect(indicator.getAttribute('aria-label')).toMatch(/Unreachable/)
  })

  it('does not ping when document is hidden on mount', async () => {
    setVisibility('hidden')
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'))

    await act(async () => {
      render(<ConnectionQualityIndicator />)
      vi.advanceTimersByTime(60_000)
      await Promise.resolve()
    })

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('re-pings every 30 seconds while visible', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'))

    await act(async () => {
      render(<ConnectionQualityIndicator />)
      await Promise.resolve()
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(30_000)
      await Promise.resolve()
    })
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    await act(async () => {
      vi.advanceTimersByTime(30_000)
      await Promise.resolve()
    })
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it('cleans up interval and visibility listener on unmount', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'))
    const removeListenerSpy = vi.spyOn(document, 'removeEventListener')

    const { unmount } = render(<ConnectionQualityIndicator />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    unmount()
    expect(removeListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))

    await act(async () => {
      vi.advanceTimersByTime(60_000)
      await Promise.resolve()
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
