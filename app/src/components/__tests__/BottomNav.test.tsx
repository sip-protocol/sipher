import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BottomNav from '../BottomNav'
import type { AuthState } from '../../hooks/useAuthState'
import { useAppStore } from '../../stores/app'

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

beforeEach(() => {
  mockDisconnect.mockReset()
  mockDisconnect.mockResolvedValue(undefined)
  mockToastShow.mockReset()
  useAppStore.setState({ activeView: 'dashboard' }, false)
  currentAuth = { ...currentAuth, isAdmin: false }
})

describe('BottomNav', () => {
  it('renders three primary tabs (Home, Vault, Chat) plus More', () => {
    render(<BottomNav />)
    expect(screen.getByRole('button', { name: /Home/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Vault/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Chat/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /More/ })).toBeInTheDocument()
  })

  it('clicking Vault sets activeView via the store', () => {
    render(<BottomNav />)
    fireEvent.click(screen.getByRole('button', { name: /Vault/ }))
    expect(useAppStore.getState().activeView).toBe('vault')
  })

  it('More opens drawer; admin sees Herald + Squad entries when isAdmin=true', () => {
    currentAuth = { ...currentAuth, isAdmin: true }
    render(<BottomNav />)
    fireEvent.click(screen.getByRole('button', { name: /More/ }))
    expect(screen.getByRole('button', { name: /Herald/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Squad/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Disconnect Wallet/ })).toBeInTheDocument()
  })

  it('non-admins do NOT see Herald/Squad in the More drawer', () => {
    currentAuth = { ...currentAuth, isAdmin: false }
    render(<BottomNav />)
    fireEvent.click(screen.getByRole('button', { name: /More/ }))
    expect(screen.queryByRole('button', { name: /Herald/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Squad/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Disconnect Wallet/ })).toBeInTheDocument()
  })

  it('Disconnect Wallet calls disconnect + shows toast', async () => {
    render(<BottomNav />)
    fireEvent.click(screen.getByRole('button', { name: /More/ }))
    fireEvent.click(screen.getByRole('button', { name: /Disconnect Wallet/ }))
    await Promise.resolve()
    await Promise.resolve()
    expect(mockDisconnect).toHaveBeenCalledTimes(1)
  })
})
