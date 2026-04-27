import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AmountForm from '../AmountForm'

describe('AmountForm', () => {
  it('renders inputs and buttons', () => {
    render(<AmountForm action="Deposit" max={5} onSubmit={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('disables Continue when amount is zero or negative', () => {
    render(<AmountForm action="Deposit" max={5} onSubmit={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  it('disables Continue when amount exceeds max', async () => {
    render(<AmountForm action="Deposit" max={5} onSubmit={() => {}} onCancel={() => {}} />)
    await userEvent.type(screen.getByRole('spinbutton'), '10')
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  it('calls onSubmit with parsed amount', async () => {
    const onSubmit = vi.fn()
    render(<AmountForm action="Deposit" max={5} onSubmit={onSubmit} onCancel={() => {}} />)
    await userEvent.type(screen.getByRole('spinbutton'), '1.5')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onSubmit).toHaveBeenCalledWith(1.5)
  })

  it('calls onCancel', async () => {
    const onCancel = vi.fn()
    render(<AmountForm action="Deposit" max={5} onSubmit={() => {}} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })
})
