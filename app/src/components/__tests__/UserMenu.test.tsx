import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserMenu } from '../UserMenu'

const FULL = 'HciZTd6rR7YsaS5ZNThx9KdgqSimxwMzJgs2j98U25En'

describe('UserMenu', () => {
  it('renders pill with shortened address', () => {
    render(
      <UserMenu
        address={FULL}
        isAdmin={false}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )
    expect(screen.getByText('HciZ...25En')).toBeInTheDocument()
  })

  it('opens dropdown on click and shows three actions', () => {
    render(
      <UserMenu
        address={FULL}
        isAdmin={false}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    expect(screen.getByText('Copy address')).toBeInTheDocument()
    expect(screen.getByText(/Re-sign in/i)).toBeInTheDocument()
    expect(screen.getByText('Disconnect')).toBeInTheDocument()
  })

  it('toggles closed when pill clicked again', () => {
    render(
      <UserMenu
        address={FULL}
        isAdmin={false}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
        onNavigate={vi.fn()}
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
      <UserMenu
        address={FULL}
        isAdmin={false}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={onDisconnect}
        onNavigate={vi.fn()}
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
      <UserMenu
        address={FULL}
        isAdmin={false}
        onCopy={onCopy}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    fireEvent.click(screen.getByText('Copy address'))
    expect(onCopy).toHaveBeenCalledOnce()
  })

  it('Re-sign action invokes onReSignIn', () => {
    const onReSignIn = vi.fn()
    render(
      <UserMenu
        address={FULL}
        isAdmin={false}
        onCopy={vi.fn()}
        onReSignIn={onReSignIn}
        onDisconnect={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    fireEvent.click(screen.getByText(/Re-sign in/i))
    expect(onReSignIn).toHaveBeenCalledOnce()
  })

  it('closes on outside mousedown', () => {
    render(
      <div>
        <UserMenu
          address={FULL}
          isAdmin={false}
          onCopy={vi.fn()}
          onReSignIn={vi.fn()}
          onDisconnect={vi.fn()}
          onNavigate={vi.fn()}
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
      <UserMenu
        address={FULL}
        isAdmin={false}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Copy address')).not.toBeInTheDocument()
  })

  it('aria-expanded reflects open state', () => {
    render(
      <UserMenu
        address={FULL}
        isAdmin={false}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )
    const pill = screen.getByRole('button', { name: /HciZ\.\.\.25En/ })
    expect(pill).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(pill)
    expect(pill).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows admin section above wallet ops when isAdmin', () => {
    render(
      <UserMenu
        address={FULL}
        isAdmin={true}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Settings/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Herald/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Squad/ })).toBeInTheDocument()
  })

  it('hides admin section when !isAdmin', () => {
    render(
      <UserMenu
        address={FULL}
        isAdmin={false}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Settings/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Herald/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Squad/ })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Copy address/ })).toBeInTheDocument()
  })

  it('fires onNavigate("settings") when Settings clicked', () => {
    const onNavigate = vi.fn()
    render(
      <UserMenu
        address={FULL}
        isAdmin={true}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
        onNavigate={onNavigate}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Settings/ }))
    expect(onNavigate).toHaveBeenCalledWith('settings')
  })

  it('fires onNavigate("herald") when Herald clicked', () => {
    const onNavigate = vi.fn()
    render(
      <UserMenu
        address={FULL}
        isAdmin={true}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
        onNavigate={onNavigate}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Herald/ }))
    expect(onNavigate).toHaveBeenCalledWith('herald')
  })

  it('fires onNavigate("squad") when Squad clicked', () => {
    const onNavigate = vi.fn()
    render(
      <UserMenu
        address={FULL}
        isAdmin={true}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
        onNavigate={onNavigate}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Squad/ }))
    expect(onNavigate).toHaveBeenCalledWith('squad')
  })

  it('closes dropdown after admin item click', () => {
    render(
      <UserMenu
        address={FULL}
        isAdmin={true}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    expect(screen.getByText('Admin')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: /Settings/ }))
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })
})
