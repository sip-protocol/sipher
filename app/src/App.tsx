import { useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import '@solana/wallet-adapter-react-ui/styles.css'
import './styles/theme.css'

import Header from './components/Header'
import BottomNav from './components/BottomNav'
import ChatSidebar from './components/ChatSidebar'
import DashboardView from './views/DashboardView'
import VaultView from './views/VaultView'
import HeraldView from './views/HeraldView'
import SquadView from './views/SquadView'
import { useAppStore } from './stores/app'
import { useAuth } from './hooks/useAuth'
import { useSSE } from './hooks/useSSE'

const NETWORK = (import.meta.env.VITE_SOLANA_NETWORK ?? 'mainnet-beta') as 'devnet' | 'mainnet-beta'
const ENDPOINTS: Record<string, string> = {
  devnet: 'https://api.devnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
}

function AppShell() {
  const activeView = useAppStore((s) => s.activeView)
  const { token, isAdmin } = useAuth()
  const { events } = useSSE(token)

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView events={events} token={token} />
      case 'vault':
        return <VaultView token={token} />
      case 'herald':
        return isAdmin ? <HeraldView token={token} /> : <DashboardView events={events} token={token} />
      case 'squad':
        return isAdmin ? <SquadView token={token} /> : <DashboardView events={events} token={token} />
      case 'chat':
        return (
          <div className="lg:hidden h-full">
            <ChatSidebar fullScreen />
          </div>
        )
      default:
        return <DashboardView events={events} token={token} />
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-bg">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          {renderView()}
        </main>

        {/* Desktop persistent chat sidebar */}
        <aside className="hidden lg:flex w-[300px] border-l border-border shrink-0">
          <ChatSidebar />
        </aside>
      </div>

      <BottomNav />
    </div>
  )
}

export default function App() {
  const endpoint = import.meta.env.VITE_SOLANA_RPC_URL ?? ENDPOINTS[NETWORK]
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AppShell />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
