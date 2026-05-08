import type { SignStatus } from '../../hooks/useTransactionSigner'

interface TxStatusBadgeProps {
  status: SignStatus
  signature?: string
}

const SOLSCAN_BASE = 'https://solscan.io/tx'

const BADGE_BASE =
  'inline-flex items-center gap-1.5 border rounded-pill px-2.5 py-1 text-xs font-medium tracking-wide uppercase'

export function TxStatusBadge({ status, signature }: TxStatusBadgeProps) {
  if (status === 'idle') return null

  if (status === 'signing') {
    return (
      <span className={`${BADGE_BASE} border-accent/40 bg-accent-soft text-accent-hi`}>
        Signing…
      </span>
    )
  }

  if (status === 'broadcasting') {
    return (
      <span className={`${BADGE_BASE} border-cyan/40 bg-cyan-soft text-cyan-hi`}>
        Broadcasting…
      </span>
    )
  }

  if (status === 'confirmed') {
    return (
      <div className="flex items-center gap-2">
        <span className={`${BADGE_BASE} border-success/40 bg-success-soft text-success`}>
          Confirmed
        </span>
        {signature && (
          <a
            href={`${SOLSCAN_BASE}/${signature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-text-muted underline hover:text-text"
          >
            View on Solscan
          </a>
        )}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <span className={`${BADGE_BASE} border-danger/40 bg-danger-soft text-danger`}>
        Failed — try again
      </span>
    )
  }

  return null
}
