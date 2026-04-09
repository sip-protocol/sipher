import { useState, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { requestNonce, verifySignature } from '../api/auth'

export function useAuth() {
  const { publicKey, signMessage } = useWallet()
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authenticate = useCallback(async () => {
    if (!publicKey || !signMessage) return null
    setLoading(true)
    setError(null)
    try {
      const wallet = publicKey.toBase58()
      const { nonce, message } = await requestNonce(wallet)
      const encoded = new TextEncoder().encode(message)
      const sig = await signMessage(encoded)
      const sigHex = Array.from(sig).map(b => b.toString(16).padStart(2, '0')).join('')
      const result = await verifySignature(wallet, nonce, sigHex)
      setToken(result.token)
      return result.token
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [publicKey, signMessage])

  return { token, authenticate, loading, error, isAuthenticated: !!token }
}
