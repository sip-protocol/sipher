import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MultiChainVaultGrid, type ChainRow } from '../MultiChainVaultGrid'

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
}))

import { apiFetch } from '../../api/client'

const fakeChains: ChainRow[] = [
  {
    chainId: 'solana-mainnet',
    network: 'mainnet',
    programId: 'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at',
    vaultPda: 'BVawZkppFewygA5nxdrLma4ThKx8Th7bW4KTCkcWTZwZ',
    tvlSol: 12.5,
    feeBps: 50,
    status: 'live',
    rpcLatencyMs: null,
  },
  {
    chainId: 'sepolia',
    network: 'testnet',
    programId: '0x1FED19684dC108304960db2818CF5a961d28405E',
    vaultPda: null,
    tvlSol: 0,
    feeBps: 50,
    status: 'live',
    rpcLatencyMs: null,
  },
  {
    chainId: 'blast-sepolia',
    network: 'testnet',
    programId: '',
    vaultPda: null,
    tvlSol: 0,
    feeBps: 50,
    status: 'pending',
    rpcLatencyMs: null,
  },
]

beforeEach(() => {
  ;(apiFetch as ReturnType<typeof vi.fn>).mockReset()
})

describe('MultiChainVaultGrid', () => {
  it('renders human-readable chain names from chainId', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ chains: fakeChains })
    render(<MultiChainVaultGrid />)
    await waitFor(() => expect(screen.getByText('Solana Mainnet')).toBeInTheDocument())
    expect(screen.getByText('Sepolia')).toBeInTheDocument()
    expect(screen.getByText('Blast Sepolia')).toBeInTheDocument()
  })

  it('marks live chains with the LIVE pill (active=true)', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ chains: fakeChains })
    render(<MultiChainVaultGrid />)
    await waitFor(() => {
      const livePills = screen.getAllByRole('button', { name: 'LIVE' })
      expect(livePills.length).toBe(2)
      livePills.forEach((p) => expect(p).toHaveAttribute('aria-pressed', 'true'))
    })
  })

  it('marks pending chains with the PENDING pill (active=false)', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ chains: fakeChains })
    render(<MultiChainVaultGrid />)
    await waitFor(() => {
      const pendingPill = screen.getByRole('button', { name: 'PENDING' })
      expect(pendingPill).toHaveAttribute('aria-pressed', 'false')
    })
  })

  it('formats TVL with 2-decimal precision and fee in bps', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ chains: fakeChains })
    render(<MultiChainVaultGrid />)
    await waitFor(() => expect(screen.getByText('12.5 SOL')).toBeInTheDocument())
    expect(screen.getAllByText(/fee 50 bps/).length).toBe(3)
  })

  it('renders chain count with proper pluralization', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ chains: fakeChains })
    render(<MultiChainVaultGrid />)
    await waitFor(() => expect(screen.getByText('3 chains')).toBeInTheDocument())
  })

  it('shows loading copy until data lands', () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(new Promise(() => {}))
    render(<MultiChainVaultGrid />)
    expect(screen.getByText(/Loading chains/)).toBeInTheDocument()
  })

  it('surfaces the error message on fetch failure', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network down'))
    render(<MultiChainVaultGrid />)
    await waitFor(() => expect(screen.getByText('network down')).toBeInTheDocument())
  })
})
