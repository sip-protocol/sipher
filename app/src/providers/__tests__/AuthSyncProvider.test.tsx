import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthSyncProvider } from '../AuthSyncProvider'
import { useAuthState } from '../../hooks/useAuthState'
import { useAppStore } from '../../stores/app'

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: vi.fn(),
}))
vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: vi.fn() }),
}))

import { useWallet } from '@solana/wallet-adapter-react'

const mockedUseWallet = useWallet as unknown as ReturnType<typeof vi.fn>

function TestConsumer() {
  const auth = useAuthState()
  return (
    <>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="token">{auth.token ?? 'null'}</span>
      <span data-testid="publicKey">{auth.publicKey ?? 'null'}</span>
      <span data-testid="isAdmin">{auth.isAdmin ? 'yes' : 'no'}</span>
    </>
  )
}

function makeJwtForTest(payload: { wallet: string; exp: number; isAdmin?: boolean }): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify({ iat: payload.exp - 3600, ...payload }))
  return `${header}.${body}.testsig`
}

describe('AuthSyncProvider — status machine', () => {
  beforeEach(() => {
    useAppStore.setState({ token: null, isAdmin: false, expiresAt: null }, false)
    mockedUseWallet.mockReset()
  })

  it('reports status=unauthed when no wallet, no token', () => {
    mockedUseWallet.mockReturnValue({
      connected: false,
      publicKey: null,
      wallet: null,
      disconnect: vi.fn(),
    })
    render(
      <AuthSyncProvider>
        <TestConsumer />
      </AuthSyncProvider>,
    )
    expect(screen.getByTestId('status').textContent).toBe('unauthed')
    expect(screen.getByTestId('token').textContent).toBe('null')
  })

  it('reports status=unauthed when wallet connected but no token', () => {
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: null,
      disconnect: vi.fn(),
    })
    render(
      <AuthSyncProvider>
        <TestConsumer />
      </AuthSyncProvider>,
    )
    expect(screen.getByTestId('status').textContent).toBe('unauthed')
  })

  it('reports status=expired when persisted token is expired (and matches wallet)', () => {
    const expiredToken = makeJwtForTest({ wallet: 'W', exp: 1000 })
    useAppStore.setState({ token: expiredToken, isAdmin: false, expiresAt: 1000 }, false)
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: null,
      disconnect: vi.fn(),
    })
    render(
      <AuthSyncProvider>
        <TestConsumer />
      </AuthSyncProvider>,
    )
    expect(screen.getByTestId('status').textContent).toBe('expired')
  })

  it('reports status=authed when wallet+token both valid and matching', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const validToken = makeJwtForTest({ wallet: 'W', exp: futureExp })
    useAppStore.setState({ token: validToken, isAdmin: false, expiresAt: futureExp }, false)
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: null,
      disconnect: vi.fn(),
    })
    render(
      <AuthSyncProvider>
        <TestConsumer />
      </AuthSyncProvider>,
    )
    expect(screen.getByTestId('status').textContent).toBe('authed')
    expect(screen.getByTestId('token').textContent).toBe(validToken)
  })

  it('clears token if persisted wallet ≠ current wallet', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const tokenForA = makeJwtForTest({ wallet: 'WalletA', exp: futureExp })
    useAppStore.setState({ token: tokenForA, isAdmin: false, expiresAt: futureExp }, false)
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'WalletB' },
      wallet: null,
      disconnect: vi.fn(),
    })
    render(
      <AuthSyncProvider>
        <TestConsumer />
      </AuthSyncProvider>,
    )
    expect(screen.getByTestId('token').textContent).toBe('null')
    expect(screen.getByTestId('status').textContent).toBe('unauthed')
  })

  it('exposes isAdmin from store', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const validToken = makeJwtForTest({ wallet: 'W', exp: futureExp, isAdmin: true })
    useAppStore.setState({ token: validToken, isAdmin: true, expiresAt: futureExp }, false)
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: null,
      disconnect: vi.fn(),
    })
    render(
      <AuthSyncProvider>
        <TestConsumer />
      </AuthSyncProvider>,
    )
    expect(screen.getByTestId('isAdmin').textContent).toBe('yes')
  })

  it('throws when useAuthState used outside provider', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Bad() {
      useAuthState()
      return null
    }
    expect(() => render(<Bad />)).toThrow(/useAuthSyncContext must be used within AuthSyncProvider/)
    errSpy.mockRestore()
  })
})
