import { useEffect, useMemo } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'

import Header from './components/Header'
import BottomNav from './components/BottomNav'
import { Footer } from './components/Footer'
import ChatSidebar from './components/ChatSidebar'
import { BetaBanner } from './components/BetaBanner'
import { NetworkBanner } from './components/NetworkBanner'
import { Sheet } from './components/ui/Sheet'
import DashboardView from './views/DashboardView'
import DemoView from './views/DemoView'
import VaultView from './views/VaultView'
import DepositView from './views/DepositView'
import WithdrawView from './views/WithdrawView'
import HeraldView from './views/HeraldView'
import SquadView from './views/SquadView'
import PrivacyReportView from './views/PrivacyReportView'
import ChainsView from './views/ChainsView'
import KeysView from './views/KeysView'
import SettingsView from './views/SettingsView'
import ChatView from './views/ChatView'
import NotFoundView from './views/NotFoundView'
import AboutView from './views/AboutView'
import { useAppStore } from './stores/app'
import { useAuth } from './hooks/useAuth'
import { useSSE } from './hooks/useSSE'
import { useNetworkConfigStore, fetchNetworkConfig } from './lib/networkConfig'
import { ToastProvider } from './providers/ToastProvider'
import { AuthSyncProvider } from './providers/AuthSyncProvider'

// Exact-match set of routes where authed-only nav chrome (Header tabs,
// BottomNav, Ask-SIPHER chat sheet trigger) is suppressed. Using a Set
// instead of `pathname.startsWith('/demo')` so future neighbour routes
// like `/demo-foo` or `/demothing` don't accidentally inherit the hide
// treatment.
const HIDE_CHROME_PATHS = new Set(['/demo'])

function AppShell() {
  const chatSheetOpen = useAppStore((s) => s.chatSheetOpen)
  const setChatSheetOpen = useAppStore((s) => s.setChatSheetOpen)
  const { token } = useAuth()
  const { events } = useSSE()
  const beta = useNetworkConfigStore((s) => s.config?.beta ?? false)
  // On /demo we strip the authed-only nav chrome so the read-only preview
  // stays focused and visitors cannot navigate into routes that require a
  // JWT. The BetaBanner + NetworkBanner stay visible because they
  // communicate network identity, which is also material to the demo.
  const location = useLocation()
  const hideChrome = HIDE_CHROME_PATHS.has(location.pathname)

  return (
    <div className="flex flex-col h-dvh bg-bg">
      <BetaBanner beta={beta} />
      <NetworkBanner />
      {!hideChrome && <Header />}

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <Routes>
            <Route path="/" element={<DashboardView events={events} />} />
            <Route path="/demo" element={<DemoView />} />
            <Route path="/vault" element={<VaultView />} />
            <Route path="/vault/deposit" element={<DepositView />} />
            <Route path="/vault/withdraw" element={<WithdrawView />} />
            <Route path="/chains" element={<ChainsView />} />
            <Route path="/keys" element={<KeysView />} />
            <Route path="/chat" element={<ChatView />} />
            <Route path="/herald" element={<HeraldView token={token} />} />
            <Route path="/sentinel" element={<SquadView token={token} />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/privacy-report" element={<PrivacyReportView />} />
            <Route path="/about" element={<AboutView />} />
            <Route path="*" element={<NotFoundView />} />
          </Routes>
        </main>
      </div>

      {!hideChrome && <BottomNav />}
      <Footer />

      {!hideChrome && (
        <Sheet
          open={chatSheetOpen}
          onClose={() => setChatSheetOpen(false)}
          ariaLabel="Ask SIPHER"
        >
          <ChatSidebar />
        </Sheet>
      )}
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
    <BrowserRouter>
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
    </BrowserRouter>
  )
}
