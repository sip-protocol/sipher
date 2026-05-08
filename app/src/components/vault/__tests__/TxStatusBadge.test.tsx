import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TxStatusBadge } from '../TxStatusBadge'

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
})
