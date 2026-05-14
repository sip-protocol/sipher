import { useEffect, useMemo, useRef, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useAuthState } from '../hooks/useAuthState'
import { useTransactionSigner } from '../hooks/useTransactionSigner'
import { apiFetch } from '../api/client'
import { isAuthError } from '../lib/auth-errors'

type CardStatus = 'idle' | 'signing' | 'callback-posting' | 'rejecting' | 'done' | 'error'

interface Props {
  flagId: string
  toolName: 'send' | 'swap'
  serializedTx: string
  network: 'mainnet-beta' | 'devnet'
  walletPubkey: string
  display: {
    title: string
    primaryDetail: string
    secondaryDetails: string[]
  }
  onResolved: (decision: 'confirm' | 'reject') => void
}

function detectClusterFromEndpoint(endpoint: string): 'mainnet-beta' | 'devnet' | 'unknown' {
  if (endpoint.includes('devnet')) return 'devnet'
  if (endpoint.includes('mainnet')) return 'mainnet-beta'
  return 'unknown'
}

export default function SignTxCard({
  flagId,
  toolName: _toolName,
  serializedTx,
  network,
  walletPubkey,
  display,
  onResolved,
}: Props) {
  const { token } = useAuthState()
  const { signAndBroadcast } = useTransactionSigner()
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const [status, setStatus] = useState<CardStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const beaconFiredRef = useRef(false)
  const statusRef = useRef<CardStatus>('idle')

  // Mirror status into a ref so the unmount cleanup below can read the live
  // value at teardown instead of a stale closure capture.
  useEffect(() => {
    statusRef.current = status
  }, [status])

  const connectedPubkey = publicKey?.toBase58() ?? null
  const walletMismatch = connectedPubkey !== null && connectedPubkey !== walletPubkey
  const connectedCluster = useMemo(
    () => detectClusterFromEndpoint(connection.rpcEndpoint),
    [connection.rpcEndpoint],
  )
  const networkMismatch = connectedCluster !== 'unknown' && connectedCluster !== network

  const dispatchReject = async (reason?: string) => {
    setStatus('rejecting')
    setError(null)
    try {
      await apiFetch(`/api/tool-signing/${encodeURIComponent(flagId)}/reject`, {
        method: 'POST',
        token: token ?? undefined,
        body: reason ? JSON.stringify({ reason }) : undefined,
      })
      setStatus('done')
      onResolved('reject')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error'
      if (!isAuthError(message)) setError(message)
      setStatus('error')
    }
  }

  const dispatchSign = async () => {
    if (walletMismatch || networkMismatch || status !== 'idle') return
    setStatus('signing')
    setError(null)

    const signResult = await signAndBroadcast(serializedTx)
    if (signResult.error) {
      setError(signResult.error)
      setStatus('error')
      return
    }
    if (!signResult.signature) {
      setError('Wallet did not return a signature')
      setStatus('error')
      return
    }

    setStatus('callback-posting')
    try {
      await apiFetch(`/api/tool-signing/${encodeURIComponent(flagId)}/confirm`, {
        method: 'POST',
        token: token ?? undefined,
        body: JSON.stringify({ signature: signResult.signature }),
      })
      setStatus('done')
      onResolved('confirm')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error'
      if (!isAuthError(message)) setError(message)
      setStatus('error')
    }
  }

  const retry = () => {
    setStatus('idle')
    setError(null)
  }

  // Best-effort cleanup beacon on unmount-while-idle: if the user closes the
  // tab or navigates away before deciding, fire a /reject so the server can
  // release the pending slot instead of waiting for the 60s TTL to expire.
  //
  // status is intentionally NOT in the dep array: including it would re-run the
  // cleanup on every transition (e.g. idle → signing), and the cleanup's
  // closure would still see the OLD captured status. That race fired /reject
  // the instant the user clicked Sign, server-rejecting the flag while the
  // wallet popup was still opening. Reading via statusRef lets the cleanup
  // observe the current status at actual unmount time only.
  useEffect(() => {
    return () => {
      if (beaconFiredRef.current) return
      if (statusRef.current !== 'idle') return
      try {
        const blob = new Blob([JSON.stringify({ reason: 'tab_closed' })], { type: 'application/json' })
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
          navigator.sendBeacon(`/api/tool-signing/${encodeURIComponent(flagId)}/reject`, blob)
        } else {
          fetch(`/api/tool-signing/${encodeURIComponent(flagId)}/reject`, {
            method: 'POST',
            keepalive: true,
            headers: token
              ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
              : { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'tab_closed' }),
          }).catch(() => {})
        }
        beaconFiredRef.current = true
      } catch {
        // best-effort only — never surface to user
      }
    }
  }, [flagId, token])

  const signLabel =
    status === 'signing' ? 'Open your wallet...' :
    status === 'callback-posting' ? 'Finalizing...' :
    status === 'done' ? 'Signed' :
    'Sign with Wallet'

  return (
    <div className="bg-glass-1 border border-line rounded-lg p-4 flex flex-col gap-3">
      <div className="text-[12px] text-text-muted uppercase tracking-wide">Sign Transaction</div>
      <div className="text-[14px] text-text font-medium">{display.title}</div>
      <div className="text-[12px] text-text-muted leading-relaxed">{display.primaryDetail}</div>
      <ul className="text-[11px] text-text-muted flex flex-col gap-1">
        {display.secondaryDetails.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>

      {walletMismatch && (
        <div className="text-[12px] text-warning">
          Reconnect wallet {walletPubkey.slice(0, 4)}...{walletPubkey.slice(-4)} to sign.
        </div>
      )}
      {networkMismatch && (
        <div className="text-[12px] text-warning">
          Wrong network: connected to {connectedCluster}, this tx is for {network}.
        </div>
      )}
      {error && (
        <div className="text-[12px] text-danger">{error}</div>
      )}

      <div className="flex gap-2">
        {status === 'error' ? (
          <button
            onClick={retry}
            className="flex-1 border border-sipher/50 text-sipher py-2 rounded-lg text-[12px] font-medium hover:bg-sipher/10"
          >
            Retry
          </button>
        ) : (
          <button
            onClick={dispatchSign}
            disabled={status !== 'idle' || walletMismatch || networkMismatch}
            className="flex-1 border border-sipher/50 text-sipher py-2 rounded-lg text-[12px] font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sipher/10"
          >
            {signLabel}
          </button>
        )}
        <button
          onClick={() => dispatchReject()}
          disabled={status === 'signing' || status === 'callback-posting' || status === 'done'}
          className="px-4 border border-line text-text-muted py-2 rounded-lg text-[12px] hover:text-text disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
