import { useEffect, useState } from 'react'
import { Card } from './ui/Card'
import { JargonTerm } from './ui/JargonTerm'
import { NodeGraph, type GraphNode, type GraphEdge } from './ui/NodeGraph'
import { apiFetch } from '../api/client'
import { useAuthState } from '../hooks/useAuthState'
import { useOnAuthClear } from '../store/useOnAuthClear'

interface StealthNode {
  index: number
  derivationPath: string
  stealthAddress: string
  parentIndex: number | null
  createdAt: string
}

export function PrivacyGraph() {
  const { token } = useAuthState()
  const [tree, setTree] = useState<StealthNode[]>([])
  const [loading, setLoading] = useState<boolean>(Boolean(token))

  useOnAuthClear(() => {
    setTree([])
    setLoading(false)
  })

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    apiFetch<{ tree: StealthNode[]; rootWallet: string }>('/api/stealth/index', {
      token,
      signal: controller.signal,
    })
      .then((j) => {
        if (controller.signal.aborted) return
        setTree(j.tree)
        setLoading(false)
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setTree([])
        setLoading(false)
      })
    return () => controller.abort()
  }, [token])

  const nodes: GraphNode[] = tree.map((n, i) => ({
    id: String(n.index),
    label: `#${n.index}`,
    x: i * 140,
    y: n.parentIndex == null ? 200 : 100,
    isRoot: n.parentIndex == null,
  }))
  const edges: GraphEdge[] = tree
    .filter((n) => n.parentIndex != null)
    .map((n) => ({ source: String(n.parentIndex), target: String(n.index) }))

  return (
    <Card variant="default" sheen className="p-6">
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-2xs text-text-muted inline-flex items-center gap-1"
          style={{ letterSpacing: 'var(--tracking-widest)' }}
        >
          PRIVACY GRAPH ·{' '}
          <JargonTerm term="Stealth Address Tree">STEALTH ADDRESS TREE</JargonTerm>
        </span>
        <span className="text-xs text-text-muted">
          {tree.length} {tree.length === 1 ? 'address' : 'addresses'}
        </span>
      </div>
      {loading ? (
        <div
          data-testid="privacy-graph-skeleton"
          aria-busy="true"
          aria-label="Loading privacy graph"
          className="h-[400px] animate-pulse flex flex-col items-center justify-center text-center px-6 gap-3"
        >
          <div className="h-3 bg-text/10 rounded w-1/3" />
          <div className="h-3 bg-text/10 rounded w-2/3" />
          <div className="h-3 bg-text/10 rounded w-1/2" />
        </div>
      ) : tree.length === 0 ? (
        <div
          data-testid="privacy-graph-empty"
          className="h-[400px] flex flex-col items-center justify-center text-center px-6"
        >
          <p className="text-sm text-text-secondary">
            Each node is a one-time stealth address.
          </p>
          <p className="text-xs text-text-muted mt-1">
            Connect a wallet and send/receive shielded payments to populate.
          </p>
        </div>
      ) : (
        <NodeGraph nodes={nodes} edges={edges} />
      )}
    </Card>
  )
}
