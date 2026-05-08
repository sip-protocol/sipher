import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NodeGraph, type GraphNode, type GraphEdge } from '../NodeGraph'

beforeAll(() => {
  // reactflow uses ResizeObserver; jsdom doesn't ship one.
  if (!('ResizeObserver' in globalThis)) {
    ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  // reactflow also pokes at DOMRect on layout; jsdom returns zeroes which is fine.
})

const nodes: GraphNode[] = [
  { id: '0', label: '#0', x: 0, y: 200, isRoot: true },
  { id: '1', label: '#1', x: 140, y: 100 },
]
const edges: GraphEdge[] = [{ source: '0', target: '1' }]

describe('NodeGraph', () => {
  it('renders a sized container around the react-flow instance', () => {
    render(<NodeGraph nodes={nodes} edges={edges} />)
    const container = screen.getByTestId('node-graph')
    expect(container).toBeInTheDocument()
    expect(container.style.width).toBe('100%')
    expect(container.style.height).toBe('400px')
  })

  it('respects a custom height prop', () => {
    render(<NodeGraph nodes={nodes} edges={edges} height={600} />)
    expect(screen.getByTestId('node-graph').style.height).toBe('600px')
  })

  it('renders empty graph without throwing', () => {
    expect(() => render(<NodeGraph nodes={[]} edges={[]} />)).not.toThrow()
  })
})
