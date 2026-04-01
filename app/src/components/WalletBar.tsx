import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useEffect, useState } from 'react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

interface WalletBarProps {
  network: 'devnet' | 'mainnet-beta'
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

export default function WalletBar({ network }: WalletBarProps) {
  const { publicKey, connected } = useWallet()
  const { connection } = useConnection()
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    if (!publicKey || !connected) {
      setBalance(null)
      return
    }

    let cancelled = false

    async function fetchBalance() {
      try {
        const lamports = await connection.getBalance(publicKey!)
        if (!cancelled) {
          setBalance(lamports / LAMPORTS_PER_SOL)
        }
      } catch {
        if (!cancelled) setBalance(null)
      }
    }

    fetchBalance()
    const interval = setInterval(fetchBalance, 15_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [publicKey, connected, connection])

  const networkLabel = network === 'devnet' ? 'devnet' : 'mainnet'

  return (
    <div className="wallet-bar">
      <div className="wallet-bar__brand">
        SIPHER
        <span>Privacy Agent</span>
      </div>

      <div className="wallet-bar__info">
        <span className={`wallet-bar__network wallet-bar__network--${networkLabel}`}>
          {networkLabel}
        </span>

        {connected && publicKey && (
          <span className="wallet-bar__balance">
            {balance !== null ? (
              <>
                <strong>{balance.toFixed(4)}</strong> SOL
              </>
            ) : (
              truncateAddress(publicKey.toBase58())
            )}
          </span>
        )}

        <WalletMultiButton />
      </div>
    </div>
  )
}
