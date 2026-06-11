import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isFridayDigest, formatDigestEmbed, crosspostDigest } from '../../src/herald/discord.js'

describe('isFridayDigest', () => {
  it('true only for content rows created on a UTC Friday', () => {
    // 2026-06-12 is a Friday
    expect(isFridayDigest({ type: 'content', created_at: '2026-06-12T08:00:00.000Z' })).toBe(true)
    expect(isFridayDigest({ type: 'content', created_at: '2026-06-11T08:00:00.000Z' })).toBe(false) // Thursday
    expect(isFridayDigest({ type: 'post', created_at: '2026-06-12T08:00:00.000Z' })).toBe(false)
    expect(isFridayDigest({ type: 'content', created_at: undefined })).toBe(false)
    expect(isFridayDigest({ type: 'content', created_at: 'not-a-date' })).toBe(false)
  })
})

describe('formatDigestEmbed', () => {
  it('builds the indigo HERALD webhook payload linking the X post', () => {
    const p = formatDigestEmbed('This week in SIP: shipped things.', '123456789')
    expect(p.username).toBe('HERALD')
    expect(p.avatar_url).toBe('https://github.com/sip-protocol.png')
    expect(p.embeds).toHaveLength(1)
    expect(p.embeds[0].title).toBe('This Week in SIP')
    expect(p.embeds[0].description).toBe('This week in SIP: shipped things.')
    expect(p.embeds[0].url).toBe('https://x.com/sipprotocol/status/123456789')
    expect(p.embeds[0].color).toBe(0x6366f1)
  })
})

describe('crosspostDigest', () => {
  beforeEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it('no-ops when DISCORD_ANNOUNCE_WEBHOOK_URL is unset', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await crosspostDigest({ type: 'content', created_at: '2026-06-12T08:00:00.000Z' }, '1')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('no-ops for non-digest rows', async () => {
    vi.stubEnv('DISCORD_ANNOUNCE_WEBHOOK_URL', 'https://discord.com/api/webhooks/x/y')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await crosspostDigest({ type: 'content', created_at: '2026-06-10T08:00:00.000Z' }, '1')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POSTs the webhook for a Friday digest', async () => {
    vi.stubEnv('DISCORD_ANNOUNCE_WEBHOOK_URL', 'https://discord.com/api/webhooks/x/y')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    vi.stubGlobal('fetch', fetchMock)
    await crosspostDigest({ type: 'content', created_at: '2026-06-12T08:00:00.000Z', content: 'recap' }, '42')
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://discord.com/api/webhooks/x/y')
    expect(JSON.parse(init.body).embeds[0].url).toContain('/status/42')
  })

  it('swallows fetch failures (X post already succeeded — never throw)', async () => {
    vi.stubEnv('DISCORD_ANNOUNCE_WEBHOOK_URL', 'https://discord.com/api/webhooks/x/y')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(
      crosspostDigest({ type: 'content', created_at: '2026-06-12T08:00:00.000Z', content: 'recap' }, '42')
    ).resolves.toBeUndefined()
  })

  it('swallows non-ok webhook responses', async () => {
    vi.stubEnv('DISCORD_ANNOUNCE_WEBHOOK_URL', 'https://discord.com/api/webhooks/x/y')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(
      crosspostDigest({ type: 'content', created_at: '2026-06-12T08:00:00.000Z', content: 'recap' }, '42')
    ).resolves.toBeUndefined()
  })

  it('never rejects even when guardianBus.emit throws (sync subscriber failure)', async () => {
    vi.stubEnv('DISCORD_ANNOUNCE_WEBHOOK_URL', 'https://discord.com/api/webhooks/x/y')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }))
    const { guardianBus } = await import('../../src/coordination/event-bus.js')
    const spy = vi.spyOn(guardianBus, 'emit').mockImplementation(() => { throw new Error('sqlite busy') })
    try {
      await expect(
        crosspostDigest({ type: 'content', created_at: '2026-06-12T08:00:00.000Z', content: 'recap' }, '42')
      ).resolves.toBeUndefined()
    } finally {
      spy.mockRestore()
    }
  })

  it('bounds the webhook call with an 8s abort signal', async () => {
    vi.stubEnv('DISCORD_ANNOUNCE_WEBHOOK_URL', 'https://discord.com/api/webhooks/x/y')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    vi.stubGlobal('fetch', fetchMock)
    await crosspostDigest({ type: 'content', created_at: '2026-06-12T08:00:00.000Z', content: 'recap' }, '42')
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })
})
