import { describe, it, expect, beforeEach, vi } from 'vitest'
import { onAuthClear } from '../onAuthClear'

describe('onAuthClear registry', () => {
  beforeEach(() => {
    onAuthClear._resetForTests()
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
    const a = vi.fn(() => { throw new Error('boom') })
    const b = vi.fn()
    onAuthClear.register(a)
    onAuthClear.register(b)
    expect(() => onAuthClear.clearAll()).not.toThrow()
    expect(b).toHaveBeenCalledOnce()
  })
})
