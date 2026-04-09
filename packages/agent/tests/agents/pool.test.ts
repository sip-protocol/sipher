import { describe, it, expect } from 'vitest'
import { AgentPool } from '../../src/agents/pool.js'

describe('AgentPool', () => {
  it('creates agent for new wallet', () => {
    const pool = new AgentPool({ maxSize: 10, idleTimeoutMs: 30_000 })
    const entry = pool.getOrCreate('wallet-1')
    expect(entry).toBeDefined()
    expect(entry.wallet).toBe('wallet-1')
    expect(pool.size()).toBe(1)
  })

  it('returns same entry for same wallet', () => {
    const pool = new AgentPool({ maxSize: 10, idleTimeoutMs: 30_000 })
    const a = pool.getOrCreate('wallet-1')
    const b = pool.getOrCreate('wallet-1')
    expect(a).toBe(b)
  })

  it('creates different entries for different wallets', () => {
    const pool = new AgentPool({ maxSize: 10, idleTimeoutMs: 30_000 })
    pool.getOrCreate('wallet-1')
    pool.getOrCreate('wallet-2')
    expect(pool.size()).toBe(2)
  })

  it('evicts idle agents', async () => {
    const pool = new AgentPool({ maxSize: 10, idleTimeoutMs: 50 })
    pool.getOrCreate('wallet-1')
    await new Promise(r => setTimeout(r, 100))
    const evicted = pool.evictIdle()
    expect(evicted).toBe(1)
    expect(pool.size()).toBe(0)
  })

  it('respects max pool size by evicting oldest', () => {
    const pool = new AgentPool({ maxSize: 2, idleTimeoutMs: 60_000 })
    pool.getOrCreate('wallet-1')
    pool.getOrCreate('wallet-2')
    pool.getOrCreate('wallet-3')
    expect(pool.size()).toBe(2)
    expect(pool.has('wallet-1')).toBe(false)
    expect(pool.has('wallet-3')).toBe(true)
  })

  it('has() returns false for non-existent wallet', () => {
    const pool = new AgentPool({ maxSize: 10, idleTimeoutMs: 30_000 })
    expect(pool.has('nope')).toBe(false)
  })

  it('updates lastActive on re-access', () => {
    const pool = new AgentPool({ maxSize: 10, idleTimeoutMs: 30_000 })
    const entry = pool.getOrCreate('wallet-1')
    const first = entry.lastActive
    // Small delay
    entry.lastActive = first - 1000
    pool.getOrCreate('wallet-1')
    expect(entry.lastActive).toBeGreaterThan(first - 1000)
  })
})
