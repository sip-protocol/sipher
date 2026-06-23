import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { apiFetch } from '../api/client'
import { useAuthState } from '../hooks/useAuthState'
import { useTransactionSigner } from '../hooks/useTransactionSigner'
import { useNetworkConfigStore } from '../lib/networkConfig'
import { DepositForm } from '../components/vault/DepositForm'
import { RoutePreviewCard } from '../components/vault/RoutePreviewCard'
import { PrivacyPreviewPanel } from '../components/vault/PrivacyPreviewPanel'
import { Card } from '../components/ui/Card'
import { UnauthedEmptyState } from '../components/ui/UnauthedEmptyState'

interface TokenBalance {
  mint: string
  symbol: string
  amount: string
  decimals: number
  uiAmount: number
}

interface VaultData {
  wallet: string
  balances: { sol: number; tokens: TokenBalance[]; status: string }
}

interface VaultPosition {
  mint: string
  symbol: string
  balance: string
  balanceUiAmount: number
  decimals: number
  lastDepositAt: number
  refundableAt: number
  cooldownActive: boolean
  depositRecordAddress: string
}

interface PositionsResponse {
  positions: VaultPosition[]
  network: string
  available: boolean
  reason?: string
}

interface DepositTxResponse {
  serializedTx: string
  depositRecordAddress?: string
  vaultTokenAddress?: string
  amountBaseUnits?: string
  feeBps?: number
  network?: string
}

const DEPOSIT_SUCCESS_REDIRECT_MS = 2000

export default function DepositView() {
  const { token, status: authStatus } = useAuthState()
  const navigate = useNavigate()
  const network = useNetworkConfigStore((s) => s.config?.network ?? '')
  const isMainnet = network === 'mainnet'

  const [vaultData, setVaultData] = useState<VaultData | null>(null)
  const [pendingAmount, setPendingAmount] = useState(0)
  const [pendingAsset, setPendingAsset] = useState('SOL')
  const [error, setError] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | undefined>()
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { signAndBroadcast, status, reset } = useTransactionSigner()

  useEffect(() => {
    if (!token || isMainnet) return
    const controller = new AbortController()
    apiFetch<VaultData>('/api/vault', { token, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setVaultData(data)
      })
      .catch(() => null)
    apiFetch<PositionsResponse>('/api/vault/positions', { token, signal: controller.signal }).catch(
      () => null,
    )
    return () => controller.abort()
  }, [token, isMainnet])

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
    }
  }, [])

  const maxByAsset: Record<string, number> = {
    SOL: vaultData?.balances.sol ?? 0,
    USDC: vaultData?.balances.tokens.find((t) => t.symbol === 'USDC')?.uiAmount ?? 0,
    USDT: vaultData?.balances.tokens.find((t) => t.symbol === 'USDT')?.uiAmount ?? 0,
  }

  const handleSubmit = useCallback(
    async (amount: number, asset: string) => {
      setError(null)
      setSignature(undefined)
      setPendingAmount(amount)
      setPendingAsset(asset)
      try {
        const { serializedTx } = await apiFetch<DepositTxResponse>('/api/vault/deposit-tx', {
          method: 'POST',
          token: token ?? undefined,
          body: JSON.stringify({ amount, token: asset }),
        })
        const result = await signAndBroadcast(serializedTx)
        if (result.error) {
          setError(result.error)
          return
        }
        setSignature(result.signature)
        redirectTimerRef.current = setTimeout(
          () => navigate('/vault'),
          DEPOSIT_SUCCESS_REDIRECT_MS,
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    },
    [signAndBroadcast, token, navigate],
  )

  const seoTags = (
    <>
      <title>SIPHER — Deposit</title>
      <meta name="description" content="Deposit to shielded vault." />
      <meta property="og:title" content="SIPHER — Deposit" />
      <meta property="og:description" content="Deposit to shielded vault." />
    </>
  )

  if (authStatus !== 'authed') {
    return (
      <>
        {seoTags}
        <UnauthedEmptyState
          title="Shielded Deposit"
          body={<>Connect a wallet to deposit into the shielded vault.</>}
        />
      </>
    )
  }

  if (isMainnet) {
    return (
      <div className="flex flex-col gap-4 max-w-3xl mx-auto">
        {seoTags}
        <BackChip onClick={() => navigate('/vault')} />
        <Card variant="default" className="p-6">
          <p className="text-sm text-text">
            Sipher Vault is on devnet only — switch network to deposit.
          </p>
        </Card>
      </div>
    )
  }

  const isSubmitting = status === 'signing' || status === 'broadcasting'

  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto">
      {seoTags}
      <BackChip onClick={() => navigate('/vault')} />
      <h1 className="text-2xl font-semibold">Shield to vault</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3">
          <fieldset disabled={isSubmitting} className="contents">
            <DepositForm
              onSubmit={handleSubmit}
              maxByAsset={maxByAsset}
              disabled={isSubmitting}
              status={status}
              signature={signature}
            />
          </fieldset>
          {error && (
            <Card
              variant="default"
              className="p-3 border border-danger"
              role="alert"
              aria-live="assertive"
            >
              <p className="text-xs text-danger mb-2">{error}</p>
              <button
                type="button"
                onClick={() => {
                  reset()
                  setError(null)
                }}
                className="text-xs underline text-text-secondary hover:text-text"
              >
                Try again
              </button>
            </Card>
          )}
          <RoutePreviewCard
            wallet={vaultData?.wallet ?? ''}
            amount={pendingAmount}
            asset={pendingAsset}
          />
        </div>
        <PrivacyPreviewPanel
          address={vaultData?.wallet ?? ''}
          projectedAmount={pendingAmount}
          projectedToken={pendingAsset}
        />
      </div>
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
