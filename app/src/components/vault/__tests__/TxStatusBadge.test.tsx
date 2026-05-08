import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TxStatusBadge } from '../TxStatusBadge'

vi.mock('../../../lib/networkConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/networkConfig')>()
  return {
    ...actual,
    useNetworkConfigStore: <T,>(selector: (s: { config: { solscanSuffix: string } }) => T) =>
      selector({ config: { solscanSuffix: '?cluster=devnet' } }),
  }
})

describe('TxStatusBadge', () => {
  it('renders idle status without label', () => {
    const { container } = render(<TxStatusBadge status="idle" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders signing status with explicit label', () => {
    render(<TxStatusBadge status="signing" />)
    expect(screen.getByText(/signing/i)).toBeInTheDocument()
  })

  it('renders broadcasting status with explicit label', () => {
    render(<TxStatusBadge status="broadcasting" />)
    expect(screen.getByText(/broadcasting/i)).toBeInTheDocument()
  })

  it('renders confirmed status with Solscan link when signature provided', () => {
    render(<TxStatusBadge status="confirmed" signature="ABCDEF" />)
    expect(screen.getByText(/confirmed/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /solscan/i })
    expect(link).toHaveAttribute('href', expect.stringContaining('ABCDEF'))
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('renders error status with retry-friendly copy', () => {
    render(<TxStatusBadge status="error" />)
    expect(screen.getByText(/failed/i)).toBeInTheDocument()
  })

  it('exposes role="status" for screen-reader announcements on non-idle states', () => {
    const { rerender } = render(<TxStatusBadge status="signing" />)
    expect(screen.getByRole('status')).toBeInTheDocument()

    rerender(<TxStatusBadge status="broadcasting" />)
    expect(screen.getByRole('status')).toBeInTheDocument()

    rerender(<TxStatusBadge status="confirmed" signature="ABCDEF" />)
    expect(screen.getByRole('status')).toBeInTheDocument()

    rerender(<TxStatusBadge status="error" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
