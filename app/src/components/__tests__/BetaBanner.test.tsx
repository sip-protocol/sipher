import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { View } from '../../stores/app'

const DISMISS_KEY = 'sipher.devnet-banner.dismissed-until'
const COOLDOWN_MS = 24 * 60 * 60 * 1000

let activeViewValue: View | null = 'dashboard'
let networkValue: string = 'devnet'

vi.mock('../../hooks/useActiveView', () => ({
  useActiveView: () => activeViewValue,
}))

vi.mock('../../lib/networkConfig', () => ({
  useNetworkConfigStore: <T,>(selector: (s: { config: { network: string } | null }) => T) =>
    selector({ config: { network: networkValue } }),
}))

import { BetaBanner } from '../BetaBanner'

describe('BetaBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    activeViewValue = 'dashboard'
    networkValue = 'devnet'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders when beta=true', () => {
    render(<BetaBanner beta={true} />)
    expect(screen.getByText(/DEVNET BETA/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /devnet sol/i })).toHaveAttribute(
      'href',
      'https://faucet.solana.com',
    )
  })

  it('renders nothing when beta=false', () => {
    const { container } = render(<BetaBanner beta={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('is dismissible via button, hides immediately', () => {
    render(<BetaBanner beta={true} />)
    expect(screen.getByText(/DEVNET BETA/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/DEVNET BETA/i)).not.toBeInTheDocument()
  })

  it('shows vault-devnet warning on mainnet vault view, even when beta=false', () => {
    activeViewValue = 'vault'
    networkValue = 'mainnet'
    render(<BetaBanner beta={false} />)
    expect(screen.getByText(/Sipher Vault is on devnet only/i)).toBeInTheDocument()
  })

  it('shows vault-devnet warning on mainnet deposit view', () => {
    activeViewValue = 'deposit'
    networkValue = 'mainnet'
    render(<BetaBanner beta={false} />)
    expect(screen.getByText(/Sipher Vault is on devnet only/i)).toBeInTheDocument()
  })

  it('shows vault-devnet warning on mainnet withdraw view', () => {
    activeViewValue = 'withdraw'
    networkValue = 'mainnet'
    render(<BetaBanner beta={false} />)
    expect(screen.getByText(/Sipher Vault is on devnet only/i)).toBeInTheDocument()
  })

  it('vault-devnet warning is not dismissible (no dismiss button)', () => {
    activeViewValue = 'vault'
    networkValue = 'mainnet'
    render(<BetaBanner beta={true} />)
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument()
  })

  it('does not show vault-devnet warning on mainnet dashboard view', () => {
    activeViewValue = 'dashboard'
    networkValue = 'mainnet'
    const { container } = render(<BetaBanner beta={false} />)
    expect(screen.queryByText(/Sipher Vault is on devnet only/i)).not.toBeInTheDocument()
    expect(container.firstChild).toBeNull()
  })

  it('does not show vault-devnet warning on devnet vault view', () => {
    activeViewValue = 'vault'
    networkValue = 'devnet'
    render(<BetaBanner beta={false} />)
    expect(screen.queryByText(/Sipher Vault is on devnet only/i)).not.toBeInTheDocument()
  })

  it('does not show vault-devnet warning on unmatched paths (activeView=null)', () => {
    activeViewValue = null
    networkValue = 'mainnet'
    render(<BetaBanner beta={false} />)
    expect(screen.queryByText(/Sipher Vault is on devnet only/i)).not.toBeInTheDocument()
  })
})

describe('BetaBanner — 24h localStorage cooldown', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    activeViewValue = 'dashboard'
    networkValue = 'devnet'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not render when dismissed-until timestamp is in the future', () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 60_000))
    render(<BetaBanner beta={true} />)
    expect(screen.queryByText(/DEVNET BETA/i)).not.toBeInTheDocument()
  })

  it('renders when dismissed-until timestamp is in the past', () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() - 60_000))
    render(<BetaBanner beta={true} />)
    expect(screen.getByText(/DEVNET BETA/i)).toBeInTheDocument()
  })

  it('sets dismissed-until to ~24h from now on dismiss click', () => {
    const fixedNow = 1_700_000_000_000
    vi.useFakeTimers()
    vi.setSystemTime(fixedNow)

    render(<BetaBanner beta={true} />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))

    const stored = Number(localStorage.getItem(DISMISS_KEY))
    expect(stored).toBe(fixedNow + COOLDOWN_MS)
  })

  it('does not write to the old sessionStorage key after dismiss', () => {
    render(<BetaBanner beta={true} />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(sessionStorage.getItem('sipher.beta-banner.dismissed')).toBeNull()
  })

  it('ignores stale sessionStorage entries from the old dismissal scheme', () => {
    sessionStorage.setItem('sipher.beta-banner.dismissed', 'true')
    render(<BetaBanner beta={true} />)
    // Migration: legacy sessionStorage key must not gate the banner anymore.
    expect(screen.getByText(/DEVNET BETA/i)).toBeInTheDocument()
  })

  it('treats malformed timestamp values as not-dismissed', () => {
    localStorage.setItem(DISMISS_KEY, 'not-a-number')
    render(<BetaBanner beta={true} />)
    expect(screen.getByText(/DEVNET BETA/i)).toBeInTheDocument()
  })
})
