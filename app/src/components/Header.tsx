import {
  ChartBar,
  Vault,
  ChatCircle,
  GlobeHemisphereWest,
  Key,
} from '@phosphor-icons/react'
import { useAppStore, type View } from '../stores/app'
import { useAuthState } from '../hooks/useAuthState'
import { useToast } from '../providers/ToastProvider'
import AgentDot from './AgentDot'
import { UserMenu } from './UserMenu'
import type { AdminView } from './UserMenu'
import { useNetworkConfigStore } from '../lib/networkConfig'
import { TickerBar } from './ui/TickerBar'

interface Tab {
  id: View
  label: string
  icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'fill' }>
  tabletOnly?: boolean
}

const TABS: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: ChartBar },
  { id: 'vault', label: 'Vault', icon: Vault },
  { id: 'chains', label: 'Chains', icon: GlobeHemisphereWest },
  { id: 'keys', label: 'Keys', icon: Key },
  { id: 'chat', label: 'Chat', icon: ChatCircle, tabletOnly: true },
]

export default function Header() {
  const { status, publicKey, authenticate, disconnect, isAdmin } = useAuthState()
  const { show: showToast } = useToast()
  const activeView = useAppStore((s) => s.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const setChatSheetOpen = useAppStore((s) => s.setChatSheetOpen)
  const network = useNetworkConfigStore((s) => s.config?.network ?? 'mainnet')

  const handleConnectOrSignIn = () => {
    authenticate().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Sign-in failed'
      showToast({ message, kind: 'error' })
    })
  }

  const handleCopy = async () => {
    if (!publicKey) return
    await navigator.clipboard.writeText(publicKey)
    showToast({ message: 'Address copied', kind: 'success', durationMs: 3000 })
  }

  const handleDisconnect = async () => {
    await disconnect()
    showToast({ message: 'Disconnected', kind: 'info', durationMs: 3000 })
  }

  const handleAdminNavigate = (view: AdminView) => {
    setActiveView(view)
  }

  return (
    <header className="hidden md:flex h-12 border-b border-line items-center justify-between px-4 bg-bg shrink-0 z-sticky">
      <div className="flex items-center gap-3">
        <span
          className="font-semibold text-sm text-text"
          style={{ letterSpacing: 'var(--tracking-mega)' }}
        >
          SIPHER
        </span>
        <span className="text-2xs text-text-muted font-mono uppercase">{network}</span>
        <TickerBar />
        <nav className="flex items-center ml-3">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active =
              activeView === tab.id ||
              (tab.id === 'vault' && (activeView === 'deposit' || activeView === 'withdraw'))
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  tab.tabletOnly ? 'lg:hidden' : '',
                  active ? 'text-text bg-glass-2' : 'text-text-muted hover:text-text-secondary',
                ].join(' ')}
              >
                <Icon size={14} weight={active ? 'fill' : 'regular'} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setChatSheetOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary border border-line rounded-md hover:border-line-2 hover:text-text transition-colors"
        >
          <ChatCircle size={14} />
          Ask SIPHER
        </button>

        <div className="flex items-center gap-1.5">
          <AgentDot agent="sipher" size={5} />
          <AgentDot agent="herald" size={5} />
          <AgentDot agent="sentinel" size={5} />
        </div>

        {status === 'authed' && publicKey ? (
          <UserMenu
            address={publicKey}
            isAdmin={isAdmin}
            onNavigate={handleAdminNavigate}
            onCopy={handleCopy}
            onReSignIn={handleConnectOrSignIn}
            onDisconnect={handleDisconnect}
          />
        ) : status === 'expired' ? (
          <button
            onClick={handleConnectOrSignIn}
            title="Session expired — sign in to continue"
            className="bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-lg text-[11px] text-amber-400 font-medium hover:bg-amber-500/20 transition-colors"
          >
            Re-sign in
          </button>
        ) : (
          <button
            onClick={handleConnectOrSignIn}
            className="bg-accent/10 border border-accent/20 px-3 py-1 rounded-lg text-[11px] text-accent font-medium hover:bg-accent/20 transition-colors"
          >
            Connect
          </button>
        )}
      </div>
    </header>
  )
}
