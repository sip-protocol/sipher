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

// 33-byte secp256k1 compressed pubkeys for evm (valid curve points)
const EVM_SPENDING_KEY = '0x02acf11ab16a2ff3306993b16294b9885e721758656537728a4d46d7721828bb56'
const EVM_VIEWING_KEY = '0x0264c15fa5af8fd6cea8c3450871a907cb4ae531fb18c69c8598f58226b1754379'

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
    expect(result.chainData.type).toBe('solana')
    if (result.chainData.type === 'solana') {
      expect(result.chainData.mint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
    }
  })
})

describe('buildPrivateTransfer — EVM branch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const evmChainsWithIds: Array<[string, number]> = [
    ['ethereum', 1],
    ['polygon', 137],
    ['arbitrum', 42161],
    ['optimism', 10],
    ['base', 8453],
  ]

  it.each(evmChainsWithIds)('native ETH on %s returns {to, value, data:0x}', async (chain, _chainId) => {
    const result = await buildPrivateTransfer({
      sender,
      recipientMetaAddress: {
        spendingKey: EVM_SPENDING_KEY,
        viewingKey: EVM_VIEWING_KEY,
        chain,
      },
      amount: '1000000000000000000', // 1 ETH in wei
    })

    expect(result.chainData.type).toBe('evm')
    if (result.chainData.type === 'evm') {
      expect(result.chainData.to.toLowerCase()).toMatch(/^0x[0-9a-f]{40}$/)
      expect(result.chainData.value).toBe('1000000000000000000')
      expect(result.chainData.data).toBe('0x')
    }
  })

  it('ERC20 → data starts with 0xa9059cbb + padded address + padded amount', async () => {
    const tokenContract = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' // USDC on ETH
    const amount = '1000000' // 1 USDC

    const result = await buildPrivateTransfer({
      sender,
      recipientMetaAddress: {
        spendingKey: EVM_SPENDING_KEY,
        viewingKey: EVM_VIEWING_KEY,
        chain: 'ethereum',
      },
      amount,
      token: tokenContract,
    })

    expect(result.chainData.type).toBe('evm')
    if (result.chainData.type === 'evm') {
      expect(result.chainData.to).toBe(tokenContract)
      expect(result.chainData.tokenContract).toBe(tokenContract)
      expect(result.chainData.value).toBe('0')
      expect(result.chainData.data.startsWith('0xa9059cbb')).toBe(true)
      expect(result.chainData.data.length).toBe(2 + 8 + 64 + 64)

      const amountHex = result.chainData.data.slice(2 + 8 + 64)
      const amountReadback = BigInt('0x' + amountHex)
      expect(amountReadback).toBe(BigInt(amount))
    }
  })

  it.each(evmChainsWithIds)('sets correct chainId for %s → %i', async (chain, chainId) => {
    const result = await buildPrivateTransfer({
      sender,
      recipientMetaAddress: {
        spendingKey: EVM_SPENDING_KEY,
        viewingKey: EVM_VIEWING_KEY,
        chain,
      },
      amount: '1000',
    })

    expect(result.chainData.type).toBe('evm')
    if (result.chainData.type === 'evm') {
      expect(result.chainData.chainId).toBe(chainId)
    }
  })
})
