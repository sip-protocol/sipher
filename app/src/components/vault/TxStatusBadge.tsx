import type { SignStatus } from '../../hooks/useTransactionSigner'
import { solscanUrl, useNetworkConfigStore } from '../../lib/networkConfig'

interface TxStatusBadgeProps {
  status: SignStatus
  signature?: string
}

const BADGE_BASE =
  'inline-flex items-center gap-1.5 border rounded-pill px-2.5 py-1 text-xs font-medium tracking-wide uppercase'

export function TxStatusBadge({ status, signature }: TxStatusBadgeProps) {
  const solscanSuffix = useNetworkConfigStore((s) => s.config?.solscanSuffix ?? '?cluster=devnet')

  if (status === 'idle') return null

  if (status === 'signing') {
    return (
      <span
        role="status"
        aria-live="polite"
        className={`${BADGE_BASE} border-accent/40 bg-accent-soft text-accent-hi`}
      >
        Signing…
      </span>
    )
  }

  if (status === 'broadcasting') {
    return (
      <span
        role="status"
        aria-live="polite"
        className={`${BADGE_BASE} border-cyan/40 bg-cyan-soft text-cyan-hi`}
      >
        Broadcasting…
      </span>
    )
  }

  if (status === 'confirmed') {
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-2">
        <span className={`${BADGE_BASE} border-success/40 bg-success-soft text-success`}>
          Confirmed
        </span>
        {signature && (
          <a
            href={solscanUrl(signature, solscanSuffix)}
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
      <span
        role="status"
        aria-live="polite"
        className={`${BADGE_BASE} border-danger/40 bg-danger-soft text-danger`}
      >
        Failed — try again
      </span>
    )
  }

  return null
}
