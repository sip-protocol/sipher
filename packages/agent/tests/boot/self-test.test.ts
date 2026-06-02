import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { selfTestOpenRouter } from '../../src/boot/self-test.js'

describe('selfTestOpenRouter', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    // Default to a valid config so each test only overrides what it needs to.
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-test-key'
    process.env.SIPHER_MODEL = 'anthropic/claude-sonnet-4.6'
    delete process.env.SIPHER_SKIP_BOOT_SELF_TEST
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  it('returns successfully when OpenRouter responds with 200', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'pong' } }] }), { status: 200 }),
    )

    await expect(selfTestOpenRouter()).resolves.toBeUndefined()

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(init?.method).toBe('POST')
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-or-v1-test-key')
    expect(headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(init?.body as string)
    expect(body.model).toBe('anthropic/claude-sonnet-4.6')
    expect(body.max_tokens).toBe(2)
    expect(body.messages).toHaveLength(1)
  })

  it('throws with HTTP status + body when OpenRouter returns 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'User not found' } }), { status: 401 }),
    )

    await expect(selfTestOpenRouter()).rejects.toThrow(/OpenRouter self-test failed.*401.*User not found/i)
  })

  it('throws when OpenRouter returns 5xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('upstream error', { status: 503 }),
    )

    await expect(selfTestOpenRouter()).rejects.toThrow(/OpenRouter self-test failed.*503/i)
  })

  it('throws when OPENROUTER_API_KEY is unset', async () => {
    delete process.env.OPENROUTER_API_KEY
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await expect(selfTestOpenRouter()).rejects.toThrow(/OPENROUTER_API_KEY/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('propagates getSipherModel error when SIPHER_MODEL is invalid', async () => {
    process.env.SIPHER_MODEL = 'anthropic/claude-sonnet-4-6' // hyphen-form — invalid in pi-ai registry
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await expect(selfTestOpenRouter()).rejects.toThrow(/pi-ai registry|dot notation/i)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('aborts the fetch after the configured timeout', async () => {
    // Mock fetch to hang until the abort signal fires, then reject with AbortError.
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit | undefined)?.signal
        if (!signal) return
        signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    })

    await expect(selfTestOpenRouter({ timeoutMs: 10 })).rejects.toThrow(/timed out|abort/i)
  })

  it('skips entirely when SIPHER_SKIP_BOOT_SELF_TEST=true', async () => {
    process.env.SIPHER_SKIP_BOOT_SELF_TEST = 'true'
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await expect(selfTestOpenRouter()).resolves.toBeUndefined()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does NOT skip when SIPHER_SKIP_BOOT_SELF_TEST is "false" or other truthy strings', async () => {
    process.env.SIPHER_SKIP_BOOT_SELF_TEST = 'false'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }))

    await selfTestOpenRouter()
    expect(fetchSpy).toHaveBeenCalledOnce()
  })
})
