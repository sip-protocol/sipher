// packages/agent/tests/scan.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  makeScanResult,
  makeScanPayment,
  VALID_VIEWING_KEY_HEX,
  VALID_SPENDING_KEY_HEX,
  VALID_RECIPIENT,
} from './fixtures/user-tool-mocks.js'

const { mockScanForPayments, mockCreateConnection } = vi.hoisted(() => ({
  mockScanForPayments: vi.fn(),
  mockCreateConnection: vi.fn(),
}))

vi.mock('@sipher/sdk', () => ({
  createConnection: mockCreateConnection,
  scanForPayments: mockScanForPayments,
  fromBaseUnits: (amount: bigint, decimals: number) => {
    const divisor = 10n ** BigInt(decimals)
    const whole = amount / divisor
    const frac = amount % divisor
    return frac === 0n ? whole.toString() : `${whole}.${frac.toString().padStart(decimals, '0').replace(/0+$/, '')}`
  },
}))

import { scanTool, executeScan } from '../src/tools/scan.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateConnection.mockReturnValue({})
})

describe('scanTool definition', () => {
  it('has correct name', () => {
    expect(scanTool.name).toBe('scan')
  })

  it('declares required viewingKey and spendingKey, optional limit', () => {
    expect(scanTool.input_schema.required).toEqual(['viewingKey', 'spendingKey'])
    expect(scanTool.input_schema.properties).toHaveProperty('limit')
  })
})

describe('executeScan — input validation', () => {
  it('rejects empty viewingKey', async () => {
    await expect(
      executeScan({ viewingKey: '', spendingKey: VALID_SPENDING_KEY_HEX })
    ).rejects.toThrow(/viewing key is required/i)
  })

  it('rejects whitespace-only viewingKey', async () => {
    await expect(
      executeScan({ viewingKey: '   ', spendingKey: VALID_SPENDING_KEY_HEX })
    ).rejects.toThrow(/viewing key is required/i)
  })

  it('rejects empty spendingKey', async () => {
    await expect(
      executeScan({ viewingKey: VALID_VIEWING_KEY_HEX, spendingKey: '' })
    ).rejects.toThrow(/spending private key is required/i)
  })

  it('rejects whitespace-only spendingKey', async () => {
    await expect(
      executeScan({ viewingKey: VALID_VIEWING_KEY_HEX, spendingKey: '   ' })
    ).rejects.toThrow(/spending private key is required/i)
  })

  it('rejects viewingKey of wrong length (too short)', async () => {
    await expect(
      executeScan({ viewingKey: 'ab'.repeat(16), spendingKey: VALID_SPENDING_KEY_HEX })
    ).rejects.toThrow(/viewing key must be 32 bytes/i)
  })

  it('rejects viewingKey of wrong length (too long)', async () => {
    await expect(
      executeScan({ viewingKey: 'ab'.repeat(40), spendingKey: VALID_SPENDING_KEY_HEX })
    ).rejects.toThrow(/viewing key must be 32 bytes/i)
  })

  it('rejects spendingKey of wrong length', async () => {
    await expect(
      executeScan({ viewingKey: VALID_VIEWING_KEY_HEX, spendingKey: 'cd'.repeat(16) })
    ).rejects.toThrow(/spending key must be 32 bytes/i)
  })
})

describe('executeScan — happy path', () => {
  it('returns empty list when no payments found', async () => {
    mockScanForPayments.mockResolvedValueOnce(
      makeScanResult({ eventsScanned: 50 })
    )

    const result = await executeScan({
      viewingKey: VALID_VIEWING_KEY_HEX,
      spendingKey: VALID_SPENDING_KEY_HEX,
    })

    expect(result.action).toBe('scan')
    expect(result.status).toBe('success')
    expect(result.payments).toEqual([])
    expect(result.eventsScanned).toBe(50)
    expect(result.hasMore).toBe(false)
    expect(result.message).toContain('Scanned')
    expect(result.message).toContain('no payments found')
  })

  it('returns formatted payments when found', async () => {
    mockScanForPayments.mockResolvedValueOnce(
      makeScanResult({
        payments: [makeScanPayment(), makeScanPayment({ txSignature: 'second-sig' })],
        eventsScanned: 100,
        hasMore: false,
      })
    )

    const result = await executeScan({
      viewingKey: VALID_VIEWING_KEY_HEX,
      spendingKey: VALID_SPENDING_KEY_HEX,
    })

    expect(result.payments).toHaveLength(2)
    expect(result.payments[0].txSignature).toContain('5xyz')
    expect(result.payments[0].stealthAddress).toBe(VALID_RECIPIENT)
    expect(result.payments[0].amount).toBe('0.5') // 500_000_000 / 1e9
    expect(result.payments[0].fee).toBe('0.0005') // 500_000 / 1e9
    expect(result.payments[1].txSignature).toBe('second-sig')
    expect(result.message).toContain('Found 2 payment(s)')
  })

  it('reports hasMore=true', async () => {
    mockScanForPayments.mockResolvedValueOnce(
      makeScanResult({ payments: [makeScanPayment()], hasMore: true })
    )

    const result = await executeScan({
      viewingKey: VALID_VIEWING_KEY_HEX,
      spendingKey: VALID_SPENDING_KEY_HEX,
    })

    expect(result.hasMore).toBe(true)
  })
})

describe('executeScan — limit clamping', () => {
  it('defaults limit to 100', async () => {
    mockScanForPayments.mockResolvedValueOnce(makeScanResult())

    await executeScan({
      viewingKey: VALID_VIEWING_KEY_HEX,
      spendingKey: VALID_SPENDING_KEY_HEX,
    })

    expect(mockScanForPayments).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 })
    )
  })

  it('clamps limit to max 1000', async () => {
    mockScanForPayments.mockResolvedValueOnce(makeScanResult())

    await executeScan({
      viewingKey: VALID_VIEWING_KEY_HEX,
      spendingKey: VALID_SPENDING_KEY_HEX,
      limit: 5000,
    })

    expect(mockScanForPayments).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1000 })
    )
  })

  it('clamps limit to min 1', async () => {
    mockScanForPayments.mockResolvedValueOnce(makeScanResult())

    await executeScan({
      viewingKey: VALID_VIEWING_KEY_HEX,
      spendingKey: VALID_SPENDING_KEY_HEX,
      limit: 0,
    })

    expect(mockScanForPayments).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1 })
    )
  })
})

describe('executeScan — service interaction', () => {
  it('passes viewing key as 32-byte Uint8Array', async () => {
    mockScanForPayments.mockResolvedValueOnce(makeScanResult())

    await executeScan({
      viewingKey: VALID_VIEWING_KEY_HEX,
      spendingKey: VALID_SPENDING_KEY_HEX,
    })

    const call = mockScanForPayments.mock.calls[0][0]
    expect(call.viewingPrivateKey).toBeInstanceOf(Uint8Array)
    expect(call.viewingPrivateKey).toHaveLength(32)
  })

  it('passes spending key as 32-byte Uint8Array', async () => {
    mockScanForPayments.mockResolvedValueOnce(makeScanResult())

    await executeScan({
      viewingKey: VALID_VIEWING_KEY_HEX,
      spendingKey: VALID_SPENDING_KEY_HEX,
    })

    const call = mockScanForPayments.mock.calls[0][0]
    expect(call.spendingPrivateKey).toBeInstanceOf(Uint8Array)
    expect(call.spendingPrivateKey).toHaveLength(32)
  })

  it('strips 0x prefix from keys', async () => {
    mockScanForPayments.mockResolvedValueOnce(makeScanResult())

    await executeScan({
      viewingKey: '0x' + VALID_VIEWING_KEY_HEX,
      spendingKey: '0x' + VALID_SPENDING_KEY_HEX,
    })

    const call = mockScanForPayments.mock.calls[0][0]
    expect(call.viewingPrivateKey).toHaveLength(32)
    expect(call.spendingPrivateKey).toHaveLength(32)
  })

  it('propagates scanForPayments errors', async () => {
    mockScanForPayments.mockRejectedValueOnce(new Error('rpc unavailable'))

    await expect(
      executeScan({
        viewingKey: VALID_VIEWING_KEY_HEX,
        spendingKey: VALID_SPENDING_KEY_HEX,
      })
    ).rejects.toThrow(/rpc unavailable/i)
  })
})
