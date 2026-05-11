import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

type NetworkConfig = {
  network: 'devnet' | 'mainnet'
  vaultConfig: string
} | null

let networkConfigValue: NetworkConfig = {
  network: 'devnet',
  vaultConfig: 'CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u',
}

vi.mock('../../../lib/networkConfig', () => ({
  useNetworkConfigStore: <T,>(selector: (s: { config: NetworkConfig }) => T) =>
    selector({ config: networkConfigValue }),
}))

import { RoutePreviewCard } from '../RoutePreviewCard'

beforeEach(() => {
  networkConfigValue = {
    network: 'devnet',
    vaultConfig: 'CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u',
  }
})

describe('RoutePreviewCard', () => {
  it('renders 3 numbered steps', () => {
    render(
      <RoutePreviewCard
        wallet="C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N"
        amount={1.5}
        asset="SOL"
      />
    )
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders You / Vault PDA / Stealth labels', () => {
    render(<RoutePreviewCard wallet="C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N" />)
    expect(screen.getByText(/You/)).toBeInTheDocument()
    expect(screen.getByText(/Vault PDA/)).toBeInTheDocument()
    expect(screen.getByText(/Stealth/)).toBeInTheDocument()
  })

  it('renders placeholder dashes when amount is 0', () => {
    render(
      <RoutePreviewCard
        wallet="C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N"
        amount={0}
        asset="SOL"
      />
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('wraps Vault PDA label in JargonTerm tooltip', () => {
    render(<RoutePreviewCard wallet="C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N" />)
    const trigger = screen.getByText(/Vault PDA/).closest('button')
    expect(trigger).not.toBeNull()
    fireEvent.mouseEnter(trigger!)
    expect(screen.getByRole('tooltip')).toHaveTextContent(/program-derived address/i)
  })

  it('renders em-dash placeholder when wallet is empty (no unlabelled Copy button)', () => {
    const { container } = render(<RoutePreviewCard wallet="" />)
    // No focusable HashCell button with empty aria-label
    expect(container.querySelector('button[aria-label="Copy "]')).toBeNull()
    // Vault PDA HashCell is still rendered (derived from network config)
    expect(
      container.querySelector('button[aria-label*="CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u"]'),
    ).not.toBeNull()
  })

  it('renders "Vault on mainnet coming soon" when network is mainnet', () => {
    networkConfigValue = { network: 'mainnet', vaultConfig: '' }
    render(<RoutePreviewCard wallet="C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N" />)
    expect(screen.getByText(/Vault on mainnet coming soon/i)).toBeInTheDocument()
    expect(screen.queryByText(/Vault PDA/)).toBeNull()
  })

  it('uses vaultConfig from the network store when on devnet', () => {
    networkConfigValue = {
      network: 'devnet',
      vaultConfig: 'D3vN3tVaultPDA111111111111111111111111111111',
    }
    const { container } = render(
      <RoutePreviewCard wallet="C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N" />,
    )
    // The derived PDA from the store appears in the rendered HashCell
    expect(
      container.querySelector(
        'button[aria-label*="D3vN3tVaultPDA111111111111111111111111111111"]',
      ),
    ).not.toBeNull()
    // Mainnet copy must NOT render on devnet
    expect(screen.queryByText(/Vault on mainnet/i)).toBeNull()
  })
})
