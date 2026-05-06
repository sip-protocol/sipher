import { useState, useEffect } from 'react'

const STORAGE_KEY = 'sipher.beta-banner.dismissed'

export function BetaBanner({ beta }: { beta: boolean }) {
  const [dismissed, setDismissed] = useState<boolean>(false)

  useEffect(() => {
    setDismissed(sessionStorage.getItem(STORAGE_KEY) === 'true')
  }, [])

  if (!beta) return null
  if (dismissed) return null

  function handleDismiss() {
    sessionStorage.setItem(STORAGE_KEY, 'true')
    setDismissed(true)
  }

  return (
    <div
      role="alert"
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
