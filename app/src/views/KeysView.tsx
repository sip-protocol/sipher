import { useAuthState } from '../hooks/useAuthState'
import { Banner } from '../components/ui/Banner'
import { UnauthedEmptyState } from '../components/ui/UnauthedEmptyState'
import { ViewKeyCard } from '../components/keys/ViewKeyCard'
import { StealthAddressBackup } from '../components/keys/StealthAddressBackup'

export default function KeysView() {
  const { status } = useAuthState()
  const seoTags = (
    <>
      <title>SIPHER — Keys</title>
      <meta name="description" content="Manage viewing keys and stealth addresses for shielded transfers." />
      <meta property="og:title" content="SIPHER — Keys" />
      <meta property="og:description" content="Manage viewing keys and stealth addresses for shielded transfers." />
    </>
  )
  if (status !== 'authed') {
    return (
      <div className="flex flex-col gap-4">
        {seoTags}
        <Banner kind="info">
          Stealth keys are a connected-wallet feature. Connect your wallet to view, rotate, or back them up.
        </Banner>
        <UnauthedEmptyState
          title="Stealth Keys"
          body="Your spending and viewing keys are derived from your wallet. Connect to view, rotate, or back them up."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {seoTags}
      <h1 className="text-sm text-text-muted" style={{ letterSpacing: 'var(--tracking-widest)' }}>
        VIEWING KEY MANAGEMENT
      </h1>
      <div data-testid="keys-view" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ViewKeyCard />
        <StealthAddressBackup />
      </div>
    </div>
  )
}
