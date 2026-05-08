import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Sheet } from '../Sheet'

describe('Sheet', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
  })

  it('renders children when open', () => {
    render(<Sheet open onClose={() => {}}><span>chat content</span></Sheet>)
    expect(screen.getByText('chat content')).toBeInTheDocument()
  })

  it('does not render children when closed', () => {
    render(<Sheet open={false} onClose={() => {}}><span>chat content</span></Sheet>)
    expect(screen.queryByText('chat content')).not.toBeInTheDocument()
  })

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn()
    render(<Sheet open onClose={onClose}><span>x</span></Sheet>)
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Escape key pressed', () => {
    const onClose = vi.fn()
    render(<Sheet open onClose={onClose}><span>x</span></Sheet>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('does not register Escape listener when closed', () => {
    const onClose = vi.fn()
    render(<Sheet open={false} onClose={onClose}><span>x</span></Sheet>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('uses dialog role with aria-modal=true', () => {
    render(<Sheet open onClose={() => {}}><span>x</span></Sheet>)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('exposes a label via aria-label', () => {
    render(<Sheet open onClose={() => {}} ariaLabel="Ask SIPHER"><span>x</span></Sheet>)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Ask SIPHER')
  })

  it('locks body scroll when open and restores it on unmount', () => {
    const { unmount } = render(<Sheet open onClose={() => {}}><span>x</span></Sheet>)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('focuses the dialog on open', () => {
    render(<Sheet open onClose={() => {}}><span>x</span></Sheet>)
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
  })
})
