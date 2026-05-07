import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAppStore } from '../../stores/app'
import VaultView from '../VaultView'

vi.mock('../../hooks/useAuthState', async () => {
  const { useAppStore: store } = await vi.importActual<
    typeof import('../../stores/app')
  >('../../stores/app')
  return {
    useAuthState: () => {
      const t = store.getState().token
      return {
        status: t ? ('authed' as const) : ('unauthed' as const),
        token: t,
        expiresAt: null,
        isAdmin: store.getState().isAdmin,
        publicKey: null,
        authenticate: () => Promise.resolve(),
        disconnect: () => Promise.resolve(),
        error: null,
      }
    },
  }
})

describe('VaultView Deposit/Withdraw flow', () => {
  beforeEach(() => {
    useAppStore.setState({
      token: 'test-token',
      isAdmin: false,
      messages: [],
      chatLoading: false,
      pendingPrompt: null,
    })
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
          activity: [],
          balances: { sol: 5, tokens: [], status: 'ok' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    ) as typeof fetch
  })

  it('shows Deposit and Withdraw buttons initially', async () => {
    render(<VaultView />)
    expect(await screen.findByRole('button', { name: /deposit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /withdraw/i })).toBeInTheDocument()
  })

  it('opens AmountForm on Deposit click', async () => {
    render(<VaultView />)
    await userEvent.click(await screen.findByRole('button', { name: /deposit/i }))
    expect(screen.getByText(/deposit amount/i)).toBeInTheDocument()
  })

  it('moves through 3-step flow and calls seedChat on confirm', async () => {
    const seedChat = vi.fn()
    useAppStore.setState({ seedChat })
    render(<VaultView />)
    await userEvent.click(await screen.findByRole('button', { name: /deposit/i }))
    await userEvent.type(screen.getByRole('spinbutton'), '1')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/Confirm Action/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /confirm & sign/i }))
    expect(seedChat).toHaveBeenCalledWith(expect.stringContaining('deposit 1 SOL'))
  })
})
