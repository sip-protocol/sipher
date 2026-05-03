import { describe, it, expect, vi } from 'vitest'

// Mock transaction-builder.js BEFORE importing chain-transfer-builder
vi.mock('../src/services/transaction-builder.js', () => ({
  buildShieldedSolTransfer: vi.fn().mockResolvedValue('mockedSolTxBase64'),
  buildShieldedSplTransfer: vi.fn().mockResolvedValue('mockedSplTxBase64'),
  buildAnchorShieldedSolTransfer: vi.fn().mockResolvedValue({
    transaction: 'mockedAnchorTxBase64',
    noteId: 'mockedNoteIdPDA',
    encryptedAmount: '0xdeadbeefcafebabe',
    instructionType: 'anchor' as const,
  }),
}))

const {
  isTransferSupported,
  getSupportedTransferChains,
} = await import('../src/services/chain-transfer-builder.js')

describe('isTransferSupported', () => {
  it.each([
    'solana',
    'ethereum',
    'polygon',
    'arbitrum',
    'optimism',
    'base',
    'near',
  ])('returns true for supported chain: %s', (chain) => {
    expect(isTransferSupported(chain)).toBe(true)
  })

  it('returns false for unsupported chain', () => {
    expect(isTransferSupported('bitcoin')).toBe(false)
  })
})

describe('getSupportedTransferChains', () => {
  it('returns array containing all 7 supported chains', () => {
    const chains = getSupportedTransferChains()
    expect(chains).toHaveLength(7)
    expect(chains).toEqual(
      expect.arrayContaining([
        'solana',
        'ethereum',
        'polygon',
        'arbitrum',
        'optimism',
        'base',
        'near',
      ])
    )
    expect(chains).not.toContain('bitcoin')  // Symmetry with isTransferSupported negative test
    expect(chains).not.toBe(getSupportedTransferChains())  // Returns a fresh array (immutability guard)
  })
})
