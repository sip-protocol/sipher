import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Keypair, Transaction, SystemProgram, PublicKey } from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'

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

const { buildShieldedSolTransfer, buildShieldedSplTransfer } = await import('../src/services/transaction-builder.js')

const sender = Keypair.generate()
const stealth = Keypair.generate()
const senderAddress = sender.publicKey.toBase58()
const stealthAddress = stealth.publicKey.toBase58()

const mintPubkey = Keypair.generate().publicKey
const mintAddress = mintPubkey.toBase58()

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
