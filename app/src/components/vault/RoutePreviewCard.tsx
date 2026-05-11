import { ReactNode } from 'react'
import { Card } from '../ui/Card'
import { HashCell } from '../ui/HashCell'
import { JargonTerm } from '../ui/JargonTerm'
import { useNetworkConfigStore } from '../../lib/networkConfig'

interface RoutePreviewCardProps {
  wallet: string
  amount?: number
  asset?: string
  stealthIndex?: number
  vaultPda?: string
}

export function RoutePreviewCard({
  wallet,
  amount,
  asset,
  stealthIndex,
  vaultPda,
}: RoutePreviewCardProps) {
  const network = useNetworkConfigStore((s) => s.config?.network)
  const networkVaultPda = useNetworkConfigStore((s) => s.config?.vaultConfig)

  if (network === 'mainnet') {
    return (
      <Card variant="default" className="p-4">
        <div
          className="text-2xs text-text-muted mb-3"
          style={{ letterSpacing: 'var(--tracking-widest)' }}
        >
          ROUTE PREVIEW
        </div>
        <p className="text-xs text-text-muted">Vault on mainnet coming soon</p>
      </Card>
    )
  }

  const resolvedVaultPda = vaultPda ?? networkVaultPda ?? ''
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
        <Step
          n={1}
          label="You"
          detail={
            wallet ? (
              <HashCell hash={wallet} />
            ) : (
              <span className="text-text-muted">—</span>
            )
          }
        />
        <div className="ml-3 text-text-muted">↓ {amountLabel}</div>
        <Step
          n={2}
          label={<JargonTerm term="Vault PDA">Vault PDA</JargonTerm>}
          detail={
            resolvedVaultPda ? (
              <HashCell hash={resolvedVaultPda} />
            ) : (
              <span className="text-text-muted">—</span>
            )
          }
        />
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

function Step({ n, label, detail }: { n: number; label: ReactNode; detail: ReactNode }) {
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
