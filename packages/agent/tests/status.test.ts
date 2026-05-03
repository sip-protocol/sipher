import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  makeVaultConfig,
  VAULT_PROGRAM_ID_BASE58,
  VALID_WALLET,
} from './fixtures/user-tool-mocks.js'

// vi.hoisted — declare mock fns so vi.mock factories can reference them
const { mockGetVaultConfig, mockCreateConnection } = vi.hoisted(() => ({
  mockGetVaultConfig: vi.fn(),
  mockCreateConnection: vi.fn(),
}))

vi.mock('@sipher/sdk', () => ({
  createConnection: mockCreateConnection,
  getVaultConfig: mockGetVaultConfig,
  SIPHER_VAULT_PROGRAM_ID: { toBase58: () => 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB' },
  DEFAULT_FEE_BPS: 10,
  DEFAULT_REFUND_TIMEOUT: 86400,
}))

import { statusTool, executeStatus } from '../src/tools/status.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateConnection.mockReturnValue({})
})

describe('statusTool definition', () => {
  it('has correct name', () => {
    expect(statusTool.name).toBe('status')
  })

  it('takes no required input', () => {
    expect(statusTool.input_schema.required).toEqual([])
  })
})

describe('executeStatus — config found', () => {
  it('returns active vault status with all fields', async () => {
    mockGetVaultConfig.mockResolvedValueOnce(makeVaultConfig())

    const result = await executeStatus()

    expect(result.action).toBe('status')
    expect(result.status).toBe('success')
    expect(result.vault.configFound).toBe(true)
    expect(result.vault.paused).toBe(false)
    expect(result.vault.feeBps).toBe(10)
    expect(result.vault.feePercent).toBe('0.1%')
    expect(result.vault.refundTimeout).toBe(86400)
    expect(result.vault.refundTimeoutHuman).toBe('24 hours')
    expect(result.vault.totalDeposits).toBe(5)
    expect(result.vault.totalDepositors).toBe(3)
    expect(result.vault.authority).toBe(VALID_WALLET)
    expect(result.vault.programId).toBe(VAULT_PROGRAM_ID_BASE58)
  })

  it('returns paused message when config.paused is true', async () => {
    mockGetVaultConfig.mockResolvedValueOnce(makeVaultConfig({ paused: true }))

    const result = await executeStatus()

    expect(result.vault.paused).toBe(true)
    expect(result.message).toContain('PAUSED')
    expect(result.message).toContain('Funds are safe')
  })

  it('returns active message when config.paused is false', async () => {
    mockGetVaultConfig.mockResolvedValueOnce(makeVaultConfig({ paused: false }))

    const result = await executeStatus()

    expect(result.message).toContain('Vault is active')
    expect(result.message).toContain('0.1%')
  })

  it('formats refund timeout as minutes when < 1 hour', async () => {
    mockGetVaultConfig.mockResolvedValueOnce(
      makeVaultConfig({ refundTimeout: 1800 })
    )

    const result = await executeStatus()

    expect(result.vault.refundTimeoutHuman).toBe('30 minutes')
  })

  it('formats refund timeout as hours when >= 1 hour', async () => {
    mockGetVaultConfig.mockResolvedValueOnce(
      makeVaultConfig({ refundTimeout: 7200 })
    )

    const result = await executeStatus()

    expect(result.vault.refundTimeoutHuman).toBe('2 hours')
  })
})

describe('executeStatus — config not found', () => {
  it('returns default vault shape when getVaultConfig returns null', async () => {
    mockGetVaultConfig.mockResolvedValueOnce(null)

    const result = await executeStatus()

    expect(result.vault.configFound).toBe(false)
    expect(result.vault.paused).toBe(false)
    expect(result.vault.feeBps).toBe(10) // DEFAULT_FEE_BPS
    expect(result.vault.refundTimeout).toBe(86400) // DEFAULT_REFUND_TIMEOUT
    expect(result.vault.totalDeposits).toBe(0)
    expect(result.vault.totalDepositors).toBe(0)
    expect(result.vault.authority).toBeNull()
    expect(result.message).toContain('not found on-chain')
  })
})

describe('executeStatus — service interaction', () => {
  it('respects SOLANA_NETWORK env var', async () => {
    const original = process.env.SOLANA_NETWORK
    process.env.SOLANA_NETWORK = 'devnet'
    try {
      mockGetVaultConfig.mockResolvedValueOnce(makeVaultConfig())
      await executeStatus()
      expect(mockCreateConnection).toHaveBeenCalledWith('devnet')
    } finally {
      if (original !== undefined) process.env.SOLANA_NETWORK = original
      else delete process.env.SOLANA_NETWORK
    }
  })

  it('defaults to mainnet-beta when SOLANA_NETWORK unset', async () => {
    const original = process.env.SOLANA_NETWORK
    delete process.env.SOLANA_NETWORK
    try {
      mockGetVaultConfig.mockResolvedValueOnce(makeVaultConfig())
      await executeStatus()
      expect(mockCreateConnection).toHaveBeenCalledWith('mainnet-beta')
    } finally {
      if (original !== undefined) process.env.SOLANA_NETWORK = original
    }
  })
})
