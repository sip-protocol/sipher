import { useMemo } from 'react'
import ReactFlow, { Background, Controls, type Node, type Edge } from 'reactflow'
import 'reactflow/dist/style.css'

export interface GraphNode {
  id: string
  label: string
  x: number
  y: number
  isRoot?: boolean
}

export interface GraphEdge {
  source: string
  target: string
}

interface NodeGraphProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  height?: number
}

export function NodeGraph({ nodes, edges, height = 400 }: NodeGraphProps) {
  const rfNodes: Node[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        position: { x: n.x, y: n.y },
        data: { label: n.label },
        style: {
          background: n.isRoot ? 'var(--color-cyan)' : 'var(--color-glass-2)',
          color: n.isRoot ? 'var(--color-text-inverse)' : 'var(--color-text)',
          border: '1px solid var(--color-line-accent)',
          borderRadius: 'var(--radius-pill)',
          padding: '8px 14px',
          fontSize: 11,
          boxShadow: n.isRoot ? 'var(--glow-cyan-md)' : 'var(--glow-accent-sm)',
        },
      })),
    [nodes],
  )

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((e, i) => ({
        id: `e${i}`,
        source: e.source,
        target: e.target,
        style: { stroke: 'var(--color-cyan-soft)', strokeWidth: 1.5 },
        animated: true,
      })),
    [edges],
  )

  return (
    <div data-testid="node-graph" style={{ width: '100%', height }}>
      <ReactFlow nodes={rfNodes} edges={rfEdges} fitView>
        <Background color="var(--color-line)" gap={24} />
        <Controls className="bg-bg-2 border border-line rounded-md" />
      </ReactFlow>
    </div>
  )
}
