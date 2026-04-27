import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SentinelConfirm from '../SentinelConfirm'

describe('SentinelConfirm', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 })) as typeof fetch
  })

  it('renders amber warning ConfirmCard with description', () => {
    render(
      <SentinelConfirm
        flagId="abc"
        token="t"
        action="Send"
        amount="5 SOL"
        description="Risk: blacklisted address"
        onResolved={() => {}}
      />
    )
    expect(screen.getByText(/blacklisted address/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /override & send/i })).toBeInTheDocument()
  })

  it('POSTs to override endpoint on Override click', async () => {
    const onResolved = vi.fn()
    render(
      <SentinelConfirm
        flagId="abc"
        token="t"
        action="Send"
        amount="5 SOL"
        description="x"
        onResolved={onResolved}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /override & send/i }))
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sentinel/override/abc'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(onResolved).toHaveBeenCalledWith('override')
  })

  it('POSTs to cancel endpoint on Cancel click', async () => {
    const onResolved = vi.fn()
    render(
      <SentinelConfirm
        flagId="abc"
        token="t"
        action="Send"
        amount="5 SOL"
        description="x"
        onResolved={onResolved}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sentinel/cancel/abc'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(onResolved).toHaveBeenCalledWith('cancel')
  })

  it('prevents double-dispatch when busy', async () => {
    // never resolves so busy stays true
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {})) as typeof fetch
    const onResolved = vi.fn()
    render(
      <SentinelConfirm
        flagId="abc"
        token="t"
        action="Send"
        amount="5 SOL"
        description="x"
        onResolved={onResolved}
      />
    )
    const btn = screen.getByRole('button', { name: /override & send/i })
    await userEvent.click(btn)
    await userEvent.click(btn)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(onResolved).not.toHaveBeenCalled()
  })

  it('surfaces error and does not resolve when fetch returns non-ok', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('{"error":"flag expired"}', { status: 404 })) as typeof fetch
    const onResolved = vi.fn()
    render(
      <SentinelConfirm
        flagId="abc"
        token="t"
        action="Send"
        amount="5 SOL"
        description="x"
        onResolved={onResolved}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /override & send/i }))
    expect(onResolved).not.toHaveBeenCalled()
    expect(screen.getByText(/failed/i)).toBeInTheDocument()
  })
})
