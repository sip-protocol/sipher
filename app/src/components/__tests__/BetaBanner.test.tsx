import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BetaBanner } from '../BetaBanner'

describe('BetaBanner', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('renders when beta=true', () => {
    render(<BetaBanner beta={true} />)
    expect(screen.getByText(/DEVNET BETA/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /devnet sol/i })).toHaveAttribute(
      'href',
      'https://faucet.solana.com',
    )
  })

  it('renders nothing when beta=false', () => {
    const { container } = render(<BetaBanner beta={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('is dismissible via button, hides for the rest of the session', () => {
    render(<BetaBanner beta={true} />)
    expect(screen.getByText(/DEVNET BETA/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/DEVNET BETA/i)).not.toBeInTheDocument()
  })

  it('respects sessionStorage dismissal across re-renders', () => {
    sessionStorage.setItem('sipher.beta-banner.dismissed', 'true')
    render(<BetaBanner beta={true} />)
    expect(screen.queryByText(/DEVNET BETA/i)).not.toBeInTheDocument()
  })
})
