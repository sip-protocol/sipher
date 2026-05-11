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
    unauthedRemaining: null,
  })
}

// Build a Response-like object that mimics the SSE shape served by
// /api/public/chat/stream, including the X-RateLimit-* headers the FE
// reads to drive the countdown banner.
function mockSseResponseWithRateLimitHeaders(remaining: number, body = 'Hi'): Response {
  const encoder = new TextEncoder()
  const sseBody = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'content_block_delta', text: body })}\n\n`)
      )
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
  return new Response(sseBody, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'X-RateLimit-Limit': '5',
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
    },
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

  it('shows unauthed educational placeholder and keeps input enabled (Wave 2b #218)', () => {
    render(<ChatSidebar />)
    const input = screen.getByPlaceholderText(/ask sipher about privacy/i)
    // Unauthed users still get a free-message budget — input is interactive.
    expect(input).not.toBeDisabled()
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

  describe('unauthed mode', () => {
    beforeEach(() => {
      // Default: 4 messages remaining after the click consumes one.
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockSseResponseWithRateLimitHeaders(4)))
    })

    it('renders 3 suggested questions in empty state', () => {
      render(<ChatSidebar />)
      expect(screen.getByText(/how does a stealth address work/i)).toBeInTheDocument()
      expect(screen.getByText(/sipher and tornado cash/i)).toBeInTheDocument()
      expect(screen.getByText(/viewing keys/i)).toBeInTheDocument()
    })

    it('clicking a suggested question pre-fills + sends', async () => {
      render(<ChatSidebar />)
      fireEvent.click(screen.getByText(/how does a stealth address work/i))
      await waitFor(() => expect(global.fetch as ReturnType<typeof vi.fn>).toHaveBeenCalled())
      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(String(url)).toContain('/api/public/chat/stream')
    })

    it('banner shows "5 free messages — connect for unlimited" before any send', () => {
      render(<ChatSidebar />)
      expect(screen.getByText(/5 .*free messages/i)).toBeInTheDocument()
    })

    it('banner countdown updates from X-RateLimit-Remaining', async () => {
      render(<ChatSidebar />)
      fireEvent.click(screen.getByText(/how does a stealth address work/i))
      await waitFor(() => {
        expect(screen.getByText(/4 .*free messages/i)).toBeInTheDocument()
      })
    })

    it('on remaining=0 after send, input disabled + button copy is "Connect wallet to continue"', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockSseResponseWithRateLimitHeaders(0)))
      render(<ChatSidebar />)
      fireEvent.click(screen.getByText(/how does a stealth address work/i))
      await waitFor(() => {
        const input = screen.getByLabelText(/ask sipher/i) as HTMLInputElement
        expect(input.disabled).toBe(true)
      })
      expect(screen.getByText(/connect wallet to continue/i)).toBeInTheDocument()
    })

    it('on 429 response, input disabled + toast shown', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              error: {
                code: 'RATE_LIMITED',
                message: 'Daily free limit reached',
                resetAt: Date.now() + 3600_000,
              },
            }),
            {
              status: 429,
              headers: {
                'content-type': 'application/json',
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
              },
            }
          )
        )
      )
      render(<ChatSidebar />)
      fireEvent.click(screen.getByText(/how does a stealth address work/i))
      await waitFor(() => {
        const input = screen.getByLabelText(/ask sipher/i) as HTMLInputElement
        expect(input.disabled).toBe(true)
      })
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error' })
      )
    })

    it('POST has NO Authorization header in unauthed mode', async () => {
      render(<ChatSidebar />)
      fireEvent.click(screen.getByText(/how does a stealth address work/i))
      await waitFor(() => expect(global.fetch as ReturnType<typeof vi.fn>).toHaveBeenCalled())
      const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
      const headers = (init.headers ?? {}) as Record<string, string>
      expect(headers.Authorization).toBeUndefined()
      expect(headers.authorization).toBeUndefined()
    })
  })
})
