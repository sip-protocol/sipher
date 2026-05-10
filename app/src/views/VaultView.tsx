import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { useAuthState } from '../hooks/useAuthState'
import { useNetworkConfigStore } from '../lib/networkConfig'
import { useOnAuthClear } from '../store/useOnAuthClear'
import { Banner } from '../components/ui/Banner'
import { Card } from '../components/ui/Card'
import { Chip } from '../components/ui/Chip'
import { HashCell } from '../components/ui/HashCell'
import { UnauthedEmptyState } from '../components/ui/UnauthedEmptyState'
import {
  StealthAddressList,
  type Position,
  type StealthNode,
} from '../components/vault/StealthAddressList'
import { RoutePreviewCard } from '../components/vault/RoutePreviewCard'

interface TokenBalance {
  mint: string
  symbol: string
  amount: string
  decimals: number
  uiAmount: number
}

interface VaultData {
  wallet: string
  network?: string
  balances: { sol: number; tokens: TokenBalance[]; status: string }
}

interface PositionsResponse {
  positions: Position[]
  available: boolean
  reason?: string
  network: string
}

interface StealthIndexResponse {
  tree: StealthNode[]
  rootWallet: string
}

export default function VaultView() {
  const { token, status } = useAuthState()
  const navigate = useNavigate()
  const network = useNetworkConfigStore((s) => s.config?.network ?? '')
  const isMainnet = network === 'mainnet'

  const [vault, setVault] = useState<VaultData | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [stealthTree, setStealthTree] = useState<StealthNode[]>([])
  const [loading, setLoading] = useState(true)

  useOnAuthClear(() => {
    setVault(null)
    setPositions([])
    setStealthTree([])
    setLoading(true)
  })

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    setLoading(true)
    Promise.all([
      apiFetch<VaultData>('/api/vault', { token, signal: controller.signal })
        .then((data) => {
          if (!controller.signal.aborted) setVault(data)
        })
        .catch(() => null),
      apiFetch<PositionsResponse>('/api/vault/positions', { token, signal: controller.signal })
        .then((r) => {
          if (!controller.signal.aborted) setPositions(r.positions)
        })
        .catch(() => null),
      apiFetch<StealthIndexResponse>('/api/stealth/index', { token, signal: controller.signal })
        .then((r) => {
          if (!controller.signal.aborted) setStealthTree(r.tree)
        })
        .catch(() => null),
    ]).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [token])

  if (status !== 'authed') {
    return (
      <div className="flex flex-col gap-4">
        <Banner kind="info">
          Vault is a connected-wallet feature. Connect your wallet to deposit, manage stealth keys, and view your shielded balance.
        </Banner>
        <UnauthedEmptyState
          title="Shielded Vault"
          body={
            <>
              Privacy-preserving SOL + token vault on Solana. Stealth output addresses by default.
              <br />
              <strong>Connect a wallet to deposit.</strong>
            </>
          }
          illustration={<RoutePreviewCard wallet="" />}
        />
      </div>
    )
  }

  return (
    <div data-testid="vault-view" className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ShieldedVaultPanel
        positions={positions}
        stealthTree={stealthTree}
        loading={loading}
        onWithdraw={() => navigate('/vault/withdraw')}
        disabled={isMainnet}
      />
      <UnshieldedWalletPanel
        wallet={vault?.wallet ?? ''}
        sol={vault?.balances.sol ?? 0}
        onDeposit={() => navigate('/vault/deposit')}
        disabled={isMainnet}
      />
    </div>
  )
}

function ShieldedVaultPanel({
  positions,
  stealthTree,
  loading,
  onWithdraw,
  disabled,
}: {
  positions: Position[]
  stealthTree: StealthNode[]
  loading: boolean
  onWithdraw: () => void
  disabled: boolean
}) {
  const totalSol = positions.find((p) => p.symbol === 'SOL')?.balanceUiAmount ?? 0
  const hasPositions = positions.length > 0
  return (
    <Card variant="default" className="p-5 flex flex-col gap-4">
      <div
        className="text-2xs text-text-muted"
        style={{ letterSpacing: 'var(--tracking-widest)' }}
      >
        ◆ SHIELDED VAULT
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-mono">{totalSol}</span>
        <span className="text-sm text-text-muted">SOL</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip tone="neutral">{positions.length} positions</Chip>
        <Chip tone={hasPositions ? 'success' : 'neutral'}>
          {hasPositions ? 'Active' : 'Empty'}
        </Chip>
      </div>
      <StealthAddressList positions={positions} stealthTree={stealthTree} loading={loading} />
      <button
        type="button"
        onClick={onWithdraw}
        disabled={disabled}
        className="self-start border border-line rounded-md px-3 py-1.5 text-xs hover:border-line-2 disabled:opacity-40 disabled:cursor-not-allowed"
        title={disabled ? 'Devnet only — switch network' : ''}
      >
        Withdraw
      </button>
    </Card>
  )
}

function UnshieldedWalletPanel({
  wallet,
  sol,
  onDeposit,
  disabled,
}: {
  wallet: string
  sol: number
  onDeposit: () => void
  disabled: boolean
}) {
  return (
    <Card variant="default" className="p-5 flex flex-col gap-4">
      <div
        className="text-2xs text-text-muted"
        style={{ letterSpacing: 'var(--tracking-widest)' }}
      >
        ○ UNSHIELDED WALLET
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-mono">{sol}</span>
        <span className="text-sm text-text-muted">SOL</span>
      </div>
      {wallet && <HashCell hash={wallet} />}
      <RoutePreviewCard wallet={wallet} />
      <button
        type="button"
        onClick={onDeposit}
        disabled={disabled}
        className="self-start text-xs px-3 py-1.5 rounded-md text-bg font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: 'linear-gradient(90deg, var(--color-cyan), var(--color-violet))' }}
        title={disabled ? 'Devnet only — switch network' : ''}
      >
        Shield to vault
      </button>
    </Card>
  )
}
