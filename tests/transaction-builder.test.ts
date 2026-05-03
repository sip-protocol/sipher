import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Keypair, Transaction, SystemProgram, PublicKey } from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { makeConfigPDABytes } from './fixtures/builder-mocks.js'

// External controllable mock — Vitest hoists vi.mock above imports, but closures
// resolve at factory-invocation time (after this const is initialized)
const mockGetAccountInfo = vi.fn().mockResolvedValue(null)

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual<typeof import('@solana/web3.js')>('@solana/web3.js')
  return {
    ...(actual as object),
    Connection: vi.fn().mockImplementation(() => ({
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
      getSlot: vi.fn().mockResolvedValue(300_000_000),
      getLatestBlockhash: vi.fn().mockResolvedValue({
        blockhash: '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM',
        lastValidBlockHeight: 300_000_100,
      }),
      getAccountInfo: mockGetAccountInfo,
    })),
  }
})

const { buildShieldedSolTransfer, buildShieldedSplTransfer, buildAnchorShieldedSolTransfer } = await import('../src/services/transaction-builder.js')

const sender = Keypair.generate()
const stealth = Keypair.generate()
const senderAddress = sender.publicKey.toBase58()
const stealthAddress = stealth.publicKey.toBase58()

const mintPubkey = Keypair.generate().publicKey
const mintAddress = mintPubkey.toBase58()

const SIP_PRIVACY_PROGRAM_ID = new PublicKey('S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at')
const CONFIG_PDA = new PublicKey('BVawZkppFewygA5nxdrLma4ThKx8Th7bW4KTCkcWTZwZ')
const FEE_COLLECTOR = new PublicKey('S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd')
const SHIELDED_TRANSFER_DISCRIMINATOR = Buffer.from([0x9d, 0x2a, 0x42, 0x93, 0xee, 0x75, 0x61, 0x5c])

// Realistic hex inputs (sized to source's expected lengths)
const COMMITMENT_HEX_NO_PREFIX = '02' + 'a'.repeat(64) // 33 bytes = 66 hex chars
const BLINDING_HEX_NO_PREFIX = 'b'.repeat(64) // 32 bytes = 64 hex chars
const EPHEMERAL_HEX_NO_PREFIX = 'c'.repeat(64) // 32 bytes
const VKHASH_HEX_NO_PREFIX = 'd'.repeat(64) // 32 bytes

describe('buildShieldedSolTransfer', () => {
  it('builds SystemProgram.transfer with correct fromPubkey/toPubkey/lamports', async () => {
    const amount = 1_000_000n
    const txBase64 = await buildShieldedSolTransfer({
      sender: senderAddress,
      stealthAddress,
      amount,
    })

    const tx = Transaction.from(Buffer.from(txBase64, 'base64'))

    expect(tx.instructions).toHaveLength(1)
    const ix = tx.instructions[0]
    expect(ix.programId.equals(SystemProgram.programId)).toBe(true)

    // SystemProgram.transfer layout: [type u32LE=2][lamports u64LE]
    // ix.keys[0]=fromPubkey (writable, signer), ix.keys[1]=toPubkey (writable)
    expect(ix.data.readUInt32LE(0)).toBe(2) // SystemInstruction.Transfer = 2
    expect(ix.data.readBigUInt64LE(4)).toBe(amount)
    expect(ix.keys[0].pubkey.toBase58()).toBe(senderAddress)
    expect(ix.keys[1].pubkey.toBase58()).toBe(stealthAddress)
  })

  it('sets recentBlockhash and feePayer', async () => {
    const txBase64 = await buildShieldedSolTransfer({
      sender: senderAddress,
      stealthAddress,
      amount: 100_000n,
    })

    const tx = Transaction.from(Buffer.from(txBase64, 'base64'))
    expect(tx.recentBlockhash).toBe('4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM')
    expect(tx.feePayer?.toBase58()).toBe(senderAddress)
  })

  it('returns base64 string that deserializes to a valid Transaction', async () => {
    const txBase64 = await buildShieldedSolTransfer({
      sender: senderAddress,
      stealthAddress,
      amount: 50_000n,
    })

    expect(typeof txBase64).toBe('string')
    expect(() => Transaction.from(Buffer.from(txBase64, 'base64'))).not.toThrow()
  })
})

describe('buildShieldedSplTransfer', () => {
  beforeEach(() => {
    mockGetAccountInfo.mockReset()
  })

  it('creates ATA when stealth ATA does not exist', async () => {
    mockGetAccountInfo.mockResolvedValue(null)

    const txBase64 = await buildShieldedSplTransfer({
      sender: senderAddress,
      stealthAddress,
      mint: mintAddress,
      amount: 1_000_000n,
    })

    const tx = Transaction.from(Buffer.from(txBase64, 'base64'))
    expect(tx.instructions).toHaveLength(2)
    expect(tx.instructions[0].programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true)
    expect(tx.instructions[1].programId.equals(TOKEN_PROGRAM_ID)).toBe(true)
  })

  it('skips ATA creation when stealth ATA already exists', async () => {
    mockGetAccountInfo.mockResolvedValue({
      data: Buffer.alloc(0),
      executable: false,
      lamports: 1,
      owner: TOKEN_PROGRAM_ID,
    })

    const txBase64 = await buildShieldedSplTransfer({
      sender: senderAddress,
      stealthAddress,
      mint: mintAddress,
      amount: 1_000_000n,
    })

    const tx = Transaction.from(Buffer.from(txBase64, 'base64'))
    expect(tx.instructions).toHaveLength(1)
    expect(tx.instructions[0].programId.equals(TOKEN_PROGRAM_ID)).toBe(true)
  })

  it('derives sender ATA via getAssociatedTokenAddress(mint, sender)', async () => {
    mockGetAccountInfo.mockResolvedValue(null)

    const expectedSenderATA = await getAssociatedTokenAddress(mintPubkey, sender.publicKey)

    const txBase64 = await buildShieldedSplTransfer({
      sender: senderAddress,
      stealthAddress,
      mint: mintAddress,
      amount: 500_000n,
    })

    const tx = Transaction.from(Buffer.from(txBase64, 'base64'))
    const transferIx = tx.instructions.find(ix => ix.programId.equals(TOKEN_PROGRAM_ID))!
    expect(transferIx.keys[0].pubkey.equals(expectedSenderATA)).toBe(true)
  })

  it('uses allowOwnerOffCurve=true for stealth ATA derivation', async () => {
    mockGetAccountInfo.mockResolvedValue(null)

    const expectedStealthATA = await getAssociatedTokenAddress(
      mintPubkey,
      stealth.publicKey,
      true,
    )

    const txBase64 = await buildShieldedSplTransfer({
      sender: senderAddress,
      stealthAddress,
      mint: mintAddress,
      amount: 750_000n,
    })

    const tx = Transaction.from(Buffer.from(txBase64, 'base64'))
    const transferIx = tx.instructions.find(ix => ix.programId.equals(TOKEN_PROGRAM_ID))!
    expect(transferIx.keys[1].pubkey.equals(expectedStealthATA)).toBe(true)
  })
})

describe('buildAnchorShieldedSolTransfer', () => {
  beforeEach(() => {
    mockGetAccountInfo.mockClear()
  })

  it('throws when CONFIG_PDA account is not found', async () => {
    mockGetAccountInfo.mockResolvedValue(null)

    await expect(
      buildAnchorShieldedSolTransfer({
        sender: senderAddress,
        stealthAddress,
        amount: 1_000_000n,
        commitment: '0x' + COMMITMENT_HEX_NO_PREFIX,
        blindingFactor: '0x' + BLINDING_HEX_NO_PREFIX,
        ephemeralPublicKey: '0x' + EPHEMERAL_HEX_NO_PREFIX,
        viewingKeyHash: '0x' + VKHASH_HEX_NO_PREFIX,
      })
    ).rejects.toThrow(/CONFIG_PDA account not found/)
  })

  it('parses total_transfers correctly when counter = 0', async () => {
    mockGetAccountInfo.mockResolvedValue({ data: makeConfigPDABytes(0n) })

    const result = await buildAnchorShieldedSolTransfer({
      sender: senderAddress,
      stealthAddress,
      amount: 1_000_000n,
      commitment: '0x' + COMMITMENT_HEX_NO_PREFIX,
      blindingFactor: '0x' + BLINDING_HEX_NO_PREFIX,
      ephemeralPublicKey: '0x' + EPHEMERAL_HEX_NO_PREFIX,
      viewingKeyHash: '0x' + VKHASH_HEX_NO_PREFIX,
    })

    expect(result.instructionType).toBe('anchor')
    expect(typeof result.noteId).toBe('string')
    expect(result.noteId.length).toBeGreaterThan(0)
  })

  it('parses total_transfers correctly when counter = 42', async () => {
    mockGetAccountInfo.mockResolvedValue({ data: makeConfigPDABytes(42n) })

    const result = await buildAnchorShieldedSolTransfer({
      sender: senderAddress,
      stealthAddress,
      amount: 1_000_000n,
      commitment: '0x' + COMMITMENT_HEX_NO_PREFIX,
      blindingFactor: '0x' + BLINDING_HEX_NO_PREFIX,
      ephemeralPublicKey: '0x' + EPHEMERAL_HEX_NO_PREFIX,
      viewingKeyHash: '0x' + VKHASH_HEX_NO_PREFIX,
    })

    expect(result.instructionType).toBe('anchor')
    expect(result.noteId.length).toBeGreaterThan(0)
  })

  it('parses total_transfers correctly when counter near MAX_SAFE_INTEGER', async () => {
    const maxCounter = (2n ** 53n) - 1n
    mockGetAccountInfo.mockResolvedValue({ data: makeConfigPDABytes(maxCounter) })

    const result = await buildAnchorShieldedSolTransfer({
      sender: senderAddress,
      stealthAddress,
      amount: 1_000_000n,
      commitment: '0x' + COMMITMENT_HEX_NO_PREFIX,
      blindingFactor: '0x' + BLINDING_HEX_NO_PREFIX,
      ephemeralPublicKey: '0x' + EPHEMERAL_HEX_NO_PREFIX,
      viewingKeyHash: '0x' + VKHASH_HEX_NO_PREFIX,
    })

    expect(result.instructionType).toBe('anchor')
  })

  it('derives transferRecordPDA from [TRANSFER_RECORD_SEED, sender, counter_le_bytes]', async () => {
    const counter = 7n
    mockGetAccountInfo.mockResolvedValue({ data: makeConfigPDABytes(counter) })

    const TRANSFER_RECORD_SEED = Buffer.from('transfer_record')
    const counterLeBytes = Buffer.alloc(8)
    counterLeBytes.writeBigUInt64LE(counter, 0)

    const [expectedPDA] = PublicKey.findProgramAddressSync(
      [TRANSFER_RECORD_SEED, sender.publicKey.toBuffer(), counterLeBytes],
      SIP_PRIVACY_PROGRAM_ID,
    )

    const result = await buildAnchorShieldedSolTransfer({
      sender: senderAddress,
      stealthAddress,
      amount: 1_000_000n,
      commitment: '0x' + COMMITMENT_HEX_NO_PREFIX,
      blindingFactor: '0x' + BLINDING_HEX_NO_PREFIX,
      ephemeralPublicKey: '0x' + EPHEMERAL_HEX_NO_PREFIX,
      viewingKeyHash: '0x' + VKHASH_HEX_NO_PREFIX,
    })

    expect(result.noteId).toBe(expectedPDA.toBase58())
  })

  it('packs instruction data with correct byte layout at exact offsets', async () => {
    mockGetAccountInfo.mockResolvedValue({ data: makeConfigPDABytes(0n) })

    const amount = 12345n
    const result = await buildAnchorShieldedSolTransfer({
      sender: senderAddress,
      stealthAddress,
      amount,
      commitment: '0x' + COMMITMENT_HEX_NO_PREFIX,
      blindingFactor: '0x' + BLINDING_HEX_NO_PREFIX,
      ephemeralPublicKey: '0x' + EPHEMERAL_HEX_NO_PREFIX,
      viewingKeyHash: '0x' + VKHASH_HEX_NO_PREFIX,
    })

    const tx = Transaction.from(Buffer.from(result.transaction, 'base64'))
    expect(tx.instructions).toHaveLength(1)
    const ix = tx.instructions[0]
    expect(ix.programId.equals(SIP_PRIVACY_PROGRAM_ID)).toBe(true)

    const data = ix.data
    expect(data.length).toBe(8 + 33 + 32 + 32 + 32 + 8 + 128 + 8) // 281

    // Byte-precise offset checks
    expect(data.subarray(0, 8).equals(SHIELDED_TRANSFER_DISCRIMINATOR)).toBe(true)
    expect(data.subarray(8, 41).toString('hex')).toBe(COMMITMENT_HEX_NO_PREFIX)
    expect(data.subarray(41, 73).equals(stealth.publicKey.toBytes())).toBe(true)
    expect(data.subarray(73, 105).toString('hex')).toBe(EPHEMERAL_HEX_NO_PREFIX)
    expect(data.subarray(105, 137).toString('hex')).toBe(VKHASH_HEX_NO_PREFIX)
    // amount at end (8 bytes LE)
    const amountBytes = data.subarray(273, 281)
    const amountReadback = amountBytes.readBigUInt64LE(0)
    expect(amountReadback).toBe(amount)

    // Verify accounts
    expect(ix.keys[0].pubkey.equals(CONFIG_PDA)).toBe(true)
    expect(ix.keys[2].pubkey.equals(sender.publicKey)).toBe(true)
    expect(ix.keys[3].pubkey.equals(stealth.publicKey)).toBe(true)
    expect(ix.keys[4].pubkey.equals(FEE_COLLECTOR)).toBe(true)
    expect(ix.keys[5].pubkey.equals(SystemProgram.programId)).toBe(true)
  })

  it.each([
    ['with 0x prefix', true],
    ['without 0x prefix', false],
  ])('handles hex inputs %s consistently', async (_label, withPrefix) => {
    mockGetAccountInfo.mockResolvedValue({ data: makeConfigPDABytes(0n) })

    const prefix = withPrefix ? '0x' : ''
    const result = await buildAnchorShieldedSolTransfer({
      sender: senderAddress,
      stealthAddress,
      amount: 1_000_000n,
      commitment: prefix + COMMITMENT_HEX_NO_PREFIX,
      blindingFactor: prefix + BLINDING_HEX_NO_PREFIX,
      ephemeralPublicKey: prefix + EPHEMERAL_HEX_NO_PREFIX,
      viewingKeyHash: prefix + VKHASH_HEX_NO_PREFIX,
    })

    const tx = Transaction.from(Buffer.from(result.transaction, 'base64'))
    const data = tx.instructions[0].data

    // Byte content should be identical regardless of prefix presence
    expect(data.subarray(8, 41).toString('hex')).toBe(COMMITMENT_HEX_NO_PREFIX)
    expect(data.subarray(73, 105).toString('hex')).toBe(EPHEMERAL_HEX_NO_PREFIX)
    expect(data.subarray(105, 137).toString('hex')).toBe(VKHASH_HEX_NO_PREFIX)
  })
})
