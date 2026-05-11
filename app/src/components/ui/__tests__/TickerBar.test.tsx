import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { TickerBar } from '../TickerBar'

const SOL_MINT = 'So11111111111111111111111111111111111111112'

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  })
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: state === 'hidden',
  })
}

describe('TickerBar', () => {
  beforeEach(() => {
    setVisibility('visible')
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.spyOn(global, 'fetch').mockImplementation(() => Promise.reject(new Error('default')))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    setVisibility('visible')
  })

  it('renders SOL price once data loads', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('lite-api.jup.ag/price')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ [SOL_MINT]: { usdPrice: 189.62 } }),
        }) as unknown as Promise<Response>
      }
      return Promise.reject(new Error('unexpected fetch'))
    })

    render(<TickerBar />)
    await waitFor(() => {
      expect(screen.getByText('SOL')).toBeInTheDocument()
      expect(screen.getByText('189.62')).toBeInTheDocument()
    })
  })

  it('renders em-dash fallback when fetch fails', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'))

    render(<TickerBar />)
    await waitFor(() => {
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThan(0)
    })
  })

  describe('slot field removal', () => {
    it('does not render a SLOT label or slot value', () => {
      ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ [SOL_MINT]: { usdPrice: 100 } }),
        }) as unknown as Promise<Response>,
      )
      render(<TickerBar />)
      expect(screen.queryByText(/slot/i)).not.toBeInTheDocument()
    })
  })

  describe('visibility-gating', () => {
    it('does not poll when document is hidden on mount', () => {
      setVisibility('hidden')
      const fetchSpy = global.fetch as unknown as ReturnType<typeof vi.fn>
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ [SOL_MINT]: { usdPrice: 100 } }),
      } as unknown as Response)

      render(<TickerBar />)
      // Advance >2× the poll cadence — still no fetch should fire.
      act(() => {
        vi.advanceTimersByTime(15_000)
      })
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('resumes polling on hidden → visible transition', async () => {
      setVisibility('hidden')
      const fetchSpy = global.fetch as unknown as ReturnType<typeof vi.fn>
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ [SOL_MINT]: { usdPrice: 100 } }),
      } as unknown as Response)

      render(<TickerBar />)
      expect(fetchSpy).not.toHaveBeenCalled()

      // Flip to visible and dispatch the standard browser event.
      act(() => {
        setVisibility('visible')
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled()
      })
    })

    it('pauses polling on visible → hidden transition', async () => {
      const fetchSpy = global.fetch as unknown as ReturnType<typeof vi.fn>
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ [SOL_MINT]: { usdPrice: 100 } }),
      } as unknown as Response)

      render(<TickerBar />)
      // Allow the immediate visible-mount fetch to register.
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled()
      })
      const callsAfterMount = fetchSpy.mock.calls.length

      act(() => {
        setVisibility('hidden')
        document.dispatchEvent(new Event('visibilitychange'))
      })
      act(() => {
        vi.advanceTimersByTime(15_000)
      })
      expect(fetchSpy.mock.calls.length).toBe(callsAfterMount)
    })
  })
})
