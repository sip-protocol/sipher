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
})
