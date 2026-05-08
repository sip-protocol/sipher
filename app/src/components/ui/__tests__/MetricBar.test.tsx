import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricBar } from '../MetricBar'

describe('MetricBar', () => {
  it('renders label + value', () => {
    render(<MetricBar label="Anonymity set" value={84} />)
    expect(screen.getByText('Anonymity set')).toBeInTheDocument()
    expect(screen.getByText('84')).toBeInTheDocument()
  })

  it('renders helper text below the bar', () => {
    render(<MetricBar label="Time decay" value={91} helper="Avg dwell 6d 12h" />)
    expect(screen.getByText('Avg dwell 6d 12h')).toBeInTheDocument()
  })

  it('clamps values above 100 to 100% width', () => {
    const { container } = render(<MetricBar label="x" value={150} />)
    const fill = container.querySelector('[data-testid="metric-bar-fill"]') as HTMLElement
    expect(fill.style.width).toBe('100%')
  })

  it('clamps negative values to 0%', () => {
    const { container } = render(<MetricBar label="x" value={-10} />)
    const fill = container.querySelector('[data-testid="metric-bar-fill"]') as HTMLElement
    expect(fill.style.width).toBe('0%')
  })

  it('uses ARIA progressbar role with proper attrs', () => {
    render(<MetricBar label="x" value={50} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '50')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).toHaveAttribute('aria-label', 'x')
  })
})
