import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useAppStore } from '../../stores/app'
import ChatSidebar from '../ChatSidebar'
import { triggerAuthInterceptor } from '../../api/client'

const mockToastShow = vi.fn(() => 'toast-id')
const mockToastDismiss = vi.fn()

vi.mock('../../providers/ToastProvider', () => ({
  useToast: () => ({ show: mockToastShow, dismiss: mockToastDismiss }),
}))

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>(
    '../../api/client',
  )
  return {
    ...actual,
    triggerAuthInterceptor: vi.fn(),
  }
})

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

function resetStore() {
  useAppStore.setState({
    token: null,
    isAdmin: false,
    messages: [],
    chatLoading: false,
    chatOpen: false,
  })
}

describe('ChatSidebar', () => {
  beforeEach(() => {
    resetStore()
    mockToastShow.mockClear()
    mockToastDismiss.mockClear()
    vi.mocked(triggerAuthInterceptor).mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows connect-wallet placeholder and disables input when unauthenticated', () => {
    render(<ChatSidebar />)
    const input = screen.getByPlaceholderText('Connect wallet first')
    expect(input).toBeDisabled()
  })

  it('enables input when authenticated', () => {
    useAppStore.setState({ token: 'test-jwt', isAdmin: true })
    render(<ChatSidebar />)
    const input = screen.getByPlaceholderText('Message SIPHER...')
    expect(input).toBeEnabled()
  })

  it('renders SentinelConfirm card when a sentinel_pause message is in the store', () => {
    useAppStore.setState({
      token: 'test-jwt',
      isAdmin: true,
      messages: [
        {
          id: 'm1',
          role: 'system',
          content: '',
          kind: 'sentinel_pause',
          meta: {
            flagId: 'flag-123',
            action: 'Send',
            amount: '5 SOL',
            description: 'Risk: blacklisted address',
            severity: 'high',
          },
        },
      ],
    })
    render(<ChatSidebar />)
    expect(screen.getByText(/blacklisted address/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /override & send/i })).toBeInTheDocument()
  })

  it('sends message and appends streamed reply', async () => {
    useAppStore.setState({ token: 'test-jwt', isAdmin: true })

    const encoder = new TextEncoder()
    const sseBody = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"type":"content_block_delta","text":"Hi"}\n\n')
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(sseBody, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      )
    )

    render(<ChatSidebar />)
    const input = screen.getByPlaceholderText('Message SIPHER...') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(screen.getByText('Hi')).toBeInTheDocument()
    })
  })

  it('shows error toast for non-auth failure and skips inline paint', async () => {
    useAppStore.setState({ token: 'test-jwt', isAdmin: true })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'rate limited' }), {
          status: 429,
          headers: { 'content-type': 'application/json' },
        })
      )
    )

    render(<ChatSidebar />)
    const input = screen.getByPlaceholderText('Message SIPHER...') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'rate limited', kind: 'error' })
      )
    })
    expect(screen.queryByText('rate limited')).not.toBeInTheDocument()
  })

  it('does NOT toast on 401-class errors (handled by global interceptor)', async () => {
    useAppStore.setState({ token: 'test-jwt', isAdmin: true })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'invalid or expired token' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        })
      )
    )

    render(<ChatSidebar />)
    const input = screen.getByPlaceholderText('Message SIPHER...') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      expect(useAppStore.getState().chatLoading).toBe(false)
    })
    expect(mockToastShow).not.toHaveBeenCalled()
    expect(screen.queryByText(/invalid or expired token/)).not.toBeInTheDocument()
  })

  it('calls triggerAuthInterceptor when streaming fetch returns 401', async () => {
    useAppStore.setState({ token: 'test-jwt', isAdmin: true })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        })
      )
    )

    render(<ChatSidebar />)
    const input = screen.getByPlaceholderText('Message SIPHER...') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(triggerAuthInterceptor).toHaveBeenCalledOnce()
    })
  })

  describe('input accessibility', () => {
    it('input has aria-label="Ask SIPHER" and maxLength=4000', () => {
      useAppStore.setState({ token: 'test-jwt', isAdmin: true })
      render(<ChatSidebar />)
      const input = screen.getByLabelText('Ask SIPHER') as HTMLInputElement
      expect(input).toBeInTheDocument()
      expect(input.maxLength).toBe(4000)
    })
  })
})
