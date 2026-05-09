import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ViewKeyCard } from '../ViewKeyCard'
import { useKeyStore } from '../../../stores/keys'

vi.mock('../../../api/keys', () => ({
  generateKey: vi.fn(async () => ({
    hash: '0xtesthash000000000000000000000000000000000000000000000000000000ab',
    downloadData: { blob: 'eyJrZXkiOiJ4In0=', filename: 'sip-viewing-key.json' },
  })),
}))

vi.mock('../../../hooks/useAuthState', () => ({
  useAuthState: () => ({
    publicKey: 'TestWallet1111111111111111111111111111111111',
    token: 'fake-jwt',
    isAuthenticated: true,
    isAdmin: false,
  }),
}))

describe('ViewKeyCard', () => {
  beforeEach(() => {
    useKeyStore.setState({ hash: null })
    HTMLAnchorElement.prototype.click = vi.fn()
  })

  it('renders empty state when no hash in the store', () => {
    render(<ViewKeyCard />)
    expect(screen.getByText(/no viewing key in this session/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument()
  })

  it('shows the generated hash + Copy + Rotate buttons after generate', async () => {
    render(<ViewKeyCard />)
    fireEvent.click(screen.getByRole('button', { name: /generate/i }))
    await waitFor(() => {
      expect(useKeyStore.getState().hash).toMatch(/^0xtesthash/)
    })
    expect(screen.getByRole('button', { name: /copy hash/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rotate/i })).toBeInTheDocument()
  })

  it('copies the hash to clipboard when Copy is clicked', async () => {
    useKeyStore.setState({ hash: '0xabcd' })
    const writeText = vi.fn()
    Object.assign(navigator, { clipboard: { writeText } })
    render(<ViewKeyCard />)
    fireEvent.click(screen.getByRole('button', { name: /copy hash/i }))
    expect(writeText).toHaveBeenCalledWith('0xabcd')
  })

  it('opens rotate confirm modal and replaces hash on confirm', async () => {
    useKeyStore.setState({ hash: '0xprevious' })
    render(<ViewKeyCard />)
    fireEvent.click(screen.getByRole('button', { name: /rotate/i }))
    expect(screen.getByText(/rotating invalidates this key/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /confirm rotate/i }))
    await waitFor(() => {
      expect(useKeyStore.getState().hash).toMatch(/^0xtesthash/)
    })
  })
})
