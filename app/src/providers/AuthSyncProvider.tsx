import { createContext, useContext, useEffect, useMemo, useRef, ReactNode } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useAppStore } from '../stores/app'
import { decodeJwtPayload, isJwtExpired } from '../lib/jwt'

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
  const { connected, publicKey, disconnect: walletDisconnect } = useWallet()
  const { setVisible } = useWalletModal()
  const token = useAppStore((s) => s.token)
  const isAdmin = useAppStore((s) => s.isAdmin)
  const expiresAt = useAppStore((s) => s.expiresAt)
  const clearAuth = useAppStore((s) => s.clearAuth)

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
    if (!connected || !publicKey) return 'unauthed'
    if (!token) return 'unauthed'
    if (isJwtExpired(token)) return 'expired'
    return 'authed'
  }, [connected, publicKey, token])

  const authenticate = async () => {
    setVisible(true)
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
    error: null,
  }

  return <AuthSyncContext.Provider value={value}>{children}</AuthSyncContext.Provider>
}
