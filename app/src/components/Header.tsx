import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { truncateAddress } from '../lib/format'

export default function Header({ onAuth, isAuthenticated }: { onAuth: () => void, isAuthenticated: boolean }) {
  const { publicKey, connected } = useWallet()
  const { setVisible } = useWalletModal()

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-bg z-10">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-[13px] tracking-widest uppercase text-text">Sipher</span>
      </div>
      {connected && publicKey ? (
        <button
          onClick={isAuthenticated ? undefined : onAuth}
          className="flex items-center gap-2.5 bg-card border border-border px-3 py-1.5 rounded-lg transition-colors hover:bg-[#1A1A1D]"
        >
          <div className={`w-1.5 h-1.5 rounded-full ${isAuthenticated ? 'bg-sipher' : 'bg-text-secondary'}`} />
          <span className="text-[12px] font-mono text-text">{truncateAddress(publicKey.toBase58())}</span>
        </button>
      ) : (
        <button
          onClick={() => setVisible(true)}
          className="bg-card border border-border px-3 py-1.5 rounded-lg text-[12px] text-text hover:bg-[#1A1A1D]"
        >
          Connect Wallet
        </button>
      )}
    </header>
  )
}
