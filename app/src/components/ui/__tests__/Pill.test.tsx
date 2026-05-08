import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Pill } from '../Pill'

describe('Pill', () => {
  it('renders label', () => {
    render(<Pill label="ALL" />)
    expect(screen.getByText('ALL')).toBeInTheDocument()
  })

  it('shows active state via aria-pressed=true', () => {
    render(<Pill label="DEPOSIT" active />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows inactive via aria-pressed=false by default', () => {
    render(<Pill label="WITHDRAW" />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onClick when clicked', () => {
    let called = false
    render(<Pill label="X" onClick={() => { called = true }} />)
    fireEvent.click(screen.getByRole('button'))
    expect(called).toBe(true)
  })

  it('applies size=sm class', () => {
    const { container } = render(<Pill label="X" size="sm" />)
    expect(container.firstChild).toHaveClass('text-2xs')
  })

  it('applies size=md (default) class', () => {
    const { container } = render(<Pill label="X" />)
    expect(container.firstChild).toHaveClass('text-xs')
  })
})
