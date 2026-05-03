import { describe, it, expect, vi, beforeEach } from 'vitest'

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

const txBuilder = await import('../src/services/transaction-builder.js')

const {
  isTransferSupported,
  getSupportedTransferChains,
  buildPrivateTransfer,
} = await import('../src/services/chain-transfer-builder.js')

// Realistic test recipient meta-address (use real ed25519/secp256k1 hex)
// 32-byte ed25519 pubkey for solana/near
const SOLANA_SPENDING_KEY = '0x' + 'a'.repeat(64)
const SOLANA_VIEWING_KEY = '0x' + 'b'.repeat(64)

// 33-byte secp256k1 compressed pubkey for evm
const EVM_SPENDING_KEY = '0x02' + 'c'.repeat(64)
const EVM_VIEWING_KEY = '0x02' + 'd'.repeat(64)

const sender = 'SenderAddrXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'

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

describe('buildPrivateTransfer — Solana branch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('native SOL → calls buildAnchorShieldedSolTransfer with anchor instructionType', async () => {
    const result = await buildPrivateTransfer({
      sender,
      recipientMetaAddress: {
        spendingKey: SOLANA_SPENDING_KEY,
        viewingKey: SOLANA_VIEWING_KEY,
        chain: 'solana',
      },
      amount: '1000000',
    })

    expect(txBuilder.buildAnchorShieldedSolTransfer).toHaveBeenCalledOnce()
    expect(result.instructionType).toBe('anchor')
    expect(result.chain).toBe('solana')
    expect(result.curve).toBe('ed25519')
  })

  it('native SOL → falls back to system transfer when Anchor throws', async () => {
    vi.mocked(txBuilder.buildAnchorShieldedSolTransfer).mockRejectedValueOnce(
      new Error('CONFIG_PDA account not found')
    )

    const result = await buildPrivateTransfer({
      sender,
      recipientMetaAddress: {
        spendingKey: SOLANA_SPENDING_KEY,
        viewingKey: SOLANA_VIEWING_KEY,
        chain: 'solana',
      },
      amount: '1000000',
    })

    expect(txBuilder.buildShieldedSolTransfer).toHaveBeenCalledOnce()
    expect(result.instructionType).toBe('system')
  })

  it('SPL token (mint provided) → calls buildShieldedSplTransfer', async () => {
    const result = await buildPrivateTransfer({
      sender,
      recipientMetaAddress: {
        spendingKey: SOLANA_SPENDING_KEY,
        viewingKey: SOLANA_VIEWING_KEY,
        chain: 'solana',
      },
      amount: '500000',
      token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint
    })

    expect(txBuilder.buildShieldedSplTransfer).toHaveBeenCalledOnce()
    expect(result.chain).toBe('solana')
    if (result.chainData.type === 'solana') {
      expect(result.chainData.mint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
    }
  })
})
