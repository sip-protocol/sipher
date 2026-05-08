import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { useAuthState } from '../hooks/useAuthState'
import { useAppStore } from '../stores/app'
import { useNetworkConfigStore } from '../lib/networkConfig'
import { Card } from '../components/ui/Card'
import { HashCell } from '../components/ui/HashCell'
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

const CHIP_BASE =
  'inline-flex items-center gap-1.5 border rounded-pill px-2.5 py-1 text-xs font-medium tracking-wide uppercase'

export default function VaultView() {
  const { token } = useAuthState()
  const setActiveView = useAppStore((s) => s.setActiveView)
  const network = useNetworkConfigStore((s) => s.config?.network ?? '')
  const isMainnet = network === 'mainnet'

  const [vault, setVault] = useState<VaultData | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [stealthTree, setStealthTree] = useState<StealthNode[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div data-testid="vault-view" className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ShieldedVaultPanel
        positions={positions}
        stealthTree={stealthTree}
        loading={loading}
      />
      <UnshieldedWalletPanel
        wallet={vault?.wallet ?? ''}
        sol={vault?.balances.sol ?? 0}
        onDeposit={() => setActiveView('deposit')}
        disabled={isMainnet}
      />
    </div>
  )
}

function ShieldedVaultPanel({
  positions,
  stealthTree,
  loading,
}: {
  positions: Position[]
  stealthTree: StealthNode[]
  loading: boolean
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
        <span className={`${CHIP_BASE} border-line text-text-muted`}>
          {positions.length} positions
        </span>
        <span
          className={`${CHIP_BASE} ${hasPositions ? 'border-success/40 bg-success-soft text-success' : 'border-line text-text-muted'}`}
        >
          {hasPositions ? 'Active' : 'Empty'}
        </span>
      </div>
      <StealthAddressList positions={positions} stealthTree={stealthTree} loading={loading} />
      <button
        type="button"
        disabled
        className="self-start border border-line rounded-md px-3 py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
        title="Coming soon — refund flow ships in PR 6b"
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
