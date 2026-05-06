import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WalletDropdown } from '../WalletDropdown'

const FULL = 'HciZTd6rR7YsaS5ZNThx9KdgqSimxwMzJgs2j98U25En'

describe('WalletDropdown', () => {
  it('renders pill with shortened address', () => {
    render(
      <WalletDropdown
        address={FULL}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
      />,
    )
    expect(screen.getByText('HciZ...25En')).toBeInTheDocument()
  })

  it('opens dropdown on click and shows three actions', () => {
    render(
      <WalletDropdown
        address={FULL}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    expect(screen.getByText('Copy address')).toBeInTheDocument()
    expect(screen.getByText(/Re-sign in/i)).toBeInTheDocument()
    expect(screen.getByText('Disconnect')).toBeInTheDocument()
  })

  it('toggles closed when pill clicked again', () => {
    render(
      <WalletDropdown
        address={FULL}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
      />,
    )
    const pill = screen.getByRole('button', { name: /HciZ\.\.\.25En/ })
    fireEvent.click(pill)
    expect(screen.getByText('Copy address')).toBeInTheDocument()
    fireEvent.click(pill)
    expect(screen.queryByText('Copy address')).not.toBeInTheDocument()
  })

  it('closes on action click and invokes callback', () => {
    const onDisconnect = vi.fn()
    render(
      <WalletDropdown
        address={FULL}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={onDisconnect}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    fireEvent.click(screen.getByText('Disconnect'))
    expect(onDisconnect).toHaveBeenCalledOnce()
    expect(screen.queryByText('Copy address')).not.toBeInTheDocument()
  })

  it('Copy action invokes onCopy', () => {
    const onCopy = vi.fn()
    render(
      <WalletDropdown
        address={FULL}
        onCopy={onCopy}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    fireEvent.click(screen.getByText('Copy address'))
    expect(onCopy).toHaveBeenCalledOnce()
  })

  it('Re-sign action invokes onReSignIn', () => {
    const onReSignIn = vi.fn()
    render(
      <WalletDropdown
        address={FULL}
        onCopy={vi.fn()}
        onReSignIn={onReSignIn}
        onDisconnect={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    fireEvent.click(screen.getByText(/Re-sign in/i))
    expect(onReSignIn).toHaveBeenCalledOnce()
  })

  it('closes on outside mousedown', () => {
    render(
      <div>
        <WalletDropdown
          address={FULL}
          onCopy={vi.fn()}
          onReSignIn={vi.fn()}
          onDisconnect={vi.fn()}
        />
        <button>outside</button>
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    expect(screen.getByText('Copy address')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByText('outside'))
    expect(screen.queryByText('Copy address')).not.toBeInTheDocument()
  })

  it('closes on Escape key', () => {
    render(
      <WalletDropdown
        address={FULL}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Copy address')).not.toBeInTheDocument()
  })

  it('aria-expanded reflects open state', () => {
    render(
      <WalletDropdown
        address={FULL}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
      />,
    )
    const pill = screen.getByRole('button', { name: /HciZ\.\.\.25En/ })
    expect(pill).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(pill)
    expect(pill).toHaveAttribute('aria-expanded', 'true')
  })
})
