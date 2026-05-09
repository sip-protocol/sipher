import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import KeysView from '../KeysView'

vi.mock('../../components/keys/ViewKeyCard', () => ({
  ViewKeyCard: () => <div data-testid="view-key-card">VKC</div>,
}))
vi.mock('../../components/keys/StealthAddressBackup', () => ({
  StealthAddressBackup: () => <div data-testid="backup-card">SAB</div>,
}))

const useAuthStateMock = vi.fn()
vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => useAuthStateMock(),
}))

describe('KeysView', () => {
  it('renders both ViewKeyCard and StealthAddressBackup when authenticated', () => {
    useAuthStateMock.mockReturnValue({
      publicKey: 'TestWallet1111111111111111111111111111111111',
      token: 'fake-jwt',
      isAuthenticated: true,
      isAdmin: false,
    })
    render(<KeysView />)
    expect(screen.getByTestId('view-key-card')).toBeInTheDocument()
    expect(screen.getByTestId('backup-card')).toBeInTheDocument()
  })

  it('renders inside a 2-column grid on md+', () => {
    useAuthStateMock.mockReturnValue({
      publicKey: 'TestWallet1111111111111111111111111111111111',
      token: 'fake-jwt',
      isAuthenticated: true,
      isAdmin: false,
    })
    const { container } = render(<KeysView />)
    const grid = container.querySelector('[data-testid="keys-view"]')
    expect(grid?.className).toContain('grid')
    expect(grid?.className).toMatch(/md:grid-cols-2/)
  })

  it('renders nothing when unauthenticated', () => {
    useAuthStateMock.mockReturnValue({
      publicKey: null,
      token: null,
      isAuthenticated: false,
      isAdmin: false,
    })
    const { container } = render(<KeysView />)
    expect(container.querySelector('[data-testid="keys-view"]')).toBeNull()
    expect(screen.queryByTestId('view-key-card')).toBeNull()
  })

  it('renders the section heading', () => {
    useAuthStateMock.mockReturnValue({
      publicKey: 'TestWallet1111111111111111111111111111111111',
      token: 'fake-jwt',
      isAuthenticated: true,
      isAdmin: false,
    })
    render(<KeysView />)
    expect(screen.getByText(/viewing key management/i)).toBeInTheDocument()
  })
})
