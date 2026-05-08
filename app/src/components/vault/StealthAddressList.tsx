import { Card } from '../ui/Card'
import { HashCell } from '../ui/HashCell'

export interface Position {
  mint: string
  symbol: string
  balance: string
  balanceUiAmount: number
  lockedAmount: string
  decimals: number
  lastDepositAt: number
  refundableAt: number
  cooldownActive: boolean
  depositRecordAddress: string
}

export interface StealthNode {
  index: number
  derivationPath: string
  stealthAddress: string
  parentIndex: number | null
  createdAt: string
}

interface StealthAddressListProps {
  positions: Position[]
  stealthTree: StealthNode[]
  loading: boolean
}

// Chip styling mirrors TxStatusBadge's BADGE_BASE so non-interactive labels
// stay visually consistent with the interactive Pill primitive without
// borrowing its button semantics.
const CHIP_BASE =
  'inline-flex items-center gap-1.5 border rounded-pill px-2.5 py-1 text-xs font-medium tracking-wide uppercase'

export function StealthAddressList({
  positions,
  stealthTree,
  loading,
}: StealthAddressListProps) {
  return (
    <div className="flex flex-col gap-4">
      <PositionsSection positions={positions} loading={loading} />
      <StealthTreeSection stealthTree={stealthTree} loading={loading} />
    </div>
  )
}

function PositionsSection({
  positions,
  loading,
}: {
  positions: Position[]
  loading: boolean
}) {
  return (
    <Card variant="default" className="p-4">
      <div
        className="text-2xs text-text-muted mb-3"
        style={{ letterSpacing: 'var(--tracking-widest)' }}
      >
        VAULT POSITIONS
      </div>
      {loading ? (
        <p className="text-xs text-text-muted">Loading…</p>
      ) : positions.length === 0 ? (
        <p className="text-xs text-text-muted">
          No vault positions yet — deposit to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {positions.map((p) => (
            <div
              key={p.depositRecordAddress}
              className="flex items-center justify-between text-xs font-mono"
            >
              <div className="flex items-center gap-2">
                <span className={`${CHIP_BASE} border-cyan/40 bg-cyan-soft text-cyan-hi`}>
                  {p.symbol}
                </span>
                <span className="text-text">{p.balanceUiAmount}</span>
              </div>
              {p.cooldownActive ? (
                <span className={`${CHIP_BASE} border-line text-text-muted`}>Cooldown</span>
              ) : (
                <span
                  className={`${CHIP_BASE} border-success/40 bg-success-soft text-success`}
                >
                  Refundable
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function StealthTreeSection({
  stealthTree,
  loading,
}: {
  stealthTree: StealthNode[]
  loading: boolean
}) {
  return (
    <Card variant="default" className="p-4">
      <div
        className="text-2xs text-text-muted mb-3"
        style={{ letterSpacing: 'var(--tracking-widest)' }}
      >
        STEALTH TREE
      </div>
      {loading ? (
        <p className="text-xs text-text-muted">Loading…</p>
      ) : stealthTree.length === 0 ? (
        <p className="text-xs text-text-muted">No stealth tree available.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {stealthTree.map((node) => (
            <div
              key={node.index}
              className="flex items-center justify-between text-xs font-mono"
            >
              <div className="flex items-center gap-2">
                <span className="text-text-muted">#{node.index}</span>
                <span className="text-text-secondary">{node.derivationPath}</span>
                <HashCell hash={node.stealthAddress} />
              </div>
            </div>
          ))}
          {stealthTree.length === 1 && (
            <span
              className={`${CHIP_BASE} self-start mt-2 border-line text-text-muted`}
            >
              M19 — Derived stealth tree expands when M19 ships
            </span>
          )}
        </div>
      )}
    </Card>
  )
}
