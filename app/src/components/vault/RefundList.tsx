import { Card } from '../ui/Card'
import { CooldownChip } from './CooldownChip'
import { TxStatusBadge } from './TxStatusBadge'
import type { Position } from './StealthAddressList'
import type { SignStatus } from '../../hooks/useTransactionSigner'

interface RefundListProps {
  records: Position[]
  onRefund: (token: string) => Promise<void> | void
  statusByToken: Record<string, SignStatus>
  signaturesByToken: Record<string, string>
}

const CHIP_BASE =
  'inline-flex items-center gap-1.5 border rounded-pill px-2.5 py-1 text-xs font-medium tracking-wide uppercase'

export function RefundList({ records, onRefund, statusByToken, signaturesByToken }: RefundListProps) {
  if (records.length === 0) {
    return (
      <Card variant="default" className="p-6">
        <p className="text-sm text-text-muted">No active vault positions to refund.</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {records.map((p) => {
        const status = statusByToken[p.symbol] ?? 'idle'
        const signature = signaturesByToken[p.symbol]
        const busy = status === 'signing' || status === 'broadcasting'
        return (
          <Card
            key={p.depositRecordAddress}
            variant="default"
            className="p-4 flex items-center gap-3"
          >
            <span className={`${CHIP_BASE} border-cyan/40 bg-cyan-soft text-cyan-hi`}>
              {p.symbol}
            </span>
            <span className="text-sm font-mono">{p.balanceUiAmount}</span>
            <CooldownChip refundableAt={p.refundableAt} />
            <div className="ml-auto flex items-center gap-3">
              <TxStatusBadge status={status} signature={signature} />
              <button
                type="button"
                onClick={() => onRefund(p.symbol)}
                disabled={p.cooldownActive || busy}
                className="text-xs border border-line rounded-md px-3 py-1.5 hover:border-line-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Refund
              </button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
