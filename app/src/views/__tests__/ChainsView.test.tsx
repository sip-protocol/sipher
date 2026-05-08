import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ChainsView from '../ChainsView'

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
}))

import { apiFetch } from '../../api/client'

const fakeChains = [
  {
    chainId: 'solana-mainnet',
    network: 'mainnet' as const,
    programId: 'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at',
    vaultPda: 'BVawZkppFewygA5nxdrLma4ThKx8Th7bW4KTCkcWTZwZ',
    tvlSol: 12.5,
    feeBps: 50,
    status: 'live' as const,
    rpcLatencyMs: null,
  },
  {
    chainId: 'sepolia',
    network: 'testnet' as const,
    programId: '0x1FED19684dC108304960db2818CF5a961d28405E',
    vaultPda: null,
    tvlSol: 3.7,
    feeBps: 50,
    status: 'live' as const,
    rpcLatencyMs: null,
  },
  {
    chainId: 'blast-sepolia',
    network: 'testnet' as const,
    programId: '',
    vaultPda: null,
    tvlSol: 0,
    feeBps: 50,
    status: 'pending' as const,
    rpcLatencyMs: null,
  },
]

beforeEach(() => {
  ;(apiFetch as ReturnType<typeof vi.fn>).mockReset()
})

describe('ChainsView', () => {
  it('renders the page header with live/total counts and aggregate TVL', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ chains: fakeChains })
    render(<ChainsView />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Chains' })).toBeInTheDocument()
      expect(screen.getByText(/2 of 3 chains live/)).toBeInTheDocument()
      expect(screen.getByText(/16\.20 SOL aggregate TVL/)).toBeInTheDocument()
    })
  })

  it('renders one row per chain with formatted name + status pill', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ chains: fakeChains })
    render(<ChainsView />)
    await waitFor(() => {
      expect(screen.getByText('Solana Mainnet')).toBeInTheDocument()
      expect(screen.getByText('Sepolia')).toBeInTheDocument()
      expect(screen.getByText('Blast Sepolia')).toBeInTheDocument()
    })
    expect(screen.getAllByRole('button', { name: 'LIVE' }).length).toBe(2)
    expect(screen.getByRole('button', { name: 'PENDING' })).toBeInTheDocument()
  })

  it('renders the program ID via HashCell when present, em-dash when empty', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ chains: fakeChains })
    render(<ChainsView />)
    await waitFor(() => {
      expect(screen.getByText('S1PMFs…epS9at')).toBeInTheDocument()
      expect(screen.getByText('0x1FED…28405E')).toBeInTheDocument()
    })
  })

  it('shows the loading row when chains is empty before fetch resolves', () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(new Promise(() => {}))
    render(<ChainsView />)
    expect(screen.getByText(/Loading chains/)).toBeInTheDocument()
  })

  it('surfaces error copy when fetch fails', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    render(<ChainsView />)
    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument())
  })
})
