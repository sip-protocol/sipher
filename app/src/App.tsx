import { useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import '@solana/wallet-adapter-react-ui/styles.css'
import './styles/theme.css'

import WalletBar from './components/WalletBar'
import ChatContainer from './components/ChatContainer'

const NETWORK = (import.meta.env.VITE_SOLANA_NETWORK ?? 'devnet') as 'devnet' | 'mainnet-beta'

const ENDPOINTS: Record<string, string> = {
  devnet: 'https://api.devnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
}

export default function App() {
  const endpoint = import.meta.env.VITE_SOLANA_RPC_URL ?? ENDPOINTS[NETWORK] ?? ENDPOINTS.devnet
  const wallets = useMemo(() => [new PhantomWalletAdapter()], [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="app-layout">
            <WalletBar network={NETWORK} />
            <ChatContainer />
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
