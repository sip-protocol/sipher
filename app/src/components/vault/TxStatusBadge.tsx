import type { SignStatus } from '../../hooks/useTransactionSigner'
import { solscanUrl, useNetworkConfigStore } from '../../lib/networkConfig'
import { Chip } from '../ui/Chip'

interface TxStatusBadgeProps {
  status: SignStatus
  signature?: string
}

export function TxStatusBadge({ status, signature }: TxStatusBadgeProps) {
  const solscanSuffix = useNetworkConfigStore((s) => s.config?.solscanSuffix ?? '?cluster=devnet')

  if (status === 'idle') return null

  if (status === 'signing') {
    return (
      <Chip tone="accent" role="status" aria-live="polite">Signing…</Chip>
    )
  }

  if (status === 'broadcasting') {
    return (
      <Chip tone="cyan" role="status" aria-live="polite">Broadcasting…</Chip>
    )
  }

  if (status === 'confirmed') {
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-2">
        <Chip tone="success">Confirmed</Chip>
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
      <Chip tone="danger" role="status" aria-live="polite">Failed — try again</Chip>
    )
  }

  return null
}
