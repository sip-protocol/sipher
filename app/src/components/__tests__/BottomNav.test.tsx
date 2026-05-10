import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BottomNav from '../BottomNav'
import type { AuthState } from '../../hooks/useAuthState'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

const mockDisconnect = vi.fn()
const mockToastShow = vi.fn(() => 'toast-id')

let currentAuth: AuthState = {
  status: 'unauthed',
  token: null,
  expiresAt: null,
  isAdmin: false,
  publicKey: null,
  authenticate: vi.fn(),
  disconnect: mockDisconnect,
  error: null,
}

vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => currentAuth,
}))

vi.mock('../../providers/ToastProvider', () => ({
  useToast: () => ({ show: mockToastShow, dismiss: vi.fn() }),
}))

function renderBottomNav(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BottomNav />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  navigateMock.mockReset()
  mockDisconnect.mockReset()
  mockDisconnect.mockResolvedValue(undefined)
  mockToastShow.mockReset()
  currentAuth = { ...currentAuth, isAdmin: false }
})

describe('BottomNav', () => {
  it('renders three primary tabs (Home, Vault, Chat) plus More', () => {
    renderBottomNav()
    expect(screen.getByRole('link', { name: /Home/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Vault/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Chat/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /More/ })).toBeInTheDocument()
  })

  it('Vault link points to /vault', () => {
    renderBottomNav()
    expect(screen.getByRole('link', { name: /Vault/ })).toHaveAttribute('href', '/vault')
  })

  it('Home link points to /', () => {
    renderBottomNav()
    expect(screen.getByRole('link', { name: /Home/ })).toHaveAttribute('href', '/')
  })

  it('More opens drawer; admin sees Herald + Squad entries when isAdmin=true', () => {
    currentAuth = { ...currentAuth, isAdmin: true }
    renderBottomNav()
    fireEvent.click(screen.getByRole('button', { name: /More/ }))
    expect(screen.getByRole('button', { name: /Herald/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Squad/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Disconnect Wallet/ })).toBeInTheDocument()
  })

  it('non-admins do NOT see Herald/Squad in the More drawer', () => {
    currentAuth = { ...currentAuth, isAdmin: false }
    renderBottomNav()
    fireEvent.click(screen.getByRole('button', { name: /More/ }))
    expect(screen.queryByRole('button', { name: /Herald/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Squad/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Disconnect Wallet/ })).toBeInTheDocument()
  })

  it('clicking Keys in More drawer navigates to /keys', () => {
    renderBottomNav()
    fireEvent.click(screen.getByRole('button', { name: /More/ }))
    fireEvent.click(screen.getByRole('button', { name: /Keys/ }))
    expect(navigateMock).toHaveBeenCalledWith('/keys')
  })

  it('clicking Herald in More drawer navigates to /herald', () => {
    currentAuth = { ...currentAuth, isAdmin: true }
    renderBottomNav()
    fireEvent.click(screen.getByRole('button', { name: /More/ }))
    fireEvent.click(screen.getByRole('button', { name: /Herald/ }))
    expect(navigateMock).toHaveBeenCalledWith('/herald')
  })

  it('clicking Squad in More drawer navigates to /sentinel', () => {
    currentAuth = { ...currentAuth, isAdmin: true }
    renderBottomNav()
    fireEvent.click(screen.getByRole('button', { name: /More/ }))
    fireEvent.click(screen.getByRole('button', { name: /Squad/ }))
    expect(navigateMock).toHaveBeenCalledWith('/sentinel')
  })

  it('Disconnect Wallet calls disconnect + shows toast', async () => {
    renderBottomNav()
    fireEvent.click(screen.getByRole('button', { name: /More/ }))
    fireEvent.click(screen.getByRole('button', { name: /Disconnect Wallet/ }))
    await Promise.resolve()
    await Promise.resolve()
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
  })

  it('marks active link with aria-current="page"', () => {
    renderBottomNav('/vault')
    const link = screen.getByRole('link', { name: /Vault/ })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark inactive links with aria-current', () => {
    renderBottomNav('/')
    const link = screen.getByRole('link', { name: /Vault/ })
    expect(link).not.toHaveAttribute('aria-current')
  })

  it('marks Vault link as active when on /vault/withdraw (sub-route)', () => {
    renderBottomNav('/vault/withdraw')
    const link = screen.getByRole('link', { name: /Vault/ })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('does not highlight any tab on an unmatched path (404)', () => {
    renderBottomNav('/vault/abc')
    expect(screen.getByRole('link', { name: /Home/ })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: /Vault/ })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: /Chat/ })).not.toHaveAttribute('aria-current')
  })
})
