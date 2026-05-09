import { useAuthState } from '../hooks/useAuthState'
import { ViewKeyCard } from '../components/keys/ViewKeyCard'
import { StealthAddressBackup } from '../components/keys/StealthAddressBackup'

export default function KeysView() {
  const { status } = useAuthState()
  if (status !== 'authed') return null

  return (
    <div className="flex flex-col gap-4">
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
