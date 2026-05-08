import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TickerBar } from '../TickerBar'

const SOL_MINT = 'So11111111111111111111111111111111111111112'

describe('TickerBar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.spyOn(global, 'fetch').mockImplementation(() => Promise.reject(new Error('default')))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
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

  it('renders SLOT placeholder until backend exposes it', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ [SOL_MINT]: { usdPrice: 100 } }),
      }) as unknown as Promise<Response>,
    )
    render(<TickerBar />)
    expect(screen.getByText('SLOT')).toBeInTheDocument()
  })
})
