// packages/agent/tests/send.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  makeBuildPrivateSendTxResult,
  makeMockMint,
  makeStealthAddress,
  makeCommitResult,
  makeVaultConfig,
  VALID_WALLET,
  VALID_RECIPIENT,
  VALID_STEALTH_META_ADDRESS,
  VALID_VIEWING_KEY_HEX,
  VALID_SPENDING_KEY_HEX,
  SOL_MINT,
} from './fixtures/user-tool-mocks.js'

const {
  mockBuildPrivateSendTx,
  mockCreateConnection,
  mockResolveTokenMint,
  mockGetTokenDecimals,
  mockToBaseUnits,
  mockGetVaultConfig,
  mockGetAssociatedTokenAddress,
  mockGenerateEd25519StealthAddress,
  mockEd25519PublicKeyToSolanaAddress,
  mockCommit,
} = vi.hoisted(() => ({
  mockBuildPrivateSendTx: vi.fn(),
  mockCreateConnection: vi.fn(),
  mockResolveTokenMint: vi.fn(),
  mockGetTokenDecimals: vi.fn(),
  mockToBaseUnits: vi.fn(),
  mockGetVaultConfig: vi.fn(),
  mockGetAssociatedTokenAddress: vi.fn(),
  mockGenerateEd25519StealthAddress: vi.fn(),
  mockEd25519PublicKeyToSolanaAddress: vi.fn(),
  mockCommit: vi.fn(),
}))

vi.mock('@sipher/sdk', () => ({
  createConnection: mockCreateConnection,
  buildPrivateSendTx: mockBuildPrivateSendTx,
  resolveTokenMint: mockResolveTokenMint,
  getTokenDecimals: mockGetTokenDecimals,
  toBaseUnits: mockToBaseUnits,
  fromBaseUnits: (amount: bigint, decimals: number) => {
    const divisor = 10n ** BigInt(decimals)
    const whole = amount / divisor
    const frac = amount % divisor
    return frac === 0n ? whole.toString() : `${whole}.${frac.toString().padStart(decimals, '0').replace(/0+$/, '')}`
  },
  getVaultConfig: mockGetVaultConfig,
  DEFAULT_FEE_BPS: 10,
}))

vi.mock('@sip-protocol/sdk', () => ({
  generateEd25519StealthAddress: mockGenerateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress: mockEd25519PublicKeyToSolanaAddress,
  commit: mockCommit,
}))

vi.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddress: mockGetAssociatedTokenAddress,
}))

import { sendTool, executeSend } from '../src/tools/send.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateConnection.mockReturnValue({})
  mockResolveTokenMint.mockReturnValue(makeMockMint(SOL_MINT))
  mockGetTokenDecimals.mockReturnValue(9)
  mockToBaseUnits.mockReturnValue(1_500_000_000n)
  mockGetVaultConfig.mockResolvedValue(makeVaultConfig())
  mockGetAssociatedTokenAddress.mockResolvedValue({ toBase58: () => VALID_RECIPIENT })
  mockGenerateEd25519StealthAddress.mockReturnValue(makeStealthAddress())
  mockEd25519PublicKeyToSolanaAddress.mockReturnValue(VALID_RECIPIENT)
  mockCommit.mockReturnValue(makeCommitResult())
})

describe('sendTool definition', () => {
  it('has correct name', () => {
    expect(sendTool.name).toBe('send')
  })

  it('declares required amount, token, recipient — wallet/memo optional', () => {
    expect(sendTool.input_schema.required).toEqual(['amount', 'token', 'recipient'])
    expect(sendTool.input_schema.properties).toHaveProperty('wallet')
    expect(sendTool.input_schema.properties).toHaveProperty('memo')
  })
})

describe('executeSend — input validation', () => {
  it('rejects amount <= 0', async () => {
    await expect(
      executeSend({ amount: 0, token: 'SOL', recipient: VALID_RECIPIENT })
    ).rejects.toThrow(/amount must be greater than zero/i)
  })

  it('rejects negative amount', async () => {
    await expect(
      executeSend({ amount: -1, token: 'SOL', recipient: VALID_RECIPIENT })
    ).rejects.toThrow(/amount must be greater than zero/i)
  })

  it('rejects empty token', async () => {
    await expect(
      executeSend({ amount: 1, token: '', recipient: VALID_RECIPIENT })
    ).rejects.toThrow(/token symbol is required/i)
  })

  it('rejects empty recipient', async () => {
    await expect(
      executeSend({ amount: 1, token: 'SOL', recipient: '' })
    ).rejects.toThrow(/recipient address is required/i)
  })

  it('rejects whitespace-only recipient', async () => {
    await expect(
      executeSend({ amount: 1, token: 'SOL', recipient: '   ' })
    ).rejects.toThrow(/recipient address is required/i)
  })

  it('rejects invalid wallet base58', async () => {
    await expect(
      executeSend({
        amount: 1,
        token: 'SOL',
        recipient: VALID_RECIPIENT,
        wallet: 'not-real-!!',
      })
    ).rejects.toThrow(/invalid wallet address/i)
  })

  it('rejects invalid raw base58 recipient (when wallet provided)', async () => {
    await expect(
      executeSend({
        amount: 1,
        token: 'SOL',
        recipient: 'not-a-real-pubkey-!!',
        wallet: VALID_WALLET,
      })
    ).rejects.toThrow(/invalid recipient address/i)
  })
})

describe('executeSend — stealth meta-address validation', () => {
  it('rejects malformed sip:solana: prefix (wrong parts count)', async () => {
    await expect(
      executeSend({
        amount: 1,
        token: 'SOL',
        recipient: 'sip:solana:0xfoo',
        wallet: VALID_WALLET,
      })
    ).rejects.toThrow(/invalid stealth meta-address/i)
  })

  it('rejects sip:solana: with empty spending key', async () => {
    await expect(
      executeSend({
        amount: 1,
        token: 'SOL',
        recipient: `sip:solana::0x${VALID_VIEWING_KEY_HEX}`,
        wallet: VALID_WALLET,
      })
    ).rejects.toThrow(/invalid stealth meta-address/i)
  })

  it('rejects keys without 0x prefix', async () => {
    await expect(
      executeSend({
        amount: 1,
        token: 'SOL',
        recipient: `sip:solana:${VALID_SPENDING_KEY_HEX}:${VALID_VIEWING_KEY_HEX}`,
        wallet: VALID_WALLET,
      })
    ).rejects.toThrow(/0x-prefixed/i)
  })
})

describe('executeSend — preview path (no wallet)', () => {
  it('returns prepared shape without building tx, using on-chain feeBps', async () => {
    mockGetVaultConfig.mockResolvedValueOnce(makeVaultConfig({ feeBps: 25 }))

    const result = await executeSend({
      amount: 1.5,
      token: 'SOL',
      recipient: VALID_RECIPIENT,
    })

    expect(result.action).toBe('send')
    expect(result.amount).toBe(1.5)
    expect(result.token).toBe('SOL')
    expect(result.recipient).toBe(VALID_RECIPIENT)
    expect(result.status).toBe('awaiting_signature')
    expect(result.serializedTx).toBeNull()
    expect(result.privacy.feeBps).toBe(25)
    expect(result.privacy.stealthAddress).toBe('<derived-at-execution>')
    expect(result.privacy.netAmount).toBeNull()
    expect(result.message).toContain('0.25%')
    expect(result.message).toContain('Connect wallet')
  })

  it('falls back to DEFAULT_FEE_BPS when getVaultConfig returns null', async () => {
    mockGetVaultConfig.mockResolvedValueOnce(null)

    const result = await executeSend({
      amount: 1,
      token: 'SOL',
      recipient: VALID_RECIPIENT,
    })

    expect(result.privacy.feeBps).toBe(10)
  })

  it('does not call buildPrivateSendTx in preview', async () => {
    await executeSend({
      amount: 1,
      token: 'SOL',
      recipient: VALID_RECIPIENT,
    })

    expect(mockBuildPrivateSendTx).not.toHaveBeenCalled()
  })
})

describe('executeSend — full path with stealth meta-address', () => {
  it('builds tx, derives stealth address, and computes commitment', async () => {
    mockBuildPrivateSendTx.mockResolvedValueOnce(makeBuildPrivateSendTxResult())

    const result = await executeSend({
      amount: 1.5,
      token: 'SOL',
      recipient: VALID_STEALTH_META_ADDRESS,
      wallet: VALID_WALLET,
    })

    expect(result.action).toBe('send')
    expect(result.privacy.stealthAddress).toBe(VALID_RECIPIENT)
    expect(result.privacy.commitmentGenerated).toBe(true)
    expect(result.privacy.viewingKeyHashIncluded).toBe(true)
    expect(result.privacy.estimatedFee).toContain('SOL')
    expect(result.privacy.netAmount).toBe('0.999')
    expect(result.serializedTx).toBe(
      Buffer.from('FAKE_SEND_TX_BYTES').toString('base64')
    )
    expect(result.message).toContain('Awaiting wallet signature')
  })

  it('calls generateEd25519StealthAddress with the parsed meta-address', async () => {
    mockBuildPrivateSendTx.mockResolvedValueOnce(makeBuildPrivateSendTxResult())

    await executeSend({
      amount: 1,
      token: 'SOL',
      recipient: VALID_STEALTH_META_ADDRESS,
      wallet: VALID_WALLET,
    })

    expect(mockGenerateEd25519StealthAddress).toHaveBeenCalledTimes(1)
    const arg = mockGenerateEd25519StealthAddress.mock.calls[0][0]
    expect(arg.spendingKey).toBe(`0x${VALID_SPENDING_KEY_HEX}`)
    expect(arg.viewingKey).toBe(`0x${VALID_VIEWING_KEY_HEX}`)
    expect(arg.chain).toBe('solana')
  })

  it('calls commit() to generate Pedersen commitment', async () => {
    mockBuildPrivateSendTx.mockResolvedValueOnce(makeBuildPrivateSendTxResult())

    await executeSend({
      amount: 1.5,
      token: 'SOL',
      recipient: VALID_STEALTH_META_ADDRESS,
      wallet: VALID_WALLET,
    })

    expect(mockCommit).toHaveBeenCalledTimes(1)
    expect(mockCommit).toHaveBeenCalledWith(1_500_000_000n)
  })

  it('passes encrypted amount as non-empty Uint8Array to buildPrivateSendTx', async () => {
    mockBuildPrivateSendTx.mockResolvedValueOnce(makeBuildPrivateSendTxResult())

    await executeSend({
      amount: 1,
      token: 'SOL',
      recipient: VALID_STEALTH_META_ADDRESS,
      wallet: VALID_WALLET,
    })

    const call = mockBuildPrivateSendTx.mock.calls[0][0]
    expect(call.encryptedAmount).toBeInstanceOf(Uint8Array)
    expect(call.encryptedAmount.length).toBe(80)
  })
})

describe('executeSend — full path with raw base58 recipient', () => {
  it('builds tx using zero-filled crypto params', async () => {
    mockBuildPrivateSendTx.mockResolvedValueOnce(makeBuildPrivateSendTxResult())

    const result = await executeSend({
      amount: 1.5,
      token: 'SOL',
      recipient: VALID_RECIPIENT,
      wallet: VALID_WALLET,
    })

    expect(result.privacy.stealthAddress).toBe(VALID_RECIPIENT)
    expect(result.privacy.commitmentGenerated).toBe(false)
    expect(result.privacy.viewingKeyHashIncluded).toBe(false)
    expect(result.serializedTx).toBe(
      Buffer.from('FAKE_SEND_TX_BYTES').toString('base64')
    )
  })

  it('does not call generateEd25519StealthAddress for raw base58 recipient', async () => {
    mockBuildPrivateSendTx.mockResolvedValueOnce(makeBuildPrivateSendTxResult())

    await executeSend({
      amount: 1,
      token: 'SOL',
      recipient: VALID_RECIPIENT,
      wallet: VALID_WALLET,
    })

    expect(mockGenerateEd25519StealthAddress).not.toHaveBeenCalled()
    expect(mockCommit).not.toHaveBeenCalled()
  })

  it('passes empty Uint8Array for encryptedAmount in raw-base58 path', async () => {
    mockBuildPrivateSendTx.mockResolvedValueOnce(makeBuildPrivateSendTxResult())

    await executeSend({
      amount: 1,
      token: 'SOL',
      recipient: VALID_RECIPIENT,
      wallet: VALID_WALLET,
    })

    const call = mockBuildPrivateSendTx.mock.calls[0][0]
    expect(call.encryptedAmount).toBeInstanceOf(Uint8Array)
    expect(call.encryptedAmount.length).toBe(0)
  })
})

describe('executeSend — service interaction', () => {
  it('propagates buildPrivateSendTx errors', async () => {
    mockBuildPrivateSendTx.mockRejectedValueOnce(new Error('insufficient available balance'))

    await expect(
      executeSend({
        amount: 1,
        token: 'SOL',
        recipient: VALID_RECIPIENT,
        wallet: VALID_WALLET,
      })
    ).rejects.toThrow(/insufficient available balance/i)
  })

  it('uppercases token in result', async () => {
    mockBuildPrivateSendTx.mockResolvedValueOnce(makeBuildPrivateSendTxResult())

    const result = await executeSend({
      amount: 1,
      token: 'usdc',
      recipient: VALID_RECIPIENT,
      wallet: VALID_WALLET,
    })

    expect(result.token).toBe('USDC')
  })
})
