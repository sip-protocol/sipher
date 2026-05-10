import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Header from '../Header'
import type { AuthState, AuthStatus } from '../../hooks/useAuthState'
import { useAppStore } from '../../stores/app'

const mockAuthenticate = vi.fn()
const mockDisconnect = vi.fn()
const mockToastShow = vi.fn(() => 'toast-id')
const mockClipboardWrite = vi.fn()

let currentAuth: AuthState = {
  status: 'unauthed',
  token: null,
  expiresAt: null,
  isAdmin: false,
  publicKey: null,
  authenticate: mockAuthenticate,
  disconnect: mockDisconnect,
  error: null,
}

vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => currentAuth,
}))

vi.mock('../../providers/ToastProvider', () => ({
  useToast: () => ({ show: mockToastShow, dismiss: vi.fn() }),
}))

vi.mock('../../lib/networkConfig', () => ({
  useNetworkConfigStore: <T,>(selector: (s: { config: { network: string } }) => T) =>
    selector({ config: { network: 'devnet' } }),
}))

const FULL = 'HciZTd6rR7YsaS5ZNThx9KdgqSimxwMzJgs2j98U25En'

function setAuth(partial: Partial<AuthState> & { status: AuthStatus }) {
  currentAuth = {
    ...currentAuth,
    ...partial,
    authenticate: mockAuthenticate,
    disconnect: mockDisconnect,
  }
}

beforeEach(() => {
  mockAuthenticate.mockReset()
  mockAuthenticate.mockResolvedValue(undefined)
  mockDisconnect.mockReset()
  mockDisconnect.mockResolvedValue(undefined)
  mockToastShow.mockReset()
  mockClipboardWrite.mockReset()
  Object.assign(navigator, {
    clipboard: { writeText: mockClipboardWrite.mockResolvedValue(undefined) },
  })
  useAppStore.setState({ activeView: 'dashboard', chatSheetOpen: false }, false)
  setAuth({ status: 'unauthed', publicKey: null, isAdmin: false })
})

describe('Header — auth pill', () => {
  it('renders Connect button when unauthed', () => {
    setAuth({ status: 'unauthed', publicKey: null })
    render(<Header />)
    const btn = screen.getByRole('button', { name: 'Connect' })
    expect(btn).toBeInTheDocument()
  })

  it('Connect click calls authenticate', () => {
    setAuth({ status: 'unauthed', publicKey: null })
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))
    expect(mockAuthenticate).toHaveBeenCalledTimes(1)
  })

  it('renders Re-sign in button when expired', () => {
    setAuth({ status: 'expired', publicKey: FULL })
    render(<Header />)
    expect(screen.getByRole('button', { name: /Re-sign in/i })).toBeInTheDocument()
  })

  it('Re-sign click calls authenticate', () => {
    setAuth({ status: 'expired', publicKey: FULL })
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: /Re-sign in/i }))
    expect(mockAuthenticate).toHaveBeenCalledTimes(1)
  })

  it('renders UserMenu when authed with publicKey', () => {
    setAuth({ status: 'authed', publicKey: FULL, token: 'tok' })
    render(<Header />)
    expect(screen.getByRole('button', { name: /HciZ\.\.\.25En/ })).toBeInTheDocument()
  })

  it('UserMenu Disconnect calls disconnect + shows toast', async () => {
    setAuth({ status: 'authed', publicKey: FULL, token: 'tok' })
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    fireEvent.click(screen.getByText('Disconnect'))
    await Promise.resolve()
    await Promise.resolve()
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
  })

  it('UserMenu Copy writes address to clipboard', async () => {
    setAuth({ status: 'authed', publicKey: FULL, token: 'tok' })
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    fireEvent.click(screen.getByText('Copy address'))
    await Promise.resolve()
    expect(mockClipboardWrite).toHaveBeenCalledWith(FULL)
  })
})

describe('Header — wordmark + Ask SIPHER trigger', () => {
  it('renders the SIPHER wordmark', () => {
    render(<Header />)
    expect(screen.getByText('SIPHER')).toBeInTheDocument()
  })

  it('exposes Ask SIPHER trigger button', () => {
    render(<Header />)
    expect(screen.getByRole('button', { name: /ask sipher/i })).toBeInTheDocument()
  })

  it('Ask SIPHER click opens chat sheet via store', () => {
    render(<Header />)
    expect(useAppStore.getState().chatSheetOpen).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /ask sipher/i }))
    expect(useAppStore.getState().chatSheetOpen).toBe(true)
  })

  it('renders the active network identifier', () => {
    render(<Header />)
    expect(screen.getByText('devnet')).toBeInTheDocument()
  })
})

describe('Header — tabs', () => {
  it('renders standard nav tabs for non-admin user', () => {
    setAuth({ status: 'authed', publicKey: FULL, token: 'tok', isAdmin: false })
    render(<Header />)
    expect(screen.getByRole('button', { name: /Dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Vault/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Herald$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Squad$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Settings$/ })).not.toBeInTheDocument()
  })

  it('does NOT render herald/squad/settings tabs in nav for admin user', () => {
    setAuth({ status: 'authed', publicKey: FULL, token: 'tok', isAdmin: true })
    render(<Header />)
    // Admin views live in UserMenu dropdown, not in the main nav
    expect(screen.queryByRole('button', { name: /^Herald$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Squad$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Settings$/ })).not.toBeInTheDocument()
  })

  it('clicking a tab calls setActiveView', () => {
    setAuth({ status: 'authed', publicKey: FULL, token: 'tok' })
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: /Vault/i }))
    expect(useAppStore.getState().activeView).toBe('vault')
  })
})
