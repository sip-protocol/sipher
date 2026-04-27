import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useAppStore } from '../../stores/app'
import ChatSidebar from '../ChatSidebar'

function resetStore() {
  useAppStore.setState({
    token: null,
    isAdmin: false,
    messages: [],
    chatLoading: false,
    chatOpen: false,
    activeView: 'dashboard',
  })
}

describe('ChatSidebar', () => {
  beforeEach(() => {
    resetStore()
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
})
