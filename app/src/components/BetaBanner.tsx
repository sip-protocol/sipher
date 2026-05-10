import { useState } from 'react'
import { useActiveView } from '../hooks/useActiveView'
import { useNetworkConfigStore } from '../lib/networkConfig'

const STORAGE_KEY = 'sipher.beta-banner.dismissed'

const VAULT_VIEWS = new Set(['vault', 'deposit', 'withdraw'])

export function BetaBanner({ beta }: { beta: boolean }) {
  const [dismissed, setDismissed] = useState<boolean>(
    () => sessionStorage.getItem(STORAGE_KEY) === 'true',
  )
  const activeView = useActiveView()
  const network = useNetworkConfigStore((s) => s.config?.network ?? '')

  // Vault flows are devnet-only — surface a non-dismissible banner whenever
  // the user is on a vault-related view but the active network is mainnet.
  // This trumps the generic beta banner so the constraint is unmissable.
  const showVaultDevnetBanner = VAULT_VIEWS.has(activeView) && network === 'mainnet'

  if (showVaultDevnetBanner) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="sticky top-0 z-50 w-full bg-amber-100 text-amber-900 border-b border-amber-300"
      >
        <div className="max-w-7xl mx-auto px-4 py-2 text-sm text-center">
          Sipher Vault is on devnet only — switch network to deposit/withdraw.
        </div>
      </div>
    )
  }

  if (!beta) return null
  if (dismissed) return null

  function handleDismiss() {
    sessionStorage.setItem(STORAGE_KEY, 'true')
    setDismissed(true)
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-50 w-full bg-amber-100 text-amber-900 border-b border-amber-300"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <p className="text-sm">
          🧪 You're on <strong>DEVNET BETA</strong>. This is testnet — funds are not real.{' '}
          <a
            href="https://faucet.solana.com"
            target="_blank"
            rel="noreferrer"
            className="underline font-medium"
          >
            Get devnet SOL →
          </a>
        </p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={handleDismiss}
          className="text-amber-900 hover:text-amber-700 text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  )
}
