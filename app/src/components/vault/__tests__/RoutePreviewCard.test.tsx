import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
