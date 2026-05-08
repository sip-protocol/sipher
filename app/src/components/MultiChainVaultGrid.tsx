import { useEffect, useState } from 'react'
import { Card } from './ui/Card'
import { Pill } from './ui/Pill'
import { apiFetch } from '../api/client'

export interface ChainRow {
  chainId: string
  network: 'mainnet' | 'devnet' | 'testnet'
  programId: string
  vaultPda: string | null
  tvlSol: number
  feeBps: number
  status: 'live' | 'pending'
  rpcLatencyMs: number | null
}

function formatChainName(chainId: string): string {
  return chainId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function MultiChainVaultGrid() {
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

  return (
    <Card variant="default" className="p-6">
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-2xs text-text-muted"
          style={{ letterSpacing: 'var(--tracking-widest)' }}
        >
          MULTI-CHAIN VAULTS
        </span>
        <span className="text-xs text-text-muted">
          {chains.length} {chains.length === 1 ? 'chain' : 'chains'}
        </span>
      </div>
      {error && (
        <div className="text-sm text-danger py-4">{error}</div>
      )}
      {!error && chains.length === 0 && (
        <div className="text-sm text-text-muted py-4">Loading chains…</div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {chains.map((c) => (
          <div
            key={c.chainId}
            className="p-3 bg-glass-1 rounded-md border border-line"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-text-secondary">{formatChainName(c.chainId)}</span>
              <Pill label={c.status.toUpperCase()} size="sm" active={c.status === 'live'} />
            </div>
            <div className="font-mono text-sm text-text">
              {c.tvlSol.toLocaleString(undefined, { maximumFractionDigits: 2 })} SOL
            </div>
            <div className="text-2xs text-text-muted">fee {c.feeBps} bps</div>
          </div>
        ))}
      </div>
    </Card>
  )
}
