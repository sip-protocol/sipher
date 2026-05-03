import { describe, it, expect, vi } from 'vitest'
import { Keypair, Transaction, SystemProgram } from '@solana/web3.js'

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
      getAccountInfo: vi.fn().mockResolvedValue(null),
    })),
  }
})

const { buildShieldedSolTransfer } = await import('../src/services/transaction-builder.js')

const sender = Keypair.generate()
const stealth = Keypair.generate()
const senderAddress = sender.publicKey.toBase58()
const stealthAddress = stealth.publicKey.toBase58()

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
