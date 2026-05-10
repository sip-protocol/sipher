import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmCard from '../ConfirmCard'

describe('ConfirmCard', () => {
  it('renders normal variant with action and amount', () => {
    render(
      <ConfirmCard action="Send" amount="1.5 SOL" onConfirm={() => {}} onCancel={() => {}} />
    )
    expect(screen.getByText(/Send.*1\.5 SOL/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm & sign/i })).toBeInTheDocument()
  })

  it('renders warning variant with description and Override button', () => {
    render(
      <ConfirmCard
        variant="warning"
        action="Send"
        amount="5 SOL"
        description="Address has 2 high-risk signals"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText(/2 high-risk signals/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /override & send/i })).toBeInTheDocument()
  })

  it('fires onConfirm and onCancel callbacks', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmCard action="Send" amount="1 SOL" onConfirm={onConfirm} onCancel={onCancel} />
    )
    await userEvent.click(screen.getByRole('button', { name: /confirm & sign/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('uses sentinel tones for warning variant', () => {
    const { container } = render(
      <ConfirmCard
        variant="warning"
        action="Send"
        amount="5 SOL"
        description="Address has 2 high-risk signals"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    const card = container.querySelector('[class*="border-sentinel"]')
    expect(card).toBeTruthy()
    const overrideBtn = screen.getByRole('button', { name: /override & send/i })
    expect(overrideBtn.className).toMatch(/text-sentinel/)
    expect(overrideBtn.className).toMatch(/border-sentinel/)
    const icon = container.querySelector('svg[aria-hidden="true"]')
    expect(icon).toBeTruthy()
    expect(icon?.getAttribute('class') ?? '').toMatch(/text-sentinel/)
  })

  it('uses bg-glass-1 (not bg-card) for both variants', () => {
    const { container: c1 } = render(
      <ConfirmCard action="Send" amount="1 SOL" onConfirm={() => {}} onCancel={() => {}} />
    )
    expect(c1.querySelector('[class*="bg-glass-1"]')).toBeTruthy()
    expect(c1.querySelector('[class*="bg-card"]')).toBeNull()

    const { container: c2 } = render(
      <ConfirmCard variant="warning" action="Send" amount="1 SOL" onConfirm={() => {}} onCancel={() => {}} />
    )
    expect(c2.querySelector('[class*="bg-glass-1"]')).toBeTruthy()
    expect(c2.querySelector('[class*="bg-card"]')).toBeNull()
  })
})
