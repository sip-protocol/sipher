import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import EventIcon from '../EventIcon'

describe('EventIcon', () => {
  it('renders an icon by event type', () => {
    const { container } = render(<EventIcon type="deposit" color="#10B981" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('applies pulse animation when live=true', () => {
    const { container } = render(<EventIcon type="deposit" color="#10B981" live />)
    expect(container.firstChild).toHaveClass('animate-pulse')
  })

  it('does not pulse when live=false', () => {
    const { container } = render(<EventIcon type="deposit" color="#10B981" />)
    expect(container.firstChild).not.toHaveClass('animate-pulse')
  })

  it('falls back to a circle icon for unknown event types', () => {
    const { container } = render(<EventIcon type="bogus" color="#10B981" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
