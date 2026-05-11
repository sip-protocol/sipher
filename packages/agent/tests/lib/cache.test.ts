import { describe, expect, it, beforeEach, vi } from 'vitest'
import { getCached, setCached, _resetForTests } from '../../src/lib/cache.js'

describe('cache helpers', () => {
  beforeEach(async () => {
    await _resetForTests()
  })

  it('returns null for an unset key', async () => {
    const v = await getCached<{ x: number }>('missing')
    expect(v).toBeNull()
  })

  it('returns the value within TTL', async () => {
    await setCached('hit', { x: 42 }, 60)
    const v = await getCached<{ x: number }>('hit')
    expect(v).toEqual({ x: 42 })
  })

  it('returns null after TTL expires', async () => {
    vi.useFakeTimers()
    await setCached('expiring', { x: 1 }, 1)
    vi.advanceTimersByTime(1_500)
    const v = await getCached<{ x: number }>('expiring')
    expect(v).toBeNull()
    vi.useRealTimers()
  })

  it('overwrites the value on second set', async () => {
    await setCached('overwrite', { x: 1 }, 60)
    await setCached('overwrite', { x: 2 }, 60)
    const v = await getCached<{ x: number }>('overwrite')
    expect(v).toEqual({ x: 2 })
  })

  it('clears state via _resetForTests', async () => {
    await setCached('a', 1, 60)
    await _resetForTests()
    expect(await getCached('a')).toBeNull()
  })
})
