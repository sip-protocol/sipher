import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('vault-refund', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
    warnSpy.mockRestore()
  })

  it('assertVaultRefundWired: warns when prod + mode!=off + not wired', async () => {
    process.env.NODE_ENV = 'production'
    process.env.SENTINEL_MODE = 'yolo'
    delete process.env.SENTINEL_VAULT_REFUND_WIRED
    const { assertVaultRefundWired } = await import('../../src/sentinel/vault-refund.js')
    assertVaultRefundWired()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('performVaultRefund is a stub'))
  })

  it('assertVaultRefundWired: silent when WIRED=true', async () => {
    process.env.NODE_ENV = 'production'
    process.env.SENTINEL_MODE = 'yolo'
    process.env.SENTINEL_VAULT_REFUND_WIRED = 'true'
    const { assertVaultRefundWired } = await import('../../src/sentinel/vault-refund.js')
    assertVaultRefundWired()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('assertVaultRefundWired: silent when mode=off', async () => {
    process.env.NODE_ENV = 'production'
    process.env.SENTINEL_MODE = 'off'
    delete process.env.SENTINEL_VAULT_REFUND_WIRED
    const { assertVaultRefundWired } = await import('../../src/sentinel/vault-refund.js')
    assertVaultRefundWired()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('assertVaultRefundWired: silent in non-prod', async () => {
    process.env.NODE_ENV = 'development'
    process.env.SENTINEL_MODE = 'yolo'
    delete process.env.SENTINEL_VAULT_REFUND_WIRED
    const { assertVaultRefundWired } = await import('../../src/sentinel/vault-refund.js')
    assertVaultRefundWired()
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
