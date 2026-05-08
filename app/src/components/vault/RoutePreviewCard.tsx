import { ReactNode } from 'react'
import { Card } from '../ui/Card'
import { HashCell } from '../ui/HashCell'

interface RoutePreviewCardProps {
  wallet: string
  amount?: number
  asset?: string
  stealthIndex?: number
  vaultPda?: string
}

const DEFAULT_VAULT_PDA = 'CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u'

export function RoutePreviewCard({
  wallet,
  amount,
  asset,
  stealthIndex,
  vaultPda = DEFAULT_VAULT_PDA,
}: RoutePreviewCardProps) {
  const hasAmount = typeof amount === 'number' && amount > 0 && asset
  const amountLabel = hasAmount ? `${amount} ${asset}` : '—'
  const stealthLabel =
    stealthIndex !== undefined ? `Stealth #${stealthIndex}` : 'Stealth (derived on deposit)'

  return (
    <Card variant="default" className="p-4">
      <div
        className="text-2xs text-text-muted mb-3"
        style={{ letterSpacing: 'var(--tracking-widest)' }}
      >
        ROUTE PREVIEW
      </div>
      <div className="flex flex-col gap-2 font-mono text-xs">
        <Step n={1} label="You" detail={<HashCell hash={wallet} />} />
        <div className="ml-3 text-text-muted">↓ {amountLabel}</div>
        <Step n={2} label="Vault PDA" detail={<HashCell hash={vaultPda} />} />
        <div className="ml-3 text-text-muted">↓</div>
        <Step
          n={3}
          label={stealthLabel}
          detail={<span className="text-text-muted">{amountLabel}</span>}
        />
      </div>
    </Card>
  )
}

function Step({ n, label, detail }: { n: number; label: string; detail: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-5 h-5 inline-flex items-center justify-center rounded-full border border-cyan text-cyan text-2xs">
        {n}
      </span>
      <span className="text-text-secondary">{label}</span>
      <span className="ml-auto">{detail}</span>
    </div>
  )
}
