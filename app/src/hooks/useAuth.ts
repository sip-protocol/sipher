import { useState, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { requestNonce, verifySignature } from '../api/auth'
import { useAppStore } from '../stores/app'

export function useAuth() {
  const { publicKey, signMessage } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const token = useAppStore((s) => s.token)
  const isAdmin = useAppStore((s) => s.isAdmin)
  const setAuth = useAppStore((s) => s.setAuth)
  const clearAuth = useAppStore((s) => s.clearAuth)

  const authenticate = useCallback(async () => {
    if (!publicKey || !signMessage) return null
    setLoading(true)
    setError(null)
    try {
      const wallet = publicKey.toBase58()
      const { nonce, message } = await requestNonce(wallet)
      const encoded = new TextEncoder().encode(message)
      const sig = await signMessage(encoded)
      const sigHex = Array.from(sig)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      const result = await verifySignature(wallet, nonce, sigHex)
      setAuth(result.token, result.isAdmin ?? false)
      return result.token
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [publicKey, signMessage, setAuth])

  return { token, isAdmin, authenticate, loading, error, isAuthenticated: !!token, clearAuth }
}
