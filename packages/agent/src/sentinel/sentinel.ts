import { getSentinelConfig, type SentinelConfig } from './config.js'
import { scanWallet } from './scanner.js'
import { toGuardianEvent } from './detector.js'
import { guardianBus, type GuardianEvent } from '../coordination/event-bus.js'

// ─────────────────────────────────────────────────────────────────────────────
// Identity
// ─────────────────────────────────────────────────────────────────────────────

export const SENTINEL_IDENTITY = {
  name: 'SENTINEL',
  role: 'Blockchain Monitor',
  llm: false,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SentinelState = 'running' | 'stopped'

export interface SentinelStatus {
  state: SentinelState
  walletsMonitored: number
  lastScanAt: string | null
  totalScans: number
  currentInterval: number
}

// ─────────────────────────────────────────────────────────────────────────────
// SentinelWorker
// ─────────────────────────────────────────────────────────────────────────────

export class SentinelWorker {
  private wallets = new Set<string>()
  private balanceCache = new Map<string, number>()
  private running = false
  private timer: NodeJS.Timeout | null = null
  private config: SentinelConfig
  private currentInterval: number
  private backoffMultiplier = 1
  private lastScanAt: string | null = null
  private totalScans = 0

  constructor() {
    this.config = getSentinelConfig()
    this.currentInterval = this.config.scanInterval
  }

  addWallet(wallet: string): void {
    this.wallets.add(wallet)
  }

  removeWallet(wallet: string): void {
    this.wallets.delete(wallet)
    this.balanceCache.delete(wallet)
  }

  getWallets(): string[] {
    return Array.from(this.wallets)
  }

  isRunning(): boolean {
    return this.running
  }

  getStatus(): SentinelStatus {
    return {
      state: this.running ? 'running' : 'stopped',
      walletsMonitored: this.wallets.size,
      lastScanAt: this.lastScanAt,
      totalScans: this.totalScans,
      currentInterval: this.currentInterval,
    }
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.scheduleTick()
  }

  stop(): void {
    this.running = false
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private scheduleTick(): void {
    this.timer = setTimeout(() => {
      this.tick().catch(() => {
        // tick handles its own errors — this is a safety net
      })
    }, this.currentInterval)
    // Don't hold the Node.js event loop open if nothing else is running
    this.timer.unref()
  }

  private async tick(): Promise<void> {
    if (!this.running) return

    const allWallets = this.getWallets()

    if (allWallets.length === 0) {
      // Nothing to do — use idle interval and reschedule
      this.currentInterval = this.config.scanInterval
      this.scheduleTick()
      return
    }

    // Slice to per-cycle limit
    const batch = allWallets.slice(0, this.config.maxWalletsPerCycle)

    // Active scan — use the faster interval
    this.currentInterval = this.config.activeScanInterval
    this.totalScans++

    let rpcError: Error | null = null

    for (const wallet of batch) {
      try {
        const previousBalance = this.balanceCache.get(wallet)

        const result = await scanWallet(wallet, {
          previousBalance,
          maxRpcCalls: this.config.maxRpcPerWallet,
        })

        // Update cached balance
        this.balanceCache.set(wallet, result.vaultBalance)

        // Reset backoff on success
        this.backoffMultiplier = 1
        this.currentInterval = this.config.activeScanInterval

        // Emit a GuardianEvent for each detection
        for (const detection of result.detections) {
          const partial = toGuardianEvent(detection)
          const event: GuardianEvent = {
            ...partial,
            timestamp: new Date().toISOString(),
          }
          guardianBus.emit(event)
        }
      } catch (err) {
        rpcError = err instanceof Error ? err : new Error(String(err))
      }
    }

    // Record scan completion timestamp
    this.lastScanAt = new Date().toISOString()

    if (rpcError !== null) {
      // Exponential backoff — double the current interval, cap at backoffMax
      this.backoffMultiplier = Math.min(
        this.backoffMultiplier * 2,
        this.config.backoffMax / this.config.activeScanInterval
      )
      this.currentInterval = Math.min(
        this.config.activeScanInterval * this.backoffMultiplier,
        this.config.backoffMax
      )

      guardianBus.emit({
        source: 'sentinel',
        type: 'sentinel:rpc-error',
        level: 'important',
        data: {
          message: rpcError.message,
          nextIntervalMs: this.currentInterval,
        },
        wallet: null,
        timestamp: new Date().toISOString(),
      })
    } else {
      // Routine scan-complete event
      guardianBus.emit({
        source: 'sentinel',
        type: 'sentinel:scan-complete',
        level: 'routine',
        data: {
          walletsScanned: batch.length,
          totalScans: this.totalScans,
        },
        wallet: null,
        timestamp: new Date().toISOString(),
      })
    }

    // Reschedule for next cycle
    if (this.running) {
      this.scheduleTick()
    }
  }
}
