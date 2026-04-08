import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { closeDb } from '../src/db.js'

vi.mock('@sip-protocol/sdk', () => ({
  generateEd25519StealthAddress: vi.fn().mockReturnValue({
    stealthAddress: {
      address: '0x' + 'cc'.repeat(32),
      ephemeralPublicKey: '0x' + 'dd'.repeat(32),
    },
  }),
  ed25519PublicKeyToSolanaAddress: vi.fn().mockReturnValue('InVoIcE111111111111111111111111111111111111'),
}))

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

const { invoiceTool, executeInvoice } = await import('../src/tools/invoice.js')

describe('invoice tool definition', () => {
  it('has correct name', () => {
    expect(invoiceTool.name).toBe('invoice')
  })

  it('requires wallet and amount', () => {
    expect(invoiceTool.input_schema.required).toContain('wallet')
    expect(invoiceTool.input_schema.required).toContain('amount')
  })
})

describe('executeInvoice', () => {
  it('creates an invoice with full metadata', async () => {
    const result = await executeInvoice({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 500,
      token: 'USDC',
      description: 'Consulting services — March 2026',
      dueDate: '2026-04-15',
      reference: 'INV-2026-042',
    })
    expect(result.action).toBe('invoice')
    expect(result.status).toBe('success')
    expect(result.invoice.amount).toBe(500)
    expect(result.invoice.token).toBe('USDC')
    expect(result.invoice.description).toBe('Consulting services — March 2026')
    expect(result.invoice.dueDate).toBe('2026-04-15')
    expect(result.invoice.reference).toBe('INV-2026-042')
    expect(result.invoice.url).toMatch(/\/pay\//)
  })

  it('stores as type invoice with invoice_meta in DB', async () => {
    const { getPaymentLink } = await import('../src/db.js')
    const result = await executeInvoice({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 100,
      token: 'SOL',
      description: 'Test invoice',
      reference: 'REF-001',
    })
    const stored = getPaymentLink(result.invoice.id)
    expect(stored).not.toBeNull()
    expect(stored!.type).toBe('invoice')
    expect(stored!.invoice_meta).toEqual({
      description: 'Test invoice',
      dueDate: null,
      reference: 'REF-001',
    })
  })

  it('throws when amount is missing', async () => {
    await expect(
      executeInvoice({ wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' } as any),
    ).rejects.toThrow(/amount/i)
  })

  it('throws when amount is zero', async () => {
    await expect(
      executeInvoice({
        wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
        amount: 0,
      }),
    ).rejects.toThrow(/amount/i)
  })

  it('throws when wallet is missing', async () => {
    await expect(
      executeInvoice({ amount: 100 } as any),
    ).rejects.toThrow(/wallet/i)
  })

  it('defaults expiry to 7 days for invoices', async () => {
    const result = await executeInvoice({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 50,
    })
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    const expected = Date.now() + sevenDaysMs
    expect(result.invoice.expiresAt).toBeGreaterThan(expected - 5000)
    expect(result.invoice.expiresAt).toBeLessThan(expected + 5000)
  })
})
