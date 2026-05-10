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
      status: 'authed',
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
      status: 'authed',
      isAdmin: false,
    })
    const { container } = render(<KeysView />)
    const grid = container.querySelector('[data-testid="keys-view"]')
    expect(grid?.className).toContain('grid')
    expect(grid?.className).toMatch(/md:grid-cols-2/)
  })

  it('renders UnauthedEmptyState when unauthenticated', () => {
    useAuthStateMock.mockReturnValue({
      publicKey: null,
      token: null,
      status: 'unauthed',
      isAdmin: false,
    })
    render(<KeysView />)
    expect(screen.getByTestId('unauthed-empty-state')).toBeInTheDocument()
    expect(screen.getByText(/stealth keys/i)).toBeInTheDocument()
    expect(screen.queryByTestId('view-key-card')).toBeNull()
    expect(screen.queryByTestId('backup-card')).toBeNull()
  })

  it('does NOT render the section heading when unauthenticated', () => {
    useAuthStateMock.mockReturnValue({
      publicKey: null,
      token: null,
      status: 'unauthed',
      isAdmin: false,
    })
    render(<KeysView />)
    expect(screen.queryByText(/viewing key management/i)).toBeNull()
  })

  it('renders the section heading', () => {
    useAuthStateMock.mockReturnValue({
      publicKey: 'TestWallet1111111111111111111111111111111111',
      token: 'fake-jwt',
      status: 'authed',
      isAdmin: false,
    })
    render(<KeysView />)
    expect(screen.getByText(/viewing key management/i)).toBeInTheDocument()
  })
})
