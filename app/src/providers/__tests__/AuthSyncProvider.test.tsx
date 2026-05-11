import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AuthSyncProvider } from '../AuthSyncProvider'
import { useAuthState, type AuthState } from '../../hooks/useAuthState'
import { useAppStore } from '../../stores/app'
import type { ToastInput } from '../../components/Toast'

const mockToastShow = vi.fn((_: ToastInput): string => 'toast-id')
const mockToastDismiss = vi.fn()
vi.mock('../ToastProvider', () => ({
  useToast: () => ({ show: mockToastShow, dismiss: mockToastDismiss }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}))

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

  it('preserves auth on initial mount when wallet has not connected yet (autoConnect race)', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const validToken = makeJwtForTest({ wallet: 'W', exp: futureExp })

    // Persisted token is hydrated by Zustand before wallet-adapter has a
    // chance to autoConnect. `connected` is false on first render — but
    // we have NOT seen a connected→disconnected transition, so the auto-
    // clear effect must NOT fire.
    mockedUseWallet.mockReturnValue({
      connected: false,
      publicKey: null,
      wallet: null,
      signMessage: undefined,
      disconnect: vi.fn(),
    })
    useAppStore.setState({ token: validToken, isAdmin: false, expiresAt: futureExp }, false)

    render(
      <AuthSyncProvider>
        <div />
      </AuthSyncProvider>,
    )

    expect(useAppStore.getState().token).toBe(validToken)
    expect(useAppStore.getState().expiresAt).toBe(futureExp)
  })

  it('clears auth automatically when wallet disconnects externally', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const validToken = makeJwtForTest({ wallet: 'W', exp: futureExp })

    // Start connected with a valid token
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: { adapter: {} },
      signMessage: vi.fn(),
      disconnect: vi.fn(),
    })
    useAppStore.setState({ token: validToken, isAdmin: false, expiresAt: futureExp }, false)

    const { rerender } = render(
      <AuthSyncProvider>
        <div />
      </AuthSyncProvider>,
    )
    expect(useAppStore.getState().token).toBe(validToken)

    // Simulate external disconnect
    mockedUseWallet.mockReturnValue({
      connected: false,
      publicKey: null,
      wallet: null,
      signMessage: undefined,
      disconnect: vi.fn(),
    })
    rerender(
      <AuthSyncProvider>
        <div />
      </AuthSyncProvider>,
    )

    expect(useAppStore.getState().token).toBeNull()
    expect(useAppStore.getState().isAdmin).toBe(false)
    expect(useAppStore.getState().expiresAt).toBeNull()
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

describe('AuthSyncProvider — expiry watcher', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.useFakeTimers()
    useAppStore.setState({ token: null, isAdmin: false, expiresAt: null }, false)
    mockedUseWallet.mockReset()
    global.fetch = vi.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    vi.useRealTimers()
    global.fetch = originalFetch
  })

  it('clears token when expiry timer fires', () => {
    const expiresInSec = 60
    const exp = Math.floor(Date.now() / 1000) + expiresInSec
    const tok = makeJwtForTest({ wallet: 'W', exp })
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: { adapter: {} },
      signMessage: vi.fn(),
      disconnect: vi.fn(),
    })
    useAppStore.setState({ token: tok, isAdmin: false, expiresAt: exp }, false)

    render(
      <AuthSyncProvider>
        <div />
      </AuthSyncProvider>,
    )
    expect(useAppStore.getState().token).toBe(tok)

    act(() => {
      vi.advanceTimersByTime(expiresInSec * 1000 + 1000)
    })

    expect(useAppStore.getState().token).toBeNull()
  })

  it('attempts immediate refresh when already within 5min window', async () => {
    const expiresInSec = 60
    const exp = Math.floor(Date.now() / 1000) + expiresInSec
    const oldTok = makeJwtForTest({ wallet: 'W', exp })
    const newExp = Math.floor(Date.now() / 1000) + 86400
    const newTok = makeJwtForTest({ wallet: 'W', exp: newExp })
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: { adapter: {} },
      signMessage: vi.fn(),
      disconnect: vi.fn(),
    })
    // Only the FIRST refresh succeeds; subsequent calls (triggered by the
    // re-effect after token swap schedules another refresh in the future)
    // would only fire if we advanced the clock by 23h55m, which we don't.
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: newTok, expiresIn: '24h' }),
    })
    useAppStore.setState({ token: oldTok, isAdmin: false, expiresAt: exp }, false)

    render(
      <AuthSyncProvider>
        <div />
      </AuthSyncProvider>,
    )

    // Drain microtasks for the IIFE refresh promise chain (no time advance —
    // the new long-window timers from the post-refresh re-effect must not
    // fire in this test).
    await act(async () => {
      for (let i = 0; i < 10; i++) await Promise.resolve()
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/refresh',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(useAppStore.getState().token).toBe(newTok)
  })

  it('schedules refresh near expiry when JWT has more than 5min remaining', async () => {
    const expiresInSec = 24 * 3600
    const exp = Math.floor(Date.now() / 1000) + expiresInSec
    const oldTok = makeJwtForTest({ wallet: 'W', exp })
    const newExp = Math.floor(Date.now() / 1000) + expiresInSec + 24 * 3600
    const newTok = makeJwtForTest({ wallet: 'W', exp: newExp })
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: { adapter: {} },
      signMessage: vi.fn(),
      disconnect: vi.fn(),
    })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ token: newTok, expiresIn: '24h' }),
    })
    useAppStore.setState({ token: oldTok, isAdmin: false, expiresAt: exp }, false)

    render(
      <AuthSyncProvider>
        <div />
      </AuthSyncProvider>,
    )

    // Should NOT refresh yet — we're far from expiry
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(global.fetch).not.toHaveBeenCalled()

    // Advance to within the 5-minute window
    await act(async () => {
      await vi.advanceTimersByTimeAsync((expiresInSec - 5 * 60 - 60) * 1000 + 1000)
    })
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/refresh',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('clears token if refresh fails and expiry passes', async () => {
    const expiresInSec = 30
    const exp = Math.floor(Date.now() / 1000) + expiresInSec
    const tok = makeJwtForTest({ wallet: 'W', exp })
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: { adapter: {} },
      signMessage: vi.fn(),
      disconnect: vi.fn(),
    })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid' }),
    })
    useAppStore.setState({ token: tok, isAdmin: false, expiresAt: exp }, false)

    render(
      <AuthSyncProvider>
        <div />
      </AuthSyncProvider>,
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(expiresInSec * 1000 + 1000)
    })

    expect(useAppStore.getState().token).toBeNull()
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

  it('disconnect() calls wallet.disconnect AND clears auth', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const validToken = makeJwtForTest({ wallet: 'W', exp: futureExp })
    useAppStore.setState({ token: validToken, isAdmin: true, expiresAt: futureExp }, false)

    const mockDisconnect = vi.fn().mockResolvedValue(undefined)
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: { adapter: {} },
      signMessage: vi.fn(),
      disconnect: mockDisconnect,
    })

    const { Capture, captured } = captureAuth()
    render(
      <AuthSyncProvider>
        <Capture />
      </AuthSyncProvider>,
    )

    await act(async () => {
      await captured.current!.disconnect()
    })

    expect(mockDisconnect).toHaveBeenCalled()
    const state = useAppStore.getState()
    expect(state.token).toBeNull()
    expect(state.isAdmin).toBe(false)
    expect(state.expiresAt).toBeNull()
  })

  it('disconnect() still clears auth when walletDisconnect throws', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const validToken = makeJwtForTest({ wallet: 'W', exp: futureExp })
    useAppStore.setState({ token: validToken, isAdmin: false, expiresAt: futureExp }, false)

    const mockDisconnect = vi.fn().mockRejectedValue(new Error('extension closed'))
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: { adapter: {} },
      signMessage: vi.fn(),
      disconnect: mockDisconnect,
    })

    const { Capture, captured } = captureAuth()
    render(
      <AuthSyncProvider>
        <Capture />
      </AuthSyncProvider>,
    )

    await expect(
      act(async () => {
        await captured.current!.disconnect()
      }),
    ).rejects.toThrow(/extension closed/)
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

describe('AuthSyncProvider — 401 interceptor toast dedup (#203)', () => {
  beforeEach(() => {
    useAppStore.setState({ token: null, isAdmin: false, expiresAt: null }, false)
    mockedUseWallet.mockReset()
    mockToastShow.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits only one "Session expired" toast when multiple 401s fire concurrently', async () => {
    mockedUseWallet.mockReturnValue({
      connected: false,
      publicKey: null,
      wallet: null,
      signMessage: undefined,
      disconnect: vi.fn(),
    })

    render(
      <AuthSyncProvider>
        <div />
      </AuthSyncProvider>,
    )

    const { triggerAuthInterceptor } = await import('../../api/client')

    act(() => {
      triggerAuthInterceptor()
      triggerAuthInterceptor()
      triggerAuthInterceptor()
    })

    const toastCalls = mockToastShow.mock.calls.filter(([input]) =>
      /session expired/i.test(input.message),
    )
    expect(toastCalls).toHaveLength(1)
  })

  it('re-emits toast after 30s dedup window expires', async () => {
    vi.useFakeTimers()
    mockedUseWallet.mockReturnValue({
      connected: false,
      publicKey: null,
      wallet: null,
      signMessage: undefined,
      disconnect: vi.fn(),
    })

    render(
      <AuthSyncProvider>
        <div />
      </AuthSyncProvider>,
    )

    const { triggerAuthInterceptor } = await import('../../api/client')
    const matches = () =>
      mockToastShow.mock.calls.filter(([input]) =>
        /session expired/i.test(input.message),
      )

    act(() => {
      triggerAuthInterceptor()
    })
    expect(matches()).toHaveLength(1)

    // Inside the window: subsequent 401s do NOT emit additional toasts.
    act(() => {
      triggerAuthInterceptor()
    })
    expect(matches()).toHaveLength(1)

    // Past the 30s window: next 401 emits a fresh toast.
    act(() => {
      vi.advanceTimersByTime(31_000)
    })

    act(() => {
      triggerAuthInterceptor()
    })
    expect(matches()).toHaveLength(2)
  })

  it('clears the dedup flag after successful auth so a later 401 re-emits the toast', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 86400
    const issuedToken = makeJwtForTest({ wallet: 'W', exp: futureExp })
    const mockSignMessage = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
    mockedUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: null,
      signMessage: mockSignMessage,
      disconnect: vi.fn(),
    })

    const originalFetch = global.fetch
    global.fetch = vi.fn() as unknown as typeof fetch
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ nonce: 'n', message: 'm' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: issuedToken, isAdmin: false, expiresIn: '24h' }),
      })

    const captured: { current: AuthState | null } = { current: null }
    function Capture() {
      captured.current = useAuthState()
      return null
    }

    render(
      <AuthSyncProvider>
        <Capture />
      </AuthSyncProvider>,
    )

    const { triggerAuthInterceptor } = await import('../../api/client')
    const matches = () =>
      mockToastShow.mock.calls.filter(([input]) =>
        /session expired/i.test(input.message),
      )

    act(() => {
      triggerAuthInterceptor()
    })
    expect(matches()).toHaveLength(1)

    // A second 401 inside the dedup window is suppressed.
    act(() => {
      triggerAuthInterceptor()
    })
    expect(matches()).toHaveLength(1)

    // Successful re-auth resets the flag.
    await act(async () => {
      await captured.current!.authenticate()
    })

    act(() => {
      triggerAuthInterceptor()
    })
    expect(matches()).toHaveLength(2)

    global.fetch = originalFetch
  })
})
