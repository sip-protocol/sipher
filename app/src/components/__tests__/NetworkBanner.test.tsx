import { describe, it, expect } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { NetworkBanner } from '../NetworkBanner'

describe('NetworkBanner', () => {
  it('does not render anything by default', () => {
    render(<NetworkBanner />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('appears when sipher:network-error is dispatched', async () => {
    render(<NetworkBanner />)
    act(() => {
      window.dispatchEvent(new CustomEvent('sipher:network-error'))
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/network connection lost/i)).toBeInTheDocument()
    })
  })

  it('disappears when sipher:network-recovered is dispatched', async () => {
    render(<NetworkBanner />)
    act(() => {
      window.dispatchEvent(new CustomEvent('sipher:network-error'))
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    act(() => {
      window.dispatchEvent(new CustomEvent('sipher:network-recovered'))
    })
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
