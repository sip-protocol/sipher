import type { ReactNode } from 'react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'

export interface UnauthedEmptyStateProps {
  title: string
  body: ReactNode
  cta?: ReactNode
  illustration?: ReactNode
}

function DefaultConnectCTA() {
  const { setVisible } = useWalletModal()
  return (
    <button
      type="button"
      onClick={() => setVisible(true)}
      className="self-start text-xs px-3 py-1.5 rounded-md text-bg font-semibold bg-accent hover:opacity-90"
      style={{ background: 'linear-gradient(90deg, var(--color-cyan), var(--color-violet))' }}
    >
      Connect wallet
    </button>
  )
}

export function UnauthedEmptyState({
  title,
  body,
  cta,
  illustration,
}: UnauthedEmptyStateProps) {
  return (
    <div
      data-testid="unauthed-empty-state"
      className="glass-strong rounded-2xl p-8 flex flex-col items-start gap-4"
    >
      {illustration && (
        <div data-testid="empty-state-illustration" className="w-full">
          {illustration}
        </div>
      )}
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <div className="text-sm text-text-secondary leading-relaxed">{body}</div>
      {cta ?? <DefaultConnectCTA />}
    </div>
  )
}
