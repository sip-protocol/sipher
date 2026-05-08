import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Gauge } from '../Gauge'

describe('Gauge', () => {
  it('renders the value as the central display', () => {
    render(<Gauge value={72} max={100} />)
    expect(screen.getByText('72')).toBeInTheDocument()
  })

  it('renders /max suffix', () => {
    render(<Gauge value={72} max={100} />)
    expect(screen.getByText('/100')).toBeInTheDocument()
  })

  it('renders the grade label when provided', () => {
    render(<Gauge value={72} max={100} gradeLabel="GOOD" />)
    expect(screen.getByText('GOOD')).toBeInTheDocument()
  })

  it('uses ARIA progressbar role with proper attrs', () => {
    render(<Gauge value={72} max={100} ariaLabel="Privacy score" />)
    const gauge = screen.getByRole('progressbar')
    expect(gauge).toHaveAttribute('aria-valuenow', '72')
    expect(gauge).toHaveAttribute('aria-valuemax', '100')
    expect(gauge).toHaveAttribute('aria-label', 'Privacy score')
  })

  it('clamps values above max to max', () => {
    render(<Gauge value={150} max={100} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  it('clamps negative values to 0', () => {
    render(<Gauge value={-10} max={100} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})
