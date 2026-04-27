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
})
