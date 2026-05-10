import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RoutePreviewCard } from '../RoutePreviewCard'

describe('RoutePreviewCard', () => {
  it('renders 3 numbered steps', () => {
    render(
      <RoutePreviewCard
        wallet="C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N"
        amount={1.5}
        asset="SOL"
      />
    )
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders You / Vault PDA / Stealth labels', () => {
    render(<RoutePreviewCard wallet="C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N" />)
    expect(screen.getByText(/You/)).toBeInTheDocument()
    expect(screen.getByText(/Vault PDA/)).toBeInTheDocument()
    expect(screen.getByText(/Stealth/)).toBeInTheDocument()
  })

  it('renders placeholder dashes when amount is 0', () => {
    render(
      <RoutePreviewCard
        wallet="C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N"
        amount={0}
        asset="SOL"
      />
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('wraps Vault PDA label in JargonTerm tooltip', () => {
    render(<RoutePreviewCard wallet="C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N" />)
    const trigger = screen.getByText(/Vault PDA/).closest('button')
    expect(trigger).not.toBeNull()
    fireEvent.mouseEnter(trigger!)
    expect(screen.getByRole('tooltip')).toHaveTextContent(/program-derived address/i)
  })

  it('renders em-dash placeholder when wallet is empty (no unlabelled Copy button)', () => {
    const { container } = render(<RoutePreviewCard wallet="" />)
    // No focusable HashCell button with empty aria-label
    expect(container.querySelector('button[aria-label="Copy "]')).toBeNull()
    // Vault PDA HashCell is still rendered (default)
    expect(
      container.querySelector('button[aria-label*="CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u"]'),
    ).not.toBeNull()
  })
})
