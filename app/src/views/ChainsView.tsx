import { useEffect, useState } from 'react'
import { Card } from '../components/ui/Card'
import { Pill } from '../components/ui/Pill'
import { HashCell } from '../components/ui/HashCell'
import { apiFetch } from '../api/client'
import type { ChainRow } from '../components/MultiChainVaultGrid'

function formatChainName(chainId: string): string {
  return chainId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatNetworkBadge(network: ChainRow['network']): string {
  return network.toUpperCase()
}

export default function ChainsView() {
  const [chains, setChains] = useState<ChainRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    apiFetch<{ chains: ChainRow[] }>('/api/chains', { signal: controller.signal })
      .then((j) => setChains(j.chains))
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to load chains')
      })
    return () => controller.abort()
  }, [])

  const liveCount = chains.filter((c) => c.status === 'live').length
  const totalTvl = chains.reduce((sum, c) => sum + c.tvlSol, 0)

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <title>SIPHER — Chains</title>
      <meta name="description" content="Multi-chain support spanning 9+ blockchains including Solana, Ethereum, and L2s." />
      <meta property="og:title" content="SIPHER — Chains" />
      <meta property="og:description" content="Multi-chain support spanning 9+ blockchains including Solana, Ethereum, and L2s." />
      <meta property="og:type" content="website" />
      <meta property="og:image" content="/icons/sipher.svg" />
      <div>
        <h1 className="text-3xl text-text font-semibold">Chains</h1>
        <p className="text-base text-text-muted mt-1">
          Per-chain SIP vault deployment status. {liveCount} of {chains.length} chains live · {totalTvl.toFixed(2)} SOL aggregate TVL.
        </p>
      </div>

      {error && (
        <Card variant="default" className="p-4 text-sm text-danger">
          {error}
        </Card>
      )}

      {!error && (
        <Card variant="default" className="p-6 overflow-x-auto">
          <table className="w-full text-xs">
            <thead
              className="text-2xs text-text-muted"
              style={{ letterSpacing: 'var(--tracking-wider)' }}
            >
              <tr>
                <th className="text-left font-medium pb-3">CHAIN</th>
                <th className="text-left font-medium pb-3">NETWORK</th>
                <th className="text-left font-medium pb-3">STATUS</th>
                <th className="text-right font-medium pb-3">TVL</th>
                <th className="text-right font-medium pb-3">FEE</th>
                <th className="text-left font-medium pb-3 pl-6">PROGRAM ID</th>
              </tr>
            </thead>
            <tbody>
              {chains.length === 0 && !error && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-muted text-sm">
                    Loading chains…
                  </td>
                </tr>
              )}
              {chains.map((c) => (
                <tr key={c.chainId} className="border-t border-line">
                  <td className="py-3 text-text">{formatChainName(c.chainId)}</td>
                  <td className="py-3 text-text-secondary font-mono">{formatNetworkBadge(c.network)}</td>
                  <td className="py-3">
                    <Pill label={c.status.toUpperCase()} size="sm" active={c.status === 'live'} />
                  </td>
                  <td className="py-3 text-right font-mono text-text">
                    {c.tvlSol.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 text-right text-text-secondary">{c.feeBps} bps</td>
                  <td className="py-3 pl-6">
                    {c.programId ? (
                      <HashCell hash={c.programId} headChars={6} tailChars={6} />
                    ) : (
                      <span className="text-text-muted font-mono">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
