import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { closeDb } from '../src/db.js'

vi.mock('@sip-protocol/sdk', () => ({
  generateEd25519StealthAddress: vi.fn().mockReturnValue({
    stealthAddress: {
      address: '0x' + 'aa'.repeat(32),
      ephemeralPublicKey: '0x' + 'bb'.repeat(32),
    },
  }),
  ed25519PublicKeyToSolanaAddress: vi.fn().mockReturnValue('StEaLtH1111111111111111111111111111111111111'),
}))

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

const { paymentLinkTool, executePaymentLink } = await import('../src/tools/payment-link.js')

describe('paymentLink tool definition', () => {
  it('has correct name and required fields', () => {
    expect(paymentLinkTool.name).toBe('paymentLink')
    expect(paymentLinkTool.input_schema.required).toContain('wallet')
  })

  it('has description mentioning stealth', () => {
    expect(paymentLinkTool.description).toMatch(/stealth|payment.*link/i)
  })
})

describe('executePaymentLink', () => {
  it('creates a payment link with amount and token', async () => {
    const result = await executePaymentLink({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 5.0,
      token: 'SOL',
      memo: 'Coffee',
    })
    expect(result.action).toBe('paymentLink')
    expect(result.status).toBe('success')
    expect(result.link.id).toBeDefined()
    expect(result.link.id.length).toBeGreaterThanOrEqual(8)
    expect(result.link.url).toMatch(/\/pay\//)
    expect(result.link.amount).toBe(5.0)
    expect(result.link.token).toBe('SOL')
    expect(result.link.memo).toBe('Coffee')
    expect(result.link.stealthAddress).toBeDefined()
    expect(result.link.expiresAt).toBeGreaterThan(Date.now())
  })

  it('creates a link without amount (open amount)', async () => {
    const result = await executePaymentLink({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
    })
    expect(result.status).toBe('success')
    expect(result.link.amount).toBeNull()
    expect(result.link.token).toBe('SOL')
  })

  it('uses custom expiry', async () => {
    const result = await executePaymentLink({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      expiresInMinutes: 120,
    })
    const expectedExpiry = Date.now() + 120 * 60 * 1000
    expect(result.link.expiresAt).toBeGreaterThan(expectedExpiry - 5000)
    expect(result.link.expiresAt).toBeLessThan(expectedExpiry + 5000)
  })

  it('defaults to 60 minute expiry', async () => {
    const result = await executePaymentLink({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
    })
    const expectedExpiry = Date.now() + 60 * 60 * 1000
    expect(result.link.expiresAt).toBeGreaterThan(expectedExpiry - 5000)
    expect(result.link.expiresAt).toBeLessThan(expectedExpiry + 5000)
  })

  it('throws when wallet is missing', async () => {
    await expect(executePaymentLink({} as any)).rejects.toThrow(/wallet/i)
  })

  it('throws when amount is negative', async () => {
    await expect(
      executePaymentLink({ wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr', amount: -1 }),
    ).rejects.toThrow(/amount/i)
  })

  it('stores the link in the database', async () => {
    const { getPaymentLink } = await import('../src/db.js')
    const result = await executePaymentLink({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 10,
      token: 'USDC',
    })
    const stored = getPaymentLink(result.link.id)
    expect(stored).not.toBeNull()
    expect(stored!.amount).toBe(10)
    expect(stored!.token).toBe('USDC')
    expect(stored!.status).toBe('pending')
    expect(stored!.type).toBe('link')
  })

  it('generates unique IDs for each link', async () => {
    const r1 = await executePaymentLink({ wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' })
    const r2 = await executePaymentLink({ wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' })
    expect(r1.link.id).not.toBe(r2.link.id)
  })
})
