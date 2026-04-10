import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import {
  ChartBar,
  Vault,
  Broadcast,
  UsersThree,
  ChatCircle,
} from '@phosphor-icons/react'
import { useAppStore, type View } from '../stores/app'
import { useAuth } from '../hooks/useAuth'
import AgentDot from './AgentDot'
import { truncateAddress } from '../lib/format'

const NETWORK = (import.meta.env.VITE_SOLANA_NETWORK ?? 'mainnet-beta') as string

interface Tab {
  id: View
  label: string
  icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'fill' }>
  adminOnly?: boolean
  tabletOnly?: boolean
}

const TABS: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: ChartBar },
  { id: 'vault', label: 'Vault', icon: Vault },
  { id: 'chat', label: 'Chat', icon: ChatCircle, tabletOnly: true },
  { id: 'herald', label: 'Herald', icon: Broadcast, adminOnly: true },
  { id: 'squad', label: 'Squad', icon: UsersThree, adminOnly: true },
]

export default function Header() {
  const { publicKey, connected } = useWallet()
  const { setVisible } = useWalletModal()
  const { isAuthenticated, authenticate, isAdmin } = useAuth()
  const activeView = useAppStore((s) => s.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)

  const visibleTabs = TABS.filter((t) => {
    if (t.adminOnly && !isAdmin) return false
    return true
  })

  return (
    <header className="hidden md:flex h-12 border-b border-border items-center justify-between px-4 bg-bg shrink-0 z-10">
      <div className="flex items-center gap-1">
        <span className="font-semibold text-[13px] tracking-widest uppercase text-text mr-4">
          Sipher
        </span>
        <nav className="flex items-center">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon
            const active = activeView === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors',
                  tab.tabletOnly ? 'lg:hidden' : '',
                  active ? 'text-text bg-elevated' : 'text-text-muted hover:text-text-secondary',
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
        <div className="flex items-center gap-1.5">
          <AgentDot agent="sipher" size={5} />
          <AgentDot agent="herald" size={5} />
          <AgentDot agent="sentinel" size={5} />
        </div>

        <span className="text-[10px] font-mono text-text-muted bg-elevated px-1.5 py-0.5 rounded">
          {NETWORK === 'mainnet-beta' ? 'mainnet' : 'devnet'}
        </span>

        {connected && publicKey ? (
          <button
            onClick={isAuthenticated ? undefined : authenticate}
            className="flex items-center gap-2 bg-card border border-border px-2.5 py-1 rounded-lg hover:bg-elevated transition-colors"
          >
            <span className="text-[11px] font-mono text-text-secondary">
              {truncateAddress(publicKey.toBase58())}
            </span>
            <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
              <span className="text-[9px] font-bold text-white">
                {publicKey.toBase58()[0]}
              </span>
            </div>
          </button>
        ) : (
          <button
            onClick={() => setVisible(true)}
            className="bg-accent/10 border border-accent/20 px-3 py-1 rounded-lg text-[11px] text-accent font-medium hover:bg-accent/20 transition-colors"
          >
            Connect
          </button>
        )}
      </div>
    </header>
  )
}
