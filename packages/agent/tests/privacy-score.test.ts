import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetSignaturesForAddress = vi.fn()
const mockGetParsedTransactions = vi.fn()

vi.mock('@sipher/sdk', () => ({
  createConnection: vi.fn().mockReturnValue({
    getSignaturesForAddress: mockGetSignaturesForAddress,
    getParsedTransactions: mockGetParsedTransactions,
  }),
}))

beforeEach(() => {
  mockGetSignaturesForAddress.mockReset()
  mockGetParsedTransactions.mockReset()
})

const { privacyScoreTool, executePrivacyScore } = await import('../src/tools/privacy-score.js')

describe('privacyScore tool definition', () => {
  it('has correct name', () => {
    expect(privacyScoreTool.name).toBe('privacyScore')
  })

  it('requires wallet', () => {
    expect(privacyScoreTool.input_schema.required).toContain('wallet')
  })
})

describe('executePrivacyScore', () => {
  it('returns high score for wallet with no exchange interactions', async () => {
    mockGetSignaturesForAddress.mockResolvedValue([
      { signature: 'tx1', blockTime: 1700000000 },
      { signature: 'tx2', blockTime: 1700000100 },
    ])
    mockGetParsedTransactions.mockResolvedValue([
      {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [
              { pubkey: { toBase58: () => 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' } },
              { pubkey: { toBase58: () => 'RandomPeer1111111111111111111111111111111111' } },
            ],
          },
        },
      },
      {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [
              { pubkey: { toBase58: () => 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' } },
              { pubkey: { toBase58: () => 'AnotherPeer11111111111111111111111111111111111' } },
            ],
          },
        },
      },
    ])

    const result = await executePrivacyScore({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
    })
    expect(result.action).toBe('privacyScore')
    expect(result.status).toBe('success')
    expect(result.score).toBeGreaterThanOrEqual(70)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.riskLevel).toBe('low')
    expect(result.exposurePoints).toBeDefined()
    expect(result.recommendations).toBeDefined()
  })

  it('returns low score for wallet interacting with exchanges', async () => {
    mockGetSignaturesForAddress.mockResolvedValue([
      { signature: 'tx1', blockTime: 1700000000 },
      { signature: 'tx2', blockTime: 1700000100 },
      { signature: 'tx3', blockTime: 1700000200 },
    ])
    mockGetParsedTransactions.mockResolvedValue([
      {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [
              { pubkey: { toBase58: () => 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' } },
              { pubkey: { toBase58: () => '5tzFkiKscMHkVPEGu4rS1dCUx6g9mCEbpXME2AcKJPpP' } },
            ],
          },
        },
      },
      {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [
              { pubkey: { toBase58: () => 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' } },
              { pubkey: { toBase58: () => 'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7TjN' } },
            ],
          },
        },
      },
      {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [
              { pubkey: { toBase58: () => 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' } },
              { pubkey: { toBase58: () => '5tzFkiKscMHkVPEGu4rS1dCUx6g9mCEbpXME2AcKJPpP' } },
            ],
          },
        },
      },
    ])

    const result = await executePrivacyScore({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
    })
    expect(result.score).toBeLessThan(60)
    expect(['medium', 'high', 'critical']).toContain(result.riskLevel)
    expect(result.exposurePoints.length).toBeGreaterThan(0)
    expect(result.exposurePoints.some((e: string) => e.includes('Binance'))).toBe(true)
  })

  it('handles empty wallet (no transactions)', async () => {
    mockGetSignaturesForAddress.mockResolvedValue([])
    mockGetParsedTransactions.mockResolvedValue([])

    const result = await executePrivacyScore({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
    })
    expect(result.score).toBe(100)
    expect(result.riskLevel).toBe('low')
    expect(result.message).toMatch(/no.*transaction/i)
  })

  it('throws when wallet is missing', async () => {
    await expect(executePrivacyScore({} as any)).rejects.toThrow(/wallet/i)
  })

  it('returns score between 0 and 100', async () => {
    mockGetSignaturesForAddress.mockResolvedValue([
      { signature: 'tx1', blockTime: 1700000000 },
    ])
    mockGetParsedTransactions.mockResolvedValue([
      {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [
              { pubkey: { toBase58: () => 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' } },
            ],
          },
        },
      },
    ])

    const result = await executePrivacyScore({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
    })
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })
})
