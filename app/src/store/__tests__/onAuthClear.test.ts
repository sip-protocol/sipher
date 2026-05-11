import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { onAuthClear } from '../onAuthClear'

describe('onAuthClear registry', () => {
  beforeEach(() => {
    onAuthClear._resetForTests()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('register returns an unsubscribe function', () => {
    const unsubscribe = onAuthClear.register(() => {})
    expect(typeof unsubscribe).toBe('function')
  })

  it('clearAll fires every registered callback', () => {
    const a = vi.fn()
    const b = vi.fn()
    onAuthClear.register(a)
    onAuthClear.register(b)
    onAuthClear.clearAll()
    expect(a).toHaveBeenCalledOnce()
    expect(b).toHaveBeenCalledOnce()
  })

  it('unsubscribed callbacks are not fired', () => {
    const a = vi.fn()
    const b = vi.fn()
    const unsubA = onAuthClear.register(a)
    onAuthClear.register(b)
    unsubA()
    onAuthClear.clearAll()
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledOnce()
  })

  it('clearAll is idempotent — second call after a clear with no new registrations is a noop', () => {
    const a = vi.fn()
    onAuthClear.register(a)
    onAuthClear.clearAll()
    onAuthClear.clearAll()
    expect(a).toHaveBeenCalledTimes(2)
  })

  it('a callback that throws does not block subsequent callbacks', () => {
    // Vitest's default env is DEV=true, which routes the swallowed-error
    // warning to console.warn. Suppress it here so the test output stays
    // clean — the warn behavior itself is covered by the DEV-mode test
    // below.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const a = vi.fn(() => { throw new Error('boom') })
    const b = vi.fn()
    onAuthClear.register(a)
    onAuthClear.register(b)
    expect(() => onAuthClear.clearAll()).not.toThrow()
    expect(b).toHaveBeenCalledOnce()
    warnSpy.mockRestore()
  })

  it('warns in DEV mode when a registered callback throws', () => {
    vi.stubEnv('DEV', true)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const err = new Error('boom')
    onAuthClear.register(() => { throw err })
    onAuthClear.clearAll()

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('onAuthClear callback threw'),
      err,
    )
    warnSpy.mockRestore()
  })

  it('does NOT warn in production mode when a callback throws', () => {
    vi.stubEnv('DEV', false)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    onAuthClear.register(() => { throw new Error('boom') })
    onAuthClear.clearAll()

    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
