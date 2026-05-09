import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Chip } from '../Chip'

describe('Chip', () => {
  it('renders children', () => {
    render(<Chip>HELLO</Chip>)
    expect(screen.getByText('HELLO')).toBeInTheDocument()
  })

  it('defaults to neutral tone', () => {
    render(<Chip data-testid="chip">A</Chip>)
    const el = screen.getByTestId('chip')
    expect(el.className).toContain('border-line')
    expect(el.className).toContain('text-text-muted')
  })

  it.each([
    ['success', ['border-success/40', 'bg-success-soft', 'text-success']],
    ['danger', ['border-danger/40', 'bg-danger-soft', 'text-danger']],
    ['warning', ['border-warning/40', 'bg-warning-soft', 'text-warning']],
    ['cyan', ['border-cyan/40', 'bg-cyan-soft', 'text-cyan-hi']],
    ['accent', ['border-accent/40', 'bg-accent-soft', 'text-accent-hi']],
    ['herald', ['border-herald/40', 'bg-herald-soft', 'text-herald']],
    ['sentinel', ['border-sentinel/40', 'bg-sentinel-soft', 'text-sentinel']],
  ] as const)('applies %s tone classes', (tone, classes) => {
    render(<Chip tone={tone} data-testid="chip">A</Chip>)
    const el = screen.getByTestId('chip')
    classes.forEach((cls) => expect(el.className).toContain(cls))
  })

  it('renders icon slot before children', () => {
    render(
      <Chip icon={<span data-testid="icon">!</span>} data-testid="chip">LABEL</Chip>,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText('LABEL')).toBeInTheDocument()
  })

  it('forwards className for layering', () => {
    render(<Chip className="self-start mt-2" data-testid="chip">X</Chip>)
    const el = screen.getByTestId('chip')
    expect(el.className).toContain('self-start')
    expect(el.className).toContain('mt-2')
  })

  it('includes the rounded-pill base class', () => {
    render(<Chip data-testid="chip">X</Chip>)
    const el = screen.getByTestId('chip')
    expect(el.className).toContain('rounded-pill')
    expect(el.className).toContain('uppercase')
  })
})
