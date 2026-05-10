import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { PrivacyGraph } from '../PrivacyGraph'
import { onAuthClear } from '../../store/onAuthClear'

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => ({ token: 'tok', isAdmin: false }),
}))

import { apiFetch } from '../../api/client'

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
})

beforeEach(() => {
  ;(apiFetch as ReturnType<typeof vi.fn>).mockReset()
  onAuthClear._resetForTests()
})

describe('PrivacyGraph', () => {
  it('shows the empty-state copy when the tree is empty', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      tree: [],
      rootWallet: '',
    })
    render(<PrivacyGraph />)
    await waitFor(() => {
      expect(screen.getByText(/0 addresses/)).toBeInTheDocument()
      expect(screen.getByText(/Connect a wallet to see your privacy graph/)).toBeInTheDocument()
    })
  })

  it('renders the NodeGraph and address count when the API returns nodes', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      tree: [
        {
          index: 0,
          derivationPath: "m/0'",
          stealthAddress: 'rootWallet',
          parentIndex: null,
          createdAt: '2026-05-08T00:00:00Z',
        },
      ],
      rootWallet: 'rootWallet',
    })
    render(<PrivacyGraph />)
    await waitFor(() => expect(screen.getByText('1 address')).toBeInTheDocument())
    expect(screen.getByTestId('node-graph')).toBeInTheDocument()
  })

  it('falls back to empty state when the fetch errors', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'))
    render(<PrivacyGraph />)
    await waitFor(() => expect(screen.getByText(/0 addresses/)).toBeInTheDocument())
  })

  it('clears the tree when onAuthClear.clearAll fires', async () => {
    ;(apiFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      tree: [
        {
          index: 0,
          derivationPath: 'm/0',
          stealthAddress: 'X',
          parentIndex: null,
          createdAt: 't',
        },
      ],
      rootWallet: 'W',
    })
    render(<PrivacyGraph />)
    await waitFor(() => {
      expect(screen.getByText('1 address')).toBeInTheDocument()
    })

    act(() => onAuthClear.clearAll())

    await waitFor(() => {
      expect(screen.getByText(/0 addresses/)).toBeInTheDocument()
    })
  })
})
