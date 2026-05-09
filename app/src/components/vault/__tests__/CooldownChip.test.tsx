import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { CooldownChip } from '../CooldownChip'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-08T00:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CooldownChip', () => {
  it('renders Available now when refundableAt is in the past', () => {
    const past = Math.floor(Date.now() / 1000) - 60
    render(<CooldownChip refundableAt={past} />)
    expect(screen.getByText(/available now/i)).toBeInTheDocument()
  })

  it('renders countdown copy in mm:ss when within 1h', () => {
    const future = Math.floor(Date.now() / 1000) + 600
    render(<CooldownChip refundableAt={future} />)
    expect(screen.getByText(/10:00|10m/i)).toBeInTheDocument()
  })

  it('renders countdown copy in Xh Ym when >=1h', () => {
    const future = Math.floor(Date.now() / 1000) + 5 * 3600
    render(<CooldownChip refundableAt={future} />)
    expect(screen.getByText(/5h/)).toBeInTheDocument()
  })

  it('flips to Available now when timer ticks past zero', () => {
    const future = Math.floor(Date.now() / 1000) + 2
    const onElapsed = vi.fn()
    render(<CooldownChip refundableAt={future} onElapsed={onElapsed} />)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByText(/available now/i)).toBeInTheDocument()
    expect(onElapsed).toHaveBeenCalled()
  })
})
