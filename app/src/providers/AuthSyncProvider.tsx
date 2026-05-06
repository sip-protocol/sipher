import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useAppStore } from '../stores/app'
import { decodeJwtPayload, isJwtExpired } from '../lib/jwt'
import { requestNonce, verifySignature } from '../api/auth'
import { refreshToken } from '../api/refresh'

export type AuthStatus = 'connecting' | 'unauthed' | 'authed' | 'expired' | 'error'

export interface AuthState {
  status: AuthStatus
  token: string | null
  expiresAt: number | null
  isAdmin: boolean
  publicKey: string | null
  authenticate: () => Promise<void>
  disconnect: () => Promise<void>
  error: string | null
}

const AuthSyncContext = createContext<AuthState | null>(null)

export function useAuthSyncContext(): AuthState {
  const ctx = useContext(AuthSyncContext)
  if (!ctx) throw new Error('useAuthSyncContext must be used within AuthSyncProvider')
  return ctx
}

export function AuthSyncProvider({ children }: { children: ReactNode }) {
  const { connected, publicKey, wallet, signMessage, disconnect: walletDisconnect } = useWallet()
  const { setVisible } = useWalletModal()
  const token = useAppStore((s) => s.token)
  const isAdmin = useAppStore((s) => s.isAdmin)
  const expiresAt = useAppStore((s) => s.expiresAt)
  const setAuth = useAppStore((s) => s.setAuth)
  const clearAuth = useAppStore((s) => s.clearAuth)

  const [error, setError] = useState<string | null>(null)
  const [authenticating, setAuthenticating] = useState(false)
  const lastWalletRef = useRef<string | null>(null)

  // Track wallet identity across renders; clear auth when the wallet changes.
  useEffect(() => {
    const currentWallet = publicKey?.toBase58() ?? null
    if (
      currentWallet &&
      lastWalletRef.current &&
      currentWallet !== lastWalletRef.current
    ) {
      clearAuth()
    }
    if (currentWallet) lastWalletRef.current = currentWallet
    if (!connected) lastWalletRef.current = null
  }, [publicKey, connected, clearAuth])

  // Validate that the persisted JWT was issued for the currently-connected
  // wallet. Catches loading a stale token under a different wallet without
  // a wallet-switch event (e.g. cold reload after wallet swap).
  useEffect(() => {
    if (!connected || !publicKey || !token) return
    const payload = decodeJwtPayload(token)
    if (!payload || payload.wallet !== publicKey.toBase58()) {
      clearAuth()
    }
  }, [connected, publicKey, token, clearAuth])

  // Auto-clear when the wallet disconnects externally (user clicks
  // Disconnect in their Phantom extension, locks their hardware wallet,
  // browser wipes wallet-adapter state, etc.). The other reconciliation
  // effects only fire when `connected` is true, so they can't catch this.
  useEffect(() => {
    if (!connected && (token !== null || isAdmin)) {
      clearAuth()
      lastWalletRef.current = null
    }
  }, [connected, token, isAdmin, clearAuth])

  // Expiry watcher: schedule a preemptive refresh inside the last 5min of
  // the JWT lifetime, plus a cleanup timer that fires at exact expiry to
  // ensure the store doesn't keep a stale token if refresh failed.
  useEffect(() => {
    if (!token || !expiresAt) return

    const nowSec = Math.floor(Date.now() / 1000)
    const remainingSec = expiresAt - nowSec
    const fiveMinSec = 5 * 60

    const clearTimer = setTimeout(
      () => {
        clearAuth()
      },
      Math.max(0, remainingSec) * 1000,
    )

    let refreshTimer: ReturnType<typeof setTimeout> | null = null

    const attemptRefresh = async (currentToken: string) => {
      try {
        const result = await refreshToken(currentToken)
        if (result) {
          const newExp = parseExpiryToEpoch(result.expiresIn)
          setAuth(result.token, isAdmin, newExp)
        }
      } catch {
        // Refresh failed — let the clearTimer handle expiry. We don't
        // surface this error: the 401 interceptor will catch the next
        // outgoing request and trigger UI re-auth.
      }
    }

    if (remainingSec > fiveMinSec) {
      refreshTimer = setTimeout(
        () => {
          void attemptRefresh(token)
        },
        (remainingSec - fiveMinSec) * 1000,
      )
    } else if (remainingSec > 0) {
      void attemptRefresh(token)
    }

    return () => {
      clearTimeout(clearTimer)
      if (refreshTimer) clearTimeout(refreshTimer)
    }
  }, [token, expiresAt, isAdmin, clearAuth, setAuth])

  const status: AuthStatus = useMemo(() => {
    if (authenticating) return 'connecting'
    if (!connected || !publicKey) return 'unauthed'
    if (!token) return 'unauthed'
    if (isJwtExpired(token)) return 'expired'
    return 'authed'
  }, [authenticating, connected, publicKey, token])

  const authenticate = async () => {
    if (!connected || !publicKey) {
      setVisible(true)
      return
    }
    if (!signMessage && !walletSupportsSignIn(wallet)) {
      const message =
        "This wallet doesn't support sign-in. Try Phantom, Solflare, or another wallet-standard wallet."
      setError(message)
      throw new Error(message)
    }

    setAuthenticating(true)
    setError(null)
    try {
      const wallet58 = publicKey.toBase58()
      const { nonce, message } = await requestNonce(wallet58)

      const siwsResult = await trySiws(wallet, wallet58, nonce)
      let verifyResult: VerifyResult
      if (siwsResult) {
        try {
          verifyResult = await verifySignature(wallet58, nonce, siwsResult.signatureHex, {
            signedMessage: siwsResult.signedMessageBase64,
          })
        } catch (err) {
          // Server may not yet support the SIWS verify path; gracefully fall
          // back to signMessage. Re-throws below if signMessage isn't
          // available.
          if (!signMessage) throw err
          verifyResult = await runSignMessageFlow(signMessage, wallet58, nonce, message)
        }
      } else {
        if (!signMessage) {
          throw new Error(
            "This wallet doesn't support sign-in. Try Phantom, Solflare, or another wallet-standard wallet.",
          )
        }
        verifyResult = await runSignMessageFlow(signMessage, wallet58, nonce, message)
      }

      const expiresAtSec = parseExpiryToEpoch(verifyResult.expiresIn)
      setAuth(verifyResult.token, verifyResult.isAdmin, expiresAtSec)
      lastWalletRef.current = wallet58
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed'
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    } finally {
      setAuthenticating(false)
    }
  }

  const disconnect = async () => {
    try {
      await walletDisconnect()
    } finally {
      clearAuth()
      lastWalletRef.current = null
    }
  }

  const value: AuthState = {
    status,
    token,
    expiresAt,
    isAdmin,
    publicKey: publicKey?.toBase58() ?? null,
    authenticate,
    disconnect,
    error,
  }

  return <AuthSyncContext.Provider value={value}>{children}</AuthSyncContext.Provider>
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

// Convert "24h" / "1h" / "300s" / "7d" relative TTL to absolute epoch seconds.
// Falls back to now+1h for unparseable input rather than throwing — verify
// already succeeded so we shouldn't drop the token over a parsing edge case.
function parseExpiryToEpoch(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)\s*(s|m|h|d)$/i)
  const now = Math.floor(Date.now() / 1000)
  if (!match) return now + 3600
  const n = parseInt(match[1], 10)
  const unit = match[2].toLowerCase() as 's' | 'm' | 'h' | 'd'
  const mul = { s: 1, m: 60, h: 3600, d: 86400 }[unit]
  return now + n * mul
}

interface VerifyResult {
  token: string
  isAdmin: boolean
  expiresIn: string
}

interface SiwsSignResult {
  signatureHex: string
  signedMessageBase64: string
}

interface WalletAdapterWithSignIn {
  signIn?: (input: {
    domain: string
    address: string
    statement?: string
    nonce: string
  }) => Promise<{
    signature?: Uint8Array
    signedMessage?: Uint8Array
  }>
}

interface WalletWithAdapter {
  adapter?: unknown
}

function getSignInAdapter(
  wallet: unknown,
): WalletAdapterWithSignIn['signIn'] | null {
  const adapter = (wallet as WalletWithAdapter | null)?.adapter as
    | WalletAdapterWithSignIn
    | undefined
  if (!adapter || typeof adapter.signIn !== 'function') return null
  return adapter.signIn.bind(adapter)
}

function walletSupportsSignIn(wallet: unknown): boolean {
  return getSignInAdapter(wallet) !== null
}

function isUserRejection(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (/reject|denied|user.*declin|cancel/i.test(err.message)) return true
  const name = (err as { name?: string }).name
  return Boolean(name && /reject|user/i.test(name))
}

async function trySiws(
  wallet: unknown,
  wallet58: string,
  nonce: string,
): Promise<SiwsSignResult | null> {
  const signIn = getSignInAdapter(wallet)
  if (!signIn) return null
  try {
    const result = await signIn({
      domain: typeof window !== 'undefined' ? window.location.host : 'sipher.sip-protocol.org',
      address: wallet58,
      statement: 'Sign in to Sipher',
      nonce,
    })
    if (!result?.signature || !result.signedMessage) return null
    if (result.signature.length === 0 || result.signedMessage.length === 0) return null
    return {
      signatureHex: bytesToHex(result.signature),
      signedMessageBase64: bytesToBase64(result.signedMessage),
    }
  } catch (err) {
    if (isUserRejection(err)) throw err
    return null
  }
}

async function runSignMessageFlow(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  wallet58: string,
  nonce: string,
  message: string,
): Promise<VerifyResult> {
  const sig = await signMessage(new TextEncoder().encode(message))
  const sigHex = bytesToHex(sig)
  return verifySignature(wallet58, nonce, sigHex)
}
