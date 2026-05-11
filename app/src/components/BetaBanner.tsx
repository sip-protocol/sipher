import { useState } from 'react'
import { useActiveView } from '../hooks/useActiveView'
import { useNetworkConfigStore } from '../lib/networkConfig'

// Persist the dismissal as an absolute epoch-ms cutoff in localStorage so
// the banner stays hidden for 24 hours across tab close + reopen, but
// re-appears afterwards. Old sessionStorage key
// `sipher.beta-banner.dismissed` is intentionally NOT read here — the
// migration is one-way and stale entries should not silently suppress
// a banner the user hasn't dismissed under the new scheme.
const STORAGE_KEY = 'sipher.devnet-banner.dismissed-until'
const COOLDOWN_MS = 24 * 60 * 60 * 1000

const VAULT_VIEWS = new Set(['vault', 'deposit', 'withdraw'])

function isCurrentlyDismissed(): boolean {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) return false
  const until = Number(raw)
  if (!Number.isFinite(until)) return false
  return until > Date.now()
}

export function BetaBanner({ beta }: { beta: boolean }) {
  const [dismissed, setDismissed] = useState<boolean>(isCurrentlyDismissed)
  const activeView = useActiveView()
  const network = useNetworkConfigStore((s) => s.config?.network ?? '')

  // Vault flows are devnet-only — surface a non-dismissible banner whenever
  // the user is on a vault-related view but the active network is mainnet.
  // This trumps the generic beta banner so the constraint is unmissable.
  const showVaultDevnetBanner =
    activeView !== null && VAULT_VIEWS.has(activeView) && network === 'mainnet'

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
    const until = Date.now() + COOLDOWN_MS
    localStorage.setItem(STORAGE_KEY, String(until))
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
