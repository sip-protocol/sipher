// ─────────────────────────────────────────────────────────────────────────────
// Centralized ephemeral state factory
// ─────────────────────────────────────────────────────────────────────────────
//
// Single in-memory backend for short-lived security state (nonces, rate-limit
// counters, SSE tickets, pending confirmations, circuit-breaker flags, etc).
// Replaces ad-hoc module-scope `Map`s scattered across the codebase.
//
// A future commit can swap `createStore` for a Redis-backed implementation
// behind the same interface, so call-sites do not need to change when we move
// to multi-replica deployments.

interface MemEntry<T> {
  value: T
  expiresAt: number
}

export interface EphemeralStore<T> {
  set(key: string, value: T, ttlSeconds: number): Promise<void>
  get(key: string): Promise<T | null>
  delete(key: string): Promise<void>
  size(): Promise<number>
  /** Test helper — clears all entries. */
  _clear(): Promise<void>
}

export interface CreateStoreOptions {
  /** Max number of entries; oldest evicted FIFO. */
  maxSize?: number
  /** Sweep interval for expired entries (default 60s). */
  sweepIntervalMs?: number
}

/**
 * Create an in-memory ephemeral store with TTL-based expiration and FIFO
 * eviction once `maxSize` is reached. The `name` is reserved for telemetry
 * and is not currently used by the in-memory backend.
 */
export function createStore<T>(name: string, opts: CreateStoreOptions = {}): EphemeralStore<T> {
  void name

  const map = new Map<string, MemEntry<T>>()
  const maxSize = opts.maxSize ?? 10_000
  const sweepIntervalMs = opts.sweepIntervalMs ?? 60_000

  const sweep = (): void => {
    const now = Date.now()
    for (const [k, entry] of map) {
      if (entry.expiresAt <= now) map.delete(k)
    }
  }

  const interval = setInterval(sweep, sweepIntervalMs)
  // Don't keep the Node process alive just for sweeping. `setInterval` on Node
  // returns a `Timeout` object exposing `.unref()`; in non-Node hosts (browser
  // workers, edge runtimes) it returns a number — guard before calling.
  if (typeof interval === 'object' && 'unref' in interval) {
    (interval as { unref: () => void }).unref()
  }

  return {
    async set(key, value, ttlSeconds) {
      const expiresAt = Date.now() + ttlSeconds * 1000
      // Evict oldest only when adding a *new* key past the cap. Re-setting an
      // existing key just updates in place — no eviction.
      if (map.size >= maxSize && !map.has(key)) {
        const oldest = map.keys().next().value
        if (oldest !== undefined) map.delete(oldest)
      }
      map.set(key, { value, expiresAt })
    },
    async get(key) {
      const entry = map.get(key)
      if (!entry) return null
      if (entry.expiresAt <= Date.now()) {
        map.delete(key)
        return null
      }
      return entry.value
    },
    async delete(key) {
      map.delete(key)
    },
    async size() {
      return map.size
    },
    async _clear() {
      map.clear()
    },
  }
}
