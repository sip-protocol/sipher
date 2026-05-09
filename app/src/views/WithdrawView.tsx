import { useEffect, useState, useCallback, useRef } from 'react'
import { ArrowLeft } from '@phosphor-icons/react'
import { apiFetch } from '../api/client'
import { useAuthState } from '../hooks/useAuthState'
import { useAppStore } from '../stores/app'
import { useTransactionSigner } from '../hooks/useTransactionSigner'
import { useNetworkConfigStore } from '../lib/networkConfig'
import { Card } from '../components/ui/Card'
import { RefundList } from '../components/vault/RefundList'
import type { Position } from '../components/vault/StealthAddressList'
import type { SignStatus } from '../hooks/useTransactionSigner'

interface PositionsResponse {
  positions: Position[]
  available: boolean
  reason?: string
  network: string
}

interface RefundTxResponse {
  serializedTx: string
  refundAmount: string
  network?: string
}

export default function WithdrawView() {
  const { token } = useAuthState()
  const setActiveView = useAppStore((s) => s.setActiveView)
  const network = useNetworkConfigStore((s) => s.config?.network ?? '')
  const isMainnet = network === 'mainnet'

  // Vault deposit_record PDA is per (wallet, mint), so positions[] is one row per mint
  // and the symbol-keyed status/signature/error maps are 1:1 with the rendered rows.
  const [positions, setPositions] = useState<Position[]>([])
  const [statusByToken, setStatusByToken] = useState<Record<string, SignStatus>>({})
  const [signaturesByToken, setSignaturesByToken] = useState<Record<string, string>>({})
  const [errorByToken, setErrorByToken] = useState<Record<string, string>>({})
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { signAndBroadcast } = useTransactionSigner()

  const refresh = useCallback(
    (signal?: AbortSignal) => {
      if (!token) return
      apiFetch<PositionsResponse>('/api/vault/positions', {
        token: token ?? undefined,
        signal,
      })
        .then((r) => {
          if (signal?.aborted) return
          setPositions(r.positions)
        })
        .catch(() => null)
    },
    [token],
  )

  useEffect(() => {
    if (!token || isMainnet) return
    const controller = new AbortController()
    refresh(controller.signal)
    return () => controller.abort()
  }, [token, isMainnet, refresh])

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [])

  const handleRefund = useCallback(
    async (tokenSymbol: string) => {
      setErrorByToken((s) => ({ ...s, [tokenSymbol]: '' }))
      setStatusByToken((s) => ({ ...s, [tokenSymbol]: 'signing' }))
      try {
        const { serializedTx } = await apiFetch<RefundTxResponse>('/api/vault/refund-tx', {
          method: 'POST',
          token: token ?? undefined,
          body: JSON.stringify({ token: tokenSymbol }),
        })
        setStatusByToken((s) => ({ ...s, [tokenSymbol]: 'broadcasting' }))
        const result = await signAndBroadcast(serializedTx)
        if (result.error) {
          setStatusByToken((s) => ({ ...s, [tokenSymbol]: 'error' }))
          setErrorByToken((s) => ({ ...s, [tokenSymbol]: result.error ?? 'Unknown error' }))
          return
        }
        setStatusByToken((s) => ({ ...s, [tokenSymbol]: 'confirmed' }))
        const sig = result.signature
        if (sig) {
          setSignaturesByToken((s) => ({ ...s, [tokenSymbol]: sig }))
        }
        // Refresh positions a moment after confirmation so the closed deposit
        // record drops out of the list.
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = setTimeout(() => refresh(), 1500)
      } catch (err) {
        setStatusByToken((s) => ({ ...s, [tokenSymbol]: 'error' }))
        setErrorByToken((s) => ({
          ...s,
          [tokenSymbol]: err instanceof Error ? err.message : 'Unknown error',
        }))
      }
    },
    [signAndBroadcast, token, refresh],
  )

  if (isMainnet) {
    return (
      <div className="flex flex-col gap-4 max-w-3xl mx-auto">
        <BackChip onClick={() => setActiveView('vault')} />
        <Card variant="default" className="p-6">
          <p className="text-sm text-text">
            Sipher Vault is on devnet only — switch network to withdraw.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto">
      <BackChip onClick={() => setActiveView('vault')} />
      <h1 className="text-2xl font-semibold">Refund from vault</h1>
      <p className="text-xs text-text-muted">
        Each refund returns the deposited balance to your wallet. The on-chain 24h cooldown is
        enforced per record.
      </p>
      <RefundList
        records={positions}
        onRefund={handleRefund}
        statusByToken={statusByToken}
        signaturesByToken={signaturesByToken}
      />
      {Object.entries(errorByToken)
        .filter(([, msg]) => Boolean(msg))
        .map(([tok, msg]) => (
          <Card
            key={tok}
            variant="default"
            role="alert"
            aria-live="assertive"
            className="p-3 border border-danger"
          >
            <p className="text-xs text-danger">
              {tok}: {msg}
            </p>
          </Card>
        ))}
    </div>
  )
}

function BackChip({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start flex items-center gap-1 text-xs text-text-secondary border border-line rounded-md px-2 py-1 hover:border-line-2 hover:text-text"
    >
      <ArrowLeft size={12} /> Back to Vault
    </button>
  )
}
