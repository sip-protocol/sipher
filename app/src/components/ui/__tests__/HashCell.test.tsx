import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HashCell } from '../HashCell'

describe('HashCell', () => {
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard')
  })

  it('truncates a long hash to first4...last4 by default', () => {
    render(<HashCell hash="0x1234567890abcdef1234567890abcdef" />)
    expect(screen.getByText('0x12…cdef')).toBeInTheDocument()
  })

  it('respects a custom truncate length', () => {
    render(<HashCell hash="0x1234567890abcdef1234567890abcdef" headChars={6} tailChars={6} />)
    expect(screen.getByText('0x1234…abcdef')).toBeInTheDocument()
  })

  it('shows full hash when shorter than truncate boundary', () => {
    render(<HashCell hash="0x1234" />)
    expect(screen.getByText('0x1234')).toBeInTheDocument()
  })

  it('copies to clipboard on click', () => {
    render(<HashCell hash="0xabcdef" />)
    fireEvent.click(screen.getByRole('button'))
    expect(writeText).toHaveBeenCalledWith('0xabcdef')
  })

  it('exposes the full hash via title attribute', () => {
    render(<HashCell hash="0xabcdef1234567890" />)
    expect(screen.getByRole('button')).toHaveAttribute('title', '0xabcdef1234567890')
  })

  it('exposes a default copy aria-label for screen readers', () => {
    render(<HashCell hash="0xabcdef1234567890" />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Copy 0xabcdef1234567890')
  })

  it('lets caller override aria-label', () => {
    render(<HashCell hash="0xabcdef" aria-label="Stealth address" />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Stealth address')
  })

  it('warns to console on clipboard write failure (does not throw)', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<HashCell hash="0xff" />)
    fireEvent.click(screen.getByRole('button'))
    await Promise.resolve()
    expect(warn).toHaveBeenCalledWith('[HashCell] clipboard write failed', expect.any(Error))
    warn.mockRestore()
  })
})
