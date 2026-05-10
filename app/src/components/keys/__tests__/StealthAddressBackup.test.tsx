import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StealthAddressBackup } from '../StealthAddressBackup'
import { onAuthClear } from '../../../store/onAuthClear'

vi.mock('../../../hooks/useAuthState', async () => {
  const { makeFakeAuthState } = await import('../../../test-utils/makeFakeAuthState')
  return {
    useAuthState: () => makeFakeAuthState({
      publicKey: 'TestWallet1111111111111111111111111111111111',
      token: 'fake-jwt',
      status: 'authed',
      isAdmin: false,
    }),
  }
})

const apiFetchMock = vi.fn()
vi.mock('../../../api/client', () => ({
  apiFetch: (path: string, opts?: unknown) => apiFetchMock(path, opts),
}))

const encryptMock = vi.fn(async (_plaintext: Uint8Array, _passphrase: string) => ({
  v: 1, alg: 'xchacha20poly1305-pbkdf2sha256-310k',
  salt: 'c2FsdA==', nonce: 'bm9uY2U=', ct: 'Y3Q=',
}))
vi.mock('../../../lib/crypto/passphrase-encrypt', () => ({
  encryptWithPassphrase: (plaintext: Uint8Array, passphrase: string) =>
    encryptMock(plaintext, passphrase),
}))

describe('StealthAddressBackup', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    encryptMock.mockClear()
    onAuthClear._resetForTests()
    HTMLAnchorElement.prototype.click = vi.fn()
    // jsdom does not implement these; stub to keep download path inert.
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    })
  })

  it('renders loading skeleton on mount', async () => {
    apiFetchMock.mockReturnValue(new Promise(() => {})) // never resolves
    render(<StealthAddressBackup />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders empty-state copy when /api/stealth/index returns 0 addresses', async () => {
    apiFetchMock.mockResolvedValueOnce({ tree: [], rootWallet: '' })
    render(<StealthAddressBackup />)
    await waitFor(() => {
      expect(screen.getByText(/no stealth addresses yet/i)).toBeInTheDocument()
    })
  })

  it('renders count chip + Download button when addresses exist', async () => {
    apiFetchMock.mockResolvedValueOnce({
      tree: [
        { index: 0, derivationPath: 'm/0', stealthAddress: '0xabc', parentIndex: null, createdAt: '' },
        { index: 1, derivationPath: 'm/1', stealthAddress: '0xdef', parentIndex: 0, createdAt: '' },
      ],
      rootWallet: 'wallet',
    })
    render(<StealthAddressBackup />)
    await waitFor(() => {
      expect(screen.getByText('2 addresses')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /download encrypted backup/i })).toBeInTheDocument()
  })

  it('renders singular "1 address" copy when exactly one stealth address exists', async () => {
    apiFetchMock.mockResolvedValueOnce({
      tree: [{ index: 0, derivationPath: 'm/0', stealthAddress: '0xabc', parentIndex: null, createdAt: '' }],
      rootWallet: 'wallet',
    })
    render(<StealthAddressBackup />)
    await waitFor(() => {
      expect(screen.getByText('1 address')).toBeInTheDocument()
    })
    expect(screen.queryByText(/1 addresses/)).not.toBeInTheDocument()
  })

  it('encrypts + downloads on submit', async () => {
    apiFetchMock.mockResolvedValueOnce({
      tree: [{ index: 0, derivationPath: 'm/0', stealthAddress: '0xabc', parentIndex: null, createdAt: '' }],
      rootWallet: 'wallet',
    })
    render(<StealthAddressBackup />)
    await waitFor(() => screen.getByRole('button', { name: /download encrypted backup/i }))
    fireEvent.click(screen.getByRole('button', { name: /download encrypted backup/i }))
    fireEvent.change(screen.getByLabelText(/^passphrase$/i), { target: { value: 'a-good-pw' } })
    fireEvent.change(screen.getByLabelText(/confirm passphrase/i), { target: { value: 'a-good-pw' } })
    fireEvent.click(screen.getByRole('button', { name: /^encrypt and download$/i }))
    await waitFor(() => expect(encryptMock).toHaveBeenCalled())
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled()
  })

  it('renders error banner on fetch failure with retry', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('boom'))
    render(<StealthAddressBackup />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    apiFetchMock.mockResolvedValueOnce({ tree: [], rootWallet: '' })
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    await waitFor(() => {
      expect(screen.getByText(/no stealth addresses yet/i)).toBeInTheDocument()
    })
  })

  it('clears data state when onAuthClear.clearAll fires', async () => {
    apiFetchMock.mockResolvedValueOnce({
      tree: [
        { index: 0, derivationPath: 'm/0', stealthAddress: '0xabc', parentIndex: null, createdAt: '' },
      ],
      rootWallet: 'wallet',
    })
    render(<StealthAddressBackup />)
    await waitFor(() => {
      expect(screen.getByText('1 address')).toBeInTheDocument()
    })
    act(() => onAuthClear.clearAll())
    await waitFor(() => {
      expect(screen.queryByText('1 address')).not.toBeInTheDocument()
    })
  })

  it('surfaces encrypt error inside Sheet and keeps Sheet open for retry', async () => {
    apiFetchMock.mockResolvedValueOnce({
      tree: [{ index: 0, derivationPath: 'm/0', stealthAddress: '0xabc', parentIndex: null, createdAt: '' }],
      rootWallet: 'wallet',
    })
    encryptMock.mockRejectedValueOnce(new Error('boom'))
    render(<StealthAddressBackup />)
    await waitFor(() => screen.getByRole('button', { name: /download encrypted backup/i }))
    fireEvent.click(screen.getByRole('button', { name: /download encrypted backup/i }))
    fireEvent.change(screen.getByLabelText(/^passphrase$/i), { target: { value: 'a-good-pw' } })
    fireEvent.change(screen.getByLabelText(/confirm passphrase/i), { target: { value: 'a-good-pw' } })
    fireEvent.click(screen.getByRole('button', { name: /^encrypt and download$/i }))
    await waitFor(() => {
      expect(screen.getByText('boom')).toBeInTheDocument()
    })
    // Sheet must stay open so user can retry without re-entering passphrase.
    expect(screen.getByLabelText(/^passphrase$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm passphrase/i)).toBeInTheDocument()
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
  })
})
