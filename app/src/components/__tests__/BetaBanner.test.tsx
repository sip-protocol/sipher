import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { View } from '../../stores/app'

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
    sessionStorage.clear()
    activeViewValue = 'dashboard'
    networkValue = 'devnet'
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

  it('is dismissible via button, hides for the rest of the session', () => {
    render(<BetaBanner beta={true} />)
    expect(screen.getByText(/DEVNET BETA/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/DEVNET BETA/i)).not.toBeInTheDocument()
  })

  it('respects sessionStorage dismissal across re-renders', () => {
    sessionStorage.setItem('sipher.beta-banner.dismissed', 'true')
    render(<BetaBanner beta={true} />)
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
