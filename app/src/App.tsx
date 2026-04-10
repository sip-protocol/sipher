import { useState, useMemo } from 'react'
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
import CommandBar from './components/CommandBar'
import StreamView from './views/StreamView'
import VaultView from './views/VaultView'
import HeraldView from './views/HeraldView'
import SquadView from './views/SquadView'
import { useAuth } from './hooks/useAuth'
import { useSSE } from './hooks/useSSE'

type View = 'stream' | 'vault' | 'herald' | 'squad'

const NETWORK = (import.meta.env.VITE_SOLANA_NETWORK ?? 'mainnet-beta') as 'devnet' | 'mainnet-beta'
const ENDPOINTS: Record<string, string> = {
  devnet: 'https://api.devnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
}

export default function App() {
  const endpoint = import.meta.env.VITE_SOLANA_RPC_URL ?? ENDPOINTS[NETWORK]
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], [])
  const [activeView, setActiveView] = useState<View>('stream')
  const { token, authenticate, isAuthenticated } = useAuth()
  const { events } = useSSE(token)

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="flex flex-col h-dvh bg-[#0A0A0B] max-w-[720px] mx-auto border-x border-[#1E1E22]">
            <Header onAuth={authenticate} isAuthenticated={isAuthenticated} />
            <main className="flex-1 overflow-y-auto px-4 py-5">
              {activeView === 'stream' && <StreamView events={events} token={token} />}
              {activeView === 'vault' && <VaultView token={token} />}
              {activeView === 'herald' && <HeraldView token={token} />}
              {activeView === 'squad' && <SquadView token={token} />}
            </main>
            <div className="shrink-0 bg-[#0A0A0B] border-t border-[#1E1E22] pb-[env(safe-area-inset-bottom)]">
              <CommandBar token={token} />
              <BottomNav active={activeView} onChange={setActiveView} />
            </div>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
