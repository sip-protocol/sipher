import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HashCell } from '../HashCell'

describe('HashCell', () => {
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
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<HashCell hash="0xabcdef" />)
    fireEvent.click(screen.getByRole('button'))
    expect(writeText).toHaveBeenCalledWith('0xabcdef')
  })

  it('exposes the full hash via title attribute', () => {
    render(<HashCell hash="0xabcdef1234567890" />)
    expect(screen.getByRole('button')).toHaveAttribute('title', '0xabcdef1234567890')
  })
})
