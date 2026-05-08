import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ShieldedVolumeCard } from '../ShieldedVolumeCard'

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
}))

import { apiFetch } from '../../api/client'

beforeEach(() => {
  ;(apiFetch as ReturnType<typeof vi.fn>).mockReset()
})

describe('ShieldedVolumeCard', () => {
  it('renders the formatted TVL once data loads', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      totalTvlSol: 1234.567,
      chainCount: 12,
      liveChainCount: 9,
      asOf: '2026-05-08T00:00:00Z',
    })
    render(<ShieldedVolumeCard />)
    await waitFor(() => expect(screen.getByText('1,234.57')).toBeInTheDocument())
    expect(screen.getByText('SOL')).toBeInTheDocument()
    expect(screen.getByText(/9 CHAINS LIVE/)).toBeInTheDocument()
  })

  it('renders an em-dash placeholder before data loads', () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(new Promise(() => {}))
    render(<ShieldedVolumeCard />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText(/0 CHAINS LIVE/)).toBeInTheDocument()
  })

  it('falls back to em-dash when fetch errors', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'))
    render(<ShieldedVolumeCard />)
    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })
})
