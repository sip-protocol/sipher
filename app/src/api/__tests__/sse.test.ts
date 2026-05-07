import { describe, it, expect } from 'vitest'
import { pickSseUrl } from '../sse'

const TOKEN = 'jwt-token-with/special=chars'
const TICKET = 'ticket-abc'
const BASE = 'http://localhost:3000'

describe('pickSseUrl', () => {
  it('uses the ticket query param when ticket is present (any environment)', () => {
    const url = pickSseUrl(TOKEN, TICKET, BASE, false)
    expect(url).toBe(`${BASE}/api/stream?ticket=${encodeURIComponent(TICKET)}`)
  })

  it('uses the ticket even when isDev is true (ticket always wins)', () => {
    const url = pickSseUrl(TOKEN, TICKET, BASE, true)
    expect(url).toBe(`${BASE}/api/stream?ticket=${encodeURIComponent(TICKET)}`)
  })

  it('falls back to ?token= URL in DEV when ticket exchange returns null', () => {
    const url = pickSseUrl(TOKEN, null, BASE, true)
    expect(url).toBe(`${BASE}/api/stream?token=${encodeURIComponent(TOKEN)}`)
  })

  it('throws in production when ticket is null', () => {
    expect(() => pickSseUrl(TOKEN, null, BASE, false)).toThrow(
      /JWT-in-URL fallback is disabled in production/i,
    )
  })

  it('encodes special characters in the ticket', () => {
    const url = pickSseUrl(TOKEN, 'a/b=c&d', BASE, false)
    expect(url).toBe(`${BASE}/api/stream?ticket=${encodeURIComponent('a/b=c&d')}`)
  })
})
