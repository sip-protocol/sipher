import { useEffect, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'

import Header from './components/Header'
import BottomNav from './components/BottomNav'
import ChatSidebar from './components/ChatSidebar'
import { BetaBanner } from './components/BetaBanner'
import { Sheet } from './components/ui/Sheet'
import DashboardView from './views/DashboardView'
import VaultView from './views/VaultView'
import DepositView from './views/DepositView'
import WithdrawView from './views/WithdrawView'
import HeraldView from './views/HeraldView'
import SquadView from './views/SquadView'
import PrivacyReportView from './views/PrivacyReportView'
import ChainsView from './views/ChainsView'
import KeysView from './views/KeysView'
import SettingsView from './views/SettingsView'
import { useAppStore } from './stores/app'
import { useAuth } from './hooks/useAuth'
import { useSSE } from './hooks/useSSE'
import { useNetworkConfigStore, fetchNetworkConfig } from './lib/networkConfig'
import { ToastProvider } from './providers/ToastProvider'
import { AuthSyncProvider } from './providers/AuthSyncProvider'

function AppShell() {
  const activeView = useAppStore((s) => s.activeView)
  const chatSheetOpen = useAppStore((s) => s.chatSheetOpen)
  const setChatSheetOpen = useAppStore((s) => s.setChatSheetOpen)
  const { token, isAdmin } = useAuth()
  const { events } = useSSE()
  const beta = useNetworkConfigStore((s) => s.config?.beta ?? false)

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView events={events} />
      case 'vault':
        return <VaultView />
      case 'deposit':
        return <DepositView />
      case 'withdraw':
        return <WithdrawView />
      case 'herald':
        return isAdmin ? <HeraldView token={token} /> : <DashboardView events={events} />
      case 'squad':
        return isAdmin ? <SquadView token={token} /> : <DashboardView events={events} />
      case 'privacyReport':
        return <PrivacyReportView />
      case 'chains':
        return <ChainsView />
      case 'keys':
        return <KeysView />
      case 'settings':
        return isAdmin ? <SettingsView /> : <DashboardView events={events} />
      case 'chat':
        return (
          <div className="lg:hidden h-full">
            <ChatSidebar fullScreen />
          </div>
        )
      default:
        return <DashboardView events={events} />
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-bg">
      <BetaBanner beta={beta} />
      <Header />

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          {renderView()}
        </main>
      </div>

      <BottomNav />

      <Sheet
        open={chatSheetOpen}
        onClose={() => setChatSheetOpen(false)}
        ariaLabel="Ask SIPHER"
      >
        <ChatSidebar />
      </Sheet>
    </div>
  )
}

export default function App() {
  const config = useNetworkConfigStore((s) => s.config)
  const error = useNetworkConfigStore((s) => s.error)

  useEffect(() => {
    fetchNetworkConfig()
  }, [])

  // Wallet Standard auto-discovers Phantom, Solflare, and other
  // wallet-standard wallets the user has installed. Explicit adapter
  // instantiation has been deprecated since
  // @solana/wallet-adapter-wallets@0.19 and emits a console warning per
  // page load — clearing it here.
  const wallets = useMemo(() => [], [])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-text">
        <div className="max-w-md p-6 text-center">
          <h1 className="text-xl font-semibold mb-2">Sipher temporarily unavailable</h1>
          <p className="text-sm text-text-muted">{error}</p>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-text-muted">
        <p className="text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <ConnectionProvider endpoint={config.publicRpcUrl}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ToastProvider>
            <AuthSyncProvider>
              <AppShell />
            </AuthSyncProvider>
          </ToastProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
