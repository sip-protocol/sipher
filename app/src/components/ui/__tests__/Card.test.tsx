import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from '../Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card><span>hello</span></Card>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('applies glass-1 class by default', () => {
    const { container } = render(<Card>x</Card>)
    expect(container.firstChild).toHaveClass('glass-1')
  })

  it('applies glass-2 class when variant=elevated', () => {
    const { container } = render(<Card variant="elevated">x</Card>)
    expect(container.firstChild).toHaveClass('glass-2')
    expect(container.firstChild).not.toHaveClass('glass-1')
  })

  it('applies glass-strong class when variant=strong', () => {
    const { container } = render(<Card variant="strong">x</Card>)
    expect(container.firstChild).toHaveClass('glass-strong')
  })

  it('adds glass-sheen class when sheen=true', () => {
    const { container } = render(<Card sheen>x</Card>)
    expect(container.firstChild).toHaveClass('glass-sheen')
  })

  it('forwards className', () => {
    const { container } = render(<Card className="extra">x</Card>)
    expect(container.firstChild).toHaveClass('glass-1')
    expect(container.firstChild).toHaveClass('extra')
  })
})
