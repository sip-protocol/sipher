import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AuthSyncProvider } from '../AuthSyncProvider'
import { useAuthState, type AuthState } from '../../hooks/useAuthState'
import { useAppStore } from '../../stores/app'

const mockSetVisible = vi.fn()

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: vi.fn(),
}))
vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: mockSetVisible, visible: false }),
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

describe('AuthSyncProvider — authenticate', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    useAppStore.setState({ token: null, isAdmin: false, expiresAt: null }, false)
    mockedUseWallet.mockReset()
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  function captureAuth() {
    const captured: { current: AuthState | null } = { current: null }
    function Capture() {
      captured.current = useAuthState()
      return null
    }
    return { Capture, captured }
  }

  it('opens wallet modal when called with no wallet connected', async () => {
    mockSetVisible.mockReset()
    mockedUseWallet.mockReturnValue({
      connected: false,
      publicKey: null,
      signMessage: undefined,
      disconnect: vi.fn(),
    })

    const { Capture, captured } = captureAuth()
    render(
      <AuthSyncProvider>
        <Capture />
      </AuthSyncProvider>,
    )
    await act(async () => {
      await captured.current!.authenticate()
    })
    expect(mockSetVisible).toHaveBeenCalledWith(true)
  })

  it('signMessage happy path: nonce → sign → verify → setAuth', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 86400
    const issuedToken = makeJwtForTest({ wallet: 'WalletA', exp: futureExp })
    const mockSignMessage = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]))
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'WalletA' },
      signMessage: mockSignMessage,
      disconnect: vi.fn(),
    })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nonce: 'abc', message: 'sipher.sip-protocol.org wants you to sign in.\n\nNonce: abc' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: issuedToken, isAdmin: false, expiresIn: '24h' }),
      })

    const { Capture, captured } = captureAuth()
    render(
      <AuthSyncProvider>
        <Capture />
      </AuthSyncProvider>,
    )

    await act(async () => {
      await captured.current!.authenticate()
    })

    expect(mockSignMessage).toHaveBeenCalledOnce()
    const state = useAppStore.getState()
    expect(state.token).toBe(issuedToken)
    expect(state.isAdmin).toBe(false)
    expect(state.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('passes through isAdmin=true from server', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const adminToken = makeJwtForTest({ wallet: 'AdminWallet', exp: futureExp, isAdmin: true })
    const mockSignMessage = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]))
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'AdminWallet' },
      signMessage: mockSignMessage,
      disconnect: vi.fn(),
    })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nonce: 'a', message: 'm' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: adminToken, isAdmin: true, expiresIn: '1h' }),
      })

    const { Capture, captured } = captureAuth()
    render(
      <AuthSyncProvider>
        <Capture />
      </AuthSyncProvider>,
    )
    await act(async () => {
      await captured.current!.authenticate()
    })
    expect(useAppStore.getState().isAdmin).toBe(true)
  })

  it('throws when wallet has no signMessage', async () => {
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      signMessage: undefined,
      disconnect: vi.fn(),
    })

    const { Capture, captured } = captureAuth()
    render(
      <AuthSyncProvider>
        <Capture />
      </AuthSyncProvider>,
    )

    await expect(
      act(async () => {
        await captured.current!.authenticate()
      }),
    ).rejects.toThrow(/doesn't support sign-in/i)
    expect(useAppStore.getState().token).toBeNull()
  })

  it('propagates user-rejection from signMessage', async () => {
    const rejectErr = new Error('User rejected the request')
    const mockSignMessage = vi.fn().mockRejectedValue(rejectErr)
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      signMessage: mockSignMessage,
      disconnect: vi.fn(),
    })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ nonce: 'abc', message: 'm' }),
    })

    const { Capture, captured } = captureAuth()
    render(
      <AuthSyncProvider>
        <Capture />
      </AuthSyncProvider>,
    )

    await expect(
      act(async () => {
        await captured.current!.authenticate()
      }),
    ).rejects.toThrow(/User rejected/i)
    expect(useAppStore.getState().token).toBeNull()
  })

  it('uses SIWS when wallet exposes signIn and server accepts', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const issuedToken = makeJwtForTest({ wallet: 'PhantomWallet', exp: futureExp })
    const mockSignIn = vi.fn().mockResolvedValue({
      signature: new Uint8Array([1, 2, 3, 4]),
      signedMessage: new TextEncoder().encode('siwsmsg'),
    })
    const mockSignMessage = vi.fn()
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'PhantomWallet' },
      wallet: { adapter: { signIn: mockSignIn } },
      signMessage: mockSignMessage,
      disconnect: vi.fn(),
    })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nonce: 'n', message: 'm' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: issuedToken, isAdmin: false, expiresIn: '24h' }),
      })

    const { Capture, captured } = captureAuth()
    render(
      <AuthSyncProvider>
        <Capture />
      </AuthSyncProvider>,
    )
    await act(async () => {
      await captured.current!.authenticate()
    })

    expect(mockSignIn).toHaveBeenCalledOnce()
    expect(mockSignMessage).not.toHaveBeenCalled()

    const verifyCall = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1]
    const verifyBody = JSON.parse(verifyCall[1].body as string)
    expect(verifyBody.signedMessage).toBeTruthy()
    expect(typeof verifyBody.signedMessage).toBe('string')
    expect(useAppStore.getState().token).toBe(issuedToken)
  })

  it('falls back to signMessage when SIWS server returns 4xx (legacy server)', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const issuedToken = makeJwtForTest({ wallet: 'PhantomWallet', exp: futureExp })
    const mockSignIn = vi.fn().mockResolvedValue({
      signature: new Uint8Array([1, 2, 3, 4]),
      signedMessage: new TextEncoder().encode('siwsmsg'),
    })
    const mockSignMessage = vi.fn().mockResolvedValue(new Uint8Array([9, 9, 9]))
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'PhantomWallet' },
      wallet: { adapter: { signIn: mockSignIn } },
      signMessage: mockSignMessage,
      disconnect: vi.fn(),
    })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nonce: 'n', message: 'm' }) })
      // First verify call (with signedMessage) returns 401 — legacy server
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'signature verification failed' }),
      })
      // Second verify call (signMessage path) succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: issuedToken, isAdmin: false, expiresIn: '24h' }),
      })

    const { Capture, captured } = captureAuth()
    render(
      <AuthSyncProvider>
        <Capture />
      </AuthSyncProvider>,
    )
    await act(async () => {
      await captured.current!.authenticate()
    })

    expect(mockSignIn).toHaveBeenCalledOnce()
    expect(mockSignMessage).toHaveBeenCalledOnce()
    expect(useAppStore.getState().token).toBe(issuedToken)
  })

  it('falls back to signMessage when SIWS returns no signature', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const issuedToken = makeJwtForTest({ wallet: 'JupiterWallet', exp: futureExp })
    const mockSignIn = vi.fn().mockResolvedValue({})
    const mockSignMessage = vi.fn().mockResolvedValue(new Uint8Array([7, 8, 9]))
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'JupiterWallet' },
      wallet: { adapter: { signIn: mockSignIn } },
      signMessage: mockSignMessage,
      disconnect: vi.fn(),
    })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nonce: 'n', message: 'm' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: issuedToken, isAdmin: false, expiresIn: '24h' }),
      })

    const { Capture, captured } = captureAuth()
    render(
      <AuthSyncProvider>
        <Capture />
      </AuthSyncProvider>,
    )
    await act(async () => {
      await captured.current!.authenticate()
    })

    expect(mockSignIn).toHaveBeenCalledOnce()
    expect(mockSignMessage).toHaveBeenCalledOnce()
    expect(useAppStore.getState().token).toBe(issuedToken)
  })

  it('falls back to signMessage when SIWS throws non-rejection error', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const issuedToken = makeJwtForTest({ wallet: 'W', exp: futureExp })
    const mockSignIn = vi.fn().mockRejectedValue(new Error('signIn not implemented'))
    const mockSignMessage = vi.fn().mockResolvedValue(new Uint8Array([5, 5, 5]))
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: { adapter: { signIn: mockSignIn } },
      signMessage: mockSignMessage,
      disconnect: vi.fn(),
    })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nonce: 'n', message: 'm' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: issuedToken, isAdmin: false, expiresIn: '1h' }),
      })

    const { Capture, captured } = captureAuth()
    render(
      <AuthSyncProvider>
        <Capture />
      </AuthSyncProvider>,
    )
    await act(async () => {
      await captured.current!.authenticate()
    })

    expect(mockSignMessage).toHaveBeenCalledOnce()
    expect(useAppStore.getState().token).toBe(issuedToken)
  })

  it('propagates user rejection from SIWS without falling through', async () => {
    const rejectErr = new Error('User rejected the request')
    const mockSignIn = vi.fn().mockRejectedValue(rejectErr)
    const mockSignMessage = vi.fn()
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: { adapter: { signIn: mockSignIn } },
      signMessage: mockSignMessage,
      disconnect: vi.fn(),
    })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ nonce: 'n', message: 'm' }),
    })

    const { Capture, captured } = captureAuth()
    render(
      <AuthSyncProvider>
        <Capture />
      </AuthSyncProvider>,
    )

    await expect(
      act(async () => {
        await captured.current!.authenticate()
      }),
    ).rejects.toThrow(/User rejected/i)
    expect(mockSignMessage).not.toHaveBeenCalled()
    expect(useAppStore.getState().token).toBeNull()
  })

  it('reports status=connecting while authenticate runs', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const okToken = makeJwtForTest({ wallet: 'W', exp: futureExp })
    let resolveSign: ((s: Uint8Array) => void) | null = null
    const mockSignMessage = vi.fn().mockReturnValue(
      new Promise<Uint8Array>((resolve) => {
        resolveSign = resolve
      }),
    )
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      signMessage: mockSignMessage,
      disconnect: vi.fn(),
    })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nonce: 'a', message: 'm' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: okToken, isAdmin: false, expiresIn: '1h' }) })

    const { Capture, captured } = captureAuth()
    render(
      <AuthSyncProvider>
        <Capture />
      </AuthSyncProvider>,
    )

    let pending: Promise<void> | null = null
    await act(async () => {
      pending = captured.current!.authenticate()
      await Promise.resolve()
    })
    expect(captured.current!.status).toBe('connecting')

    await act(async () => {
      resolveSign!(new Uint8Array([1, 2, 3]))
      await pending!
    })
    expect(captured.current!.status).toBe('authed')
  })
})
