import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ToolTimeline from '../ToolTimeline'
import type { ToolCall } from '../../stores/app'

describe('ToolTimeline', () => {
  it('renders nothing when tools is undefined', () => {
    const { container } = render(<ToolTimeline tools={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when tools is empty array', () => {
    const { container } = render(<ToolTimeline tools={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders single running tool', () => {
    const tools: ToolCall[] = [
      { name: 'privacyScore', args: 'wallet=FGSk...8WWr', startedAt: Date.now(), status: 'running' },
    ]
    render(<ToolTimeline tools={tools} />)
    expect(screen.getByText('privacyScore')).toBeInTheDocument()
    expect(screen.getByText(/wallet=FGSk\.\.\.8WWr/)).toBeInTheDocument()
  })

  it('renders completed tool with duration', () => {
    const tools: ToolCall[] = [
      { name: 'privacyScore', args: 'wallet=FGSk...8WWr', startedAt: 0, durationMs: 285, status: 'success' },
    ]
    render(<ToolTimeline tools={tools} />)
    expect(screen.getByText(/285ms/)).toBeInTheDocument()
  })

  it('renders multi-tool timeline', () => {
    const tools: ToolCall[] = [
      { name: 'privacyScore', startedAt: 0, durationMs: 285, status: 'success' },
      { name: 'history', startedAt: 0, durationMs: 120, status: 'success' },
      { name: 'balance', startedAt: 0, durationMs: 45, status: 'error' },
    ]
    render(<ToolTimeline tools={tools} />)
    expect(screen.getByText('privacyScore')).toBeInTheDocument()
    expect(screen.getByText('history')).toBeInTheDocument()
    expect(screen.getByText('balance')).toBeInTheDocument()
  })
})
