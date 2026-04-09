export interface PoolEntry {
  wallet: string
  messages: Array<{ role: string; content: unknown }>
  lastActive: number
}

export interface AgentPoolOptions {
  maxSize: number
  idleTimeoutMs: number
  maxMessages?: number
}

const DEFAULT_MAX_MESSAGES = 100

export class AgentPool {
  private agents = new Map<string, PoolEntry>()
  private options: AgentPoolOptions

  constructor(options: AgentPoolOptions) {
    this.options = options
  }

  /** Append messages to a pool entry, capping at maxMessages to prevent unbounded growth. */
  appendMessages(wallet: string, msgs: PoolEntry['messages']): void {
    const entry = this.getOrCreate(wallet)
    const cap = this.options.maxMessages ?? DEFAULT_MAX_MESSAGES
    entry.messages.push(...msgs)
    if (entry.messages.length > cap) {
      entry.messages = entry.messages.slice(-cap)
    }
  }

  getOrCreate(wallet: string): PoolEntry {
    const existing = this.agents.get(wallet)
    if (existing) {
      existing.lastActive = Date.now()
      return existing
    }
    if (this.agents.size >= this.options.maxSize) {
      this.evictOldest()
    }
    const entry: PoolEntry = { wallet, messages: [], lastActive: Date.now() }
    this.agents.set(wallet, entry)
    return entry
  }

  has(wallet: string): boolean {
    return this.agents.has(wallet)
  }

  get(wallet: string): PoolEntry | undefined {
    return this.agents.get(wallet)
  }

  size(): number {
    return this.agents.size
  }

  evictIdle(): number {
    const now = Date.now()
    let evicted = 0
    for (const [wallet, entry] of this.agents) {
      if (now - entry.lastActive > this.options.idleTimeoutMs) {
        this.agents.delete(wallet)
        evicted++
      }
    }
    return evicted
  }

  private evictOldest(): void {
    let oldest: string | null = null
    let oldestTime = Infinity
    for (const [wallet, entry] of this.agents) {
      if (entry.lastActive < oldestTime) {
        oldest = wallet
        oldestTime = entry.lastActive
      }
    }
    if (oldest) this.agents.delete(oldest)
  }
}
