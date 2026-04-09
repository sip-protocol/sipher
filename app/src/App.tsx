import { useState, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import '@solana/wallet-adapter-react-ui/styles.css'
import './styles/theme.css'

import Header from './components/Header'
import BottomNav from './components/BottomNav'
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
  const wallets = useMemo(() => [new PhantomWalletAdapter()], [])
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
              <div className="text-[#71717A] text-sm text-center py-20">
                {activeView === 'stream' && `Activity Stream — ${events.length} events`}
                {activeView === 'vault' && 'Vault — coming in Task 6'}
                {activeView === 'herald' && 'HERALD — coming in Task 7'}
                {activeView === 'squad' && 'Squad — coming in Task 8'}
              </div>
            </main>
            <div className="shrink-0 bg-[#0A0A0B] border-t border-[#1E1E22] pb-[env(safe-area-inset-bottom)]">
              <div className="px-4 py-3">
                <div className="bg-[#141416] border border-[#1E1E22] rounded-lg flex items-center px-3 py-2 cursor-text">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-[#71717A] text-[13px]">Talk to SIPHER...</span>
                  </div>
                  <div className="border border-[#1E1E22] bg-[#0A0A0B] px-1.5 py-[1px] rounded text-[10px] text-[#71717A] font-mono">⌘K</div>
                </div>
              </div>
              <BottomNav active={activeView} onChange={setActiveView} />
            </div>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
