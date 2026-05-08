import { useState } from 'react'
import {
  ChartBar,
  Vault,
  ChatCircle,
  DotsThree,
  Broadcast,
  UsersThree,
  SignOut,
} from '@phosphor-icons/react'
import { useAppStore, type View } from '../stores/app'
import { useAuthState } from '../hooks/useAuthState'
import { useToast } from '../providers/ToastProvider'

interface TabDef {
  id: View
  label: string
  icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'fill' }>
}

const TABS: TabDef[] = [
  { id: 'dashboard', label: 'Home', icon: ChartBar },
  { id: 'vault', label: 'Vault', icon: Vault },
  { id: 'chat', label: 'Chat', icon: ChatCircle },
]

export default function BottomNav() {
  const activeView = useAppStore((s) => s.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const { isAdmin, disconnect } = useAuthState()
  const { show: showToast } = useToast()
  const [moreOpen, setMoreOpen] = useState(false)

  const handleDisconnect = async () => {
    setMoreOpen(false)
    await disconnect()
    showToast({ message: 'Disconnected', kind: 'info', durationMs: 3000 })
  }

  return (
    <>
      <nav className="flex md:hidden border-t border-line bg-bg pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active =
            activeView === tab.id ||
            (tab.id === 'vault' && activeView === 'deposit')
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors ${
                active ? 'text-text' : 'text-text-muted'
              }`}
            >
              <Icon size={20} weight={active ? 'fill' : 'regular'} />
              <span className="text-2xs font-medium tracking-wide">{tab.label}</span>
            </button>
          )
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors ${
            moreOpen ? 'text-text' : 'text-text-muted'
          }`}
        >
          <DotsThree size={20} weight="bold" />
          <span className="text-2xs font-medium tracking-wide">More</span>
        </button>
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-modal bg-black/60 md:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="glass-strong absolute bottom-0 inset-x-0 rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-8 h-1 bg-line-2 rounded-full mx-auto mb-4" />
            <div className="flex flex-col gap-1">
              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setActiveView('herald')
                      setMoreOpen(false)
                    }}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-text-secondary hover:bg-glass-2 transition-colors"
                  >
                    <Broadcast size={20} />
                    <span className="text-sm font-medium">Herald</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveView('squad')
                      setMoreOpen(false)
                    }}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-text-secondary hover:bg-glass-2 transition-colors"
                  >
                    <UsersThree size={20} />
                    <span className="text-sm font-medium">Squad</span>
                  </button>
                  <div className="border-t border-line my-1" />
                </>
              )}
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-danger hover:bg-danger-soft transition-colors"
              >
                <SignOut size={20} />
                <span className="text-sm font-medium">Disconnect Wallet</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
