import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createStore } from '../../src/state/ephemeral.js'

describe('ephemeral createStore — in-memory backend', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('set/get round-trips', async () => {
    const store = createStore<string>('test1', { maxSize: 100 })
    await store.set('k', 'v', 60)
    expect(await store.get('k')).toBe('v')
  })

  it('delete removes entry', async () => {
    const store = createStore<string>('test2', { maxSize: 100 })
    await store.set('k', 'v', 60)
    await store.delete('k')
    expect(await store.get('k')).toBeNull()
  })

  it('expires after TTL (lazy on get)', async () => {
    const store = createStore<string>('test3', { maxSize: 100 })
    await store.set('k', 'v', 1)
    vi.advanceTimersByTime(2000)
    expect(await store.get('k')).toBeNull()
  })

  it('respects maxSize cap (oldest evicted FIFO)', async () => {
    const store = createStore<string>('test4', { maxSize: 2 })
    await store.set('a', '1', 60)
    await store.set('b', '2', 60)
    await store.set('c', '3', 60)
    expect(await store.get('a')).toBeNull()
    expect(await store.get('b')).toBe('2')
    expect(await store.get('c')).toBe('3')
  })

  it('size() returns current count', async () => {
    const store = createStore<string>('test5', { maxSize: 100 })
    await store.set('a', '1', 60)
    await store.set('b', '2', 60)
    expect(await store.size()).toBe(2)
  })

  it('updating an existing key does not trigger eviction', async () => {
    // At cap, re-setting an existing key should not evict the oldest entry.
    const store = createStore<string>('test6', { maxSize: 2 })
    await store.set('a', '1', 60)
    await store.set('b', '2', 60)
    await store.set('a', '1-updated', 60)
    expect(await store.size()).toBe(2)
    expect(await store.get('a')).toBe('1-updated')
    expect(await store.get('b')).toBe('2')
  })

  it('_clear() empties the store', async () => {
    const store = createStore<string>('test7', { maxSize: 100 })
    await store.set('a', '1', 60)
    await store.set('b', '2', 60)
    await store._clear()
    expect(await store.size()).toBe(0)
    expect(await store.get('a')).toBeNull()
    expect(await store.get('b')).toBeNull()
  })

  it('background sweep removes expired entries without get', async () => {
    // Without a get, lazy expiration never fires. The interval sweeper must
    // catch up and reduce size() to 0 once all entries are past expiresAt.
    const store = createStore<string>('test8', { maxSize: 100, sweepIntervalMs: 1000 })
    await store.set('a', '1', 1)
    await store.set('b', '2', 1)
    expect(await store.size()).toBe(2)
    vi.advanceTimersByTime(1500)
    expect(await store.size()).toBe(0)
  })
})
