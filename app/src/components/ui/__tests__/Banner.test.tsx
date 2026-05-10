import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Banner } from '../Banner'

describe('Banner', () => {
  it('renders children', () => {
    render(<Banner kind="info">Connect a wallet</Banner>)
    expect(screen.getByText('Connect a wallet')).toBeInTheDocument()
  })

  it('uses role=status for info kind', () => {
    render(<Banner kind="info">x</Banner>)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('uses role=alert for warning + error kinds', () => {
    const { rerender } = render(<Banner kind="warning">x</Banner>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    rerender(<Banner kind="error">x</Banner>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('applies info variant tone classes', () => {
    const { container } = render(<Banner kind="info">x</Banner>)
    expect(container.firstChild).toHaveClass(/border-cyan/, /text-cyan/)
  })
})
