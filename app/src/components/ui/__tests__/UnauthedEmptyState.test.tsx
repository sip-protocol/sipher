import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { UnauthedEmptyState } from '../UnauthedEmptyState'

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: vi.fn(), visible: false }),
}))

describe('UnauthedEmptyState', () => {
  it('renders title and body', () => {
    render(<UnauthedEmptyState title="Stealth Keys" body="Connect to view." />)
    expect(screen.getByText('Stealth Keys')).toBeInTheDocument()
    expect(screen.getByText('Connect to view.')).toBeInTheDocument()
  })

  it('renders default CTA when none provided', () => {
    render(<UnauthedEmptyState title="X" body="Y" />)
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
  })

  it('renders custom CTA when provided', () => {
    render(
      <UnauthedEmptyState
        title="X"
        body="Y"
        cta={<a href="/about">Learn more</a>}
      />,
    )
    expect(screen.getByRole('link', { name: /learn more/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /connect/i })).toBeNull()
  })

  it('renders illustration when provided', () => {
    render(
      <UnauthedEmptyState
        title="X"
        body="Y"
        illustration={<div data-testid="hero">hero</div>}
      />,
    )
    expect(screen.getByTestId('hero')).toBeInTheDocument()
  })

  it('does not render illustration container when illustration is omitted', () => {
    const { container } = render(<UnauthedEmptyState title="X" body="Y" />)
    expect(container.querySelector('[data-testid="empty-state-illustration"]')).toBeNull()
  })

  it('renders rich body content (ReactNode, not just string)', () => {
    render(
      <UnauthedEmptyState
        title="X"
        body={<>Connect a wallet to <strong>deposit</strong>.</>}
      />,
    )
    expect(screen.getByText('deposit')).toBeInTheDocument()
  })
})
