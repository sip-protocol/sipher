import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mock scanner (no real RPC) ──────────────────────────────────────────────

vi.mock('../../src/sentinel/scanner.js', () => ({
  scanWallet: vi.fn().mockResolvedValue({
    wallet: 'wallet-1',
    vaultBalance: 5,
    detections: [],
    rpcCalls: 2,
    timestamp: new Date().toISOString(),
  }),
}))

// ─── Lazy imports after mock registration ───────────────────────────────────

const { SENTINEL_IDENTITY, SentinelWorker } = await import(
  '../../src/sentinel/sentinel.js'
)

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('SENTINEL_IDENTITY', () => {
  it('has correct identity fields', () => {
    expect(SENTINEL_IDENTITY.name).toBe('SENTINEL')
    expect(SENTINEL_IDENTITY.role).toBe('Blockchain Monitor')
    expect(SENTINEL_IDENTITY.llm).toBe(false)
  })
})

describe('SentinelWorker', () => {
  let sentinel: InstanceType<typeof SentinelWorker>

  beforeEach(() => {
    sentinel = new SentinelWorker()
  })

  afterEach(() => {
    sentinel.stop()
  })

  it('starts in stopped state', () => {
    expect(sentinel.isRunning()).toBe(false)
    expect(sentinel.getStatus().state).toBe('stopped')
  })

  it('addWallet / removeWallet / getWallets work correctly', () => {
    sentinel.addWallet('wallet-1')
    sentinel.addWallet('wallet-2')
    expect(sentinel.getWallets()).toContain('wallet-1')
    expect(sentinel.getWallets()).toContain('wallet-2')
    expect(sentinel.getWallets()).toHaveLength(2)

    sentinel.removeWallet('wallet-1')
    expect(sentinel.getWallets()).not.toContain('wallet-1')
    expect(sentinel.getWallets()).toHaveLength(1)
  })

  it('getStatus returns all expected fields', () => {
    const status = sentinel.getStatus()
    expect(status).toHaveProperty('state')
    expect(status).toHaveProperty('walletsMonitored')
    expect(status).toHaveProperty('lastScanAt')
    expect(status).toHaveProperty('totalScans')
    expect(status).toHaveProperty('currentInterval')
    expect(status.lastScanAt).toBeNull()
    expect(status.totalScans).toBe(0)
  })

  it('start / stop lifecycle transitions state correctly', () => {
    expect(sentinel.isRunning()).toBe(false)

    sentinel.start()
    expect(sentinel.isRunning()).toBe(true)
    expect(sentinel.getStatus().state).toBe('running')

    sentinel.stop()
    expect(sentinel.isRunning()).toBe(false)
    expect(sentinel.getStatus().state).toBe('stopped')
  })

  it('getStatus walletsMonitored reflects currently tracked wallets', () => {
    expect(sentinel.getStatus().walletsMonitored).toBe(0)

    sentinel.addWallet('wallet-a')
    expect(sentinel.getStatus().walletsMonitored).toBe(1)

    sentinel.addWallet('wallet-b')
    sentinel.addWallet('wallet-c')
    expect(sentinel.getStatus().walletsMonitored).toBe(3)

    sentinel.removeWallet('wallet-b')
    expect(sentinel.getStatus().walletsMonitored).toBe(2)
  })
})
