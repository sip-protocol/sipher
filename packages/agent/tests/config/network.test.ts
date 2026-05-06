import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { loadNetworkConfig } from '../../src/config/network'

describe('loadNetworkConfig', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('resolves devnet config when SIPHER_NETWORK=devnet', () => {
    process.env.SIPHER_NETWORK = 'devnet'
    process.env.SIPHER_HELIUS_API_KEY = 'test-key'
    const cfg = loadNetworkConfig()
    expect(cfg.network).toBe('devnet')
    expect(cfg.clusterName).toBe('devnet')
    expect(cfg.programIds.sipherVault).toBe('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')
    expect(cfg.programIds.sipPrivacy).toBe('S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at')
    expect(cfg.beta).toBe(true)
    expect(cfg.solscanSuffix).toBe('?cluster=devnet')
    expect(cfg.publicRpcUrl).toBe('https://api.devnet.solana.com')
    expect(cfg.rpcUrl).toContain('devnet')
    expect(cfg.rpcUrl).toContain('test-key')
    expect(cfg.vaultConfig).toBe('CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u')
  })

  it('resolves mainnet config when SIPHER_NETWORK=mainnet', () => {
    process.env.SIPHER_NETWORK = 'mainnet'
    process.env.SIPHER_HELIUS_API_KEY = 'test-key'
    const cfg = loadNetworkConfig()
    expect(cfg.network).toBe('mainnet')
    expect(cfg.clusterName).toBe('mainnet-beta')
    expect(cfg.beta).toBe(false)
    expect(cfg.solscanSuffix).toBe('')
    expect(cfg.publicRpcUrl).toBe('https://api.mainnet-beta.solana.com')
    expect(cfg.rpcUrl).toContain('mainnet')
    expect(cfg.rpcUrl).toContain('test-key')
    expect(cfg.vaultConfig).toBe('CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u')
  })

  it('throws when SIPHER_NETWORK unset', () => {
    delete process.env.SIPHER_NETWORK
    process.env.SIPHER_HELIUS_API_KEY = 'test-key'
    expect(() => loadNetworkConfig()).toThrow(/SIPHER_NETWORK env var required/)
  })

  it('throws when SIPHER_NETWORK has invalid value', () => {
    process.env.SIPHER_NETWORK = 'testnet'
    process.env.SIPHER_HELIUS_API_KEY = 'test-key'
    expect(() => loadNetworkConfig()).toThrow(/SIPHER_NETWORK env var required/)
  })

  it('throws when SIPHER_HELIUS_API_KEY unset', () => {
    process.env.SIPHER_NETWORK = 'devnet'
    delete process.env.SIPHER_HELIUS_API_KEY
    expect(() => loadNetworkConfig()).toThrow(/SIPHER_HELIUS_API_KEY env var required/)
  })
})
