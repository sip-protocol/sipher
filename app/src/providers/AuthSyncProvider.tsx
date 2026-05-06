import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useAppStore } from '../stores/app'
import { decodeJwtPayload, isJwtExpired } from '../lib/jwt'
import { requestNonce, verifySignature } from '../api/auth'

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
  const { connected, publicKey, signMessage, disconnect: walletDisconnect } = useWallet()
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
    if (!signMessage) {
      const message = "This wallet doesn't support sign-in. Try Phantom, Solflare, or another wallet-standard wallet."
      setError(message)
      throw new Error(message)
    }

    setAuthenticating(true)
    setError(null)
    try {
      const wallet58 = publicKey.toBase58()
      const { nonce, message } = await requestNonce(wallet58)
      const sig = await signMessage(new TextEncoder().encode(message))
      const sigHex = bytesToHex(sig)
      const verifyResult = await verifySignature(wallet58, nonce, sigHex)
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
    await walletDisconnect()
    clearAuth()
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
