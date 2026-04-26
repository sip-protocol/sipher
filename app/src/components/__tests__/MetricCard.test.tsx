import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Wallet } from '@phosphor-icons/react'
import MetricCard from '../MetricCard'

describe('MetricCard', () => {
  it('renders normal variant by default', () => {
    render(<MetricCard label="SOL" value="2.45" sub="SOL" icon={<Wallet />} />)
    // label and sub both read "SOL" — both must be present
    expect(screen.getAllByText('SOL')).toHaveLength(2)
    expect(screen.getByText('2.45')).toBeInTheDocument()
  })

  it('renders factor bars in hero variant', () => {
    render(
      <MetricCard
        variant="hero"
        label="Privacy Score"
        value="78"
        sub="/100"
        icon={<Wallet />}
        factors={[
          { label: 'Address reuse', score: 85 },
          { label: 'Amount patterns', score: 72 },
          { label: 'Timing', score: 68 },
          { label: 'Counterparty exposure', score: 90 },
        ]}
      />
    )
    expect(screen.getByText('Address reuse')).toBeInTheDocument()
    expect(screen.getByText('Counterparty exposure')).toBeInTheDocument()
  })

  it('does not render factor section when factors undefined', () => {
    render(<MetricCard variant="hero" label="X" value="1" icon={<Wallet />} />)
    expect(screen.queryByText('Address reuse')).not.toBeInTheDocument()
  })
})
