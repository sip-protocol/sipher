import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAppStore } from '../../stores/app'
import HeraldView from '../HeraldView'

describe('HeraldView Edit flow', () => {
  beforeEach(() => {
    useAppStore.setState({ token: 'test-token', isAdmin: true, messages: [], chatLoading: false })
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/herald') && (!init || init.method !== 'PATCH')) {
        return new Response(
          JSON.stringify({
            queue: [{ id: 'q1', content: 'old tweet', scheduled_at: '2026-04-27T10:00:00Z', status: 'pending' }],
            budget: { spent: 0, limit: 150, gate: 'open', percentage: 0 },
            dms: [],
            recentPosts: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (url.includes('/api/herald/queue/q1') && init?.method === 'PATCH') {
        return new Response(JSON.stringify({ id: 'q1', content: 'new tweet' }), { status: 200 })
      }
      return new Response('{}', { status: 200 })
    }) as typeof fetch
  })

  it('toggles into edit mode and shows textarea on Edit click', async () => {
    render(<HeraldView token="test-token" />)
    await userEvent.click(screen.getByRole('button', { name: /^queue$/i }))
    await screen.findByText('old tweet')
    await userEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByRole('textbox')).toHaveValue('old tweet')
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  it('saves the edit via PATCH and exits edit mode', async () => {
    render(<HeraldView token="test-token" />)
    await userEvent.click(screen.getByRole('button', { name: /^queue$/i }))
    await screen.findByText('old tweet')
    await userEvent.click(screen.getByRole('button', { name: /edit/i }))
    const textarea = screen.getByRole('textbox')
    await userEvent.clear(textarea)
    await userEvent.type(textarea, 'new tweet')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/herald/queue/q1'),
      expect.objectContaining({ method: 'PATCH' })
    )
  })
})
