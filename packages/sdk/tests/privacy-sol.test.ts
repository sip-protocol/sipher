import { describe, it, expect } from 'vitest'
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js'
import {
  buildPrivateSendSolTx,
  deriveVaultConfigPDA,
  deriveDepositRecordPDA,
  deriveSolVaultPDA,
  deriveSolFeePDA,
  anchorDiscriminator,
  NATIVE_SOL_MINT,
  SIP_PRIVACY_PROGRAM_ID,
} from '../src/index.js'
import { SIP_CONFIG_SEED } from '../src/config.js'

const BLOCKHASH = 'GfVcyD4kkTrj4bKc7WA9sZCin9JDbdT458zqL4zjxx2v'
const DEPOSITOR = new PublicKey('FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr')
const STEALTH = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')

const commitment = new Uint8Array(33).fill(2)
const ephemeral = new Uint8Array(33).fill(3)
const vkHash = new Uint8Array(32).fill(4)
const encrypted = new Uint8Array([9, 9, 9])
const proof = new Uint8Array([])

// Dispatching Connection stub. fee_tenths_bps lives at config offset 40 (u16 LE);
// sip total_transfers at offset 8+32+2+1 = 43 (u64 LE).
function mockConn(opts: {
  feeTenthsBps?: number
  stealthLamports?: number | null
  rentExemptMin?: number
} = {}): Connection {
  const { feeTenthsBps = 100, stealthLamports = null, rentExemptMin = 890_880 } = opts
  const configBuf = Buffer.alloc(60)
  configBuf.writeUInt16LE(feeTenthsBps, 40)
  const sipBuf = Buffer.alloc(8 + 32 + 2 + 1 + 8) // total_transfers = 0
  const [cfg] = deriveVaultConfigPDA()
  const [sip] = PublicKey.findProgramAddressSync([SIP_CONFIG_SEED], SIP_PRIVACY_PROGRAM_ID)
  return {
    getLatestBlockhash: async () => ({ blockhash: BLOCKHASH, lastValidBlockHeight: 1 }),
    getMinimumBalanceForRentExemption: async () => rentExemptMin,
    getAccountInfo: async (pk: PublicKey) => {
      if (pk.equals(cfg)) return { data: configBuf } as never
      if (pk.equals(sip)) return { data: sipBuf } as never
      if (stealthLamports === null) return null
      return { lamports: stealthLamports, data: Buffer.alloc(0) } as never
    },
  } as unknown as Connection
}

const baseParams = {
  depositor: DEPOSITOR,
  amount: 2_000_000n,
  stealthPubkey: STEALTH,
  amountCommitment: commitment,
  ephemeralPubkey: ephemeral,
  viewingKeyHash: vkHash,
  encryptedAmount: encrypted,
  proof,
}

describe('buildPrivateSendSolTx', () => {
  it('builds withdraw_private_sol with the exact 10-account order + flags', async () => {
    // stealth pre-funded above the rent floor so the guard passes
    const res = await buildPrivateSendSolTx({
      ...baseParams,
      connection: mockConn({ stealthLamports: 1_000_000_000 }),
    })
    const ix = res.transaction.instructions[0]
    const [config] = deriveVaultConfigPDA()
    const [record] = deriveDepositRecordPDA(DEPOSITOR, NATIVE_SOL_MINT)
    const [solVault] = deriveSolVaultPDA()
    const [solFee] = deriveSolFeePDA()
    const [sipConfig] = PublicKey.findProgramAddressSync([SIP_CONFIG_SEED], SIP_PRIVACY_PROGRAM_ID)

    expect(ix.keys.length).toBe(10)
    expect(ix.keys.slice(0, 6).map((k) => k.pubkey.toBase58())).toEqual([
      config.toBase58(),
      record.toBase58(),
      solVault.toBase58(),
      solFee.toBase58(),
      STEALTH.toBase58(),
      DEPOSITOR.toBase58(),
    ])
    expect(ix.keys[8].pubkey.toBase58()).toBe(SIP_PRIVACY_PROGRAM_ID.toBase58())
    expect(ix.keys[9].pubkey.toBase58()).toBe(SystemProgram.programId.toBase58())
    // only depositor (index 5) signs
    expect(ix.keys.map((k) => k.isSigner)).toEqual([
      false, false, false, false, false, true, false, false, false, false,
    ])
    // config(ro), sip_program(ro), system(ro) are non-writable; the rest writable
    expect(ix.keys.map((k) => k.isWritable)).toEqual([
      false, true, true, true, true, true, true, true, false, false,
    ])
    expect(ix.keys[6].pubkey.equals(sipConfig)).toBe(true)
  })

  it('encodes the discriminator + amount and computes fee/net from config', async () => {
    const res = await buildPrivateSendSolTx({
      ...baseParams,
      connection: mockConn({ feeTenthsBps: 10, stealthLamports: 1_000_000_000 }),
    })
    const data = res.transaction.instructions[0].data
    expect(data.subarray(0, 8).equals(anchorDiscriminator('withdraw_private_sol'))).toBe(true)
    expect(data.readBigUInt64LE(8)).toBe(2_000_000n)
    // 10 tenths-bps (0.1 bps) of 2_000_000 = 200
    expect(res.feeAmount).toBe(200n)
    expect(res.netAmount).toBe(1_999_800n)
    expect(res.stealthAddress.toBase58()).toBe(STEALTH.toBase58())
  })

  it('computes the fee at tenths-bps precision (÷100_000, not ÷10_000)', async () => {
    // 7.5 bps = 75 tenths on 2_000_000 → 1_500 (old whole-bps code gives 15_000)
    const res = await buildPrivateSendSolTx({
      ...baseParams,
      connection: mockConn({ feeTenthsBps: 75, stealthLamports: 1_000_000_000 }),
    })
    expect(res.feeAmount).toBe(1_500n)
    expect(res.netAmount).toBe(1_998_500n)
  })

  it('throws when a fresh stealth recipient would be left below rent-exempt', async () => {
    // stealth does not exist (0 lamports); net 1_998_000 < 890_880? No — so make the
    // payout tiny: amount 1000 => net 999 < rent floor => must throw.
    await expect(
      buildPrivateSendSolTx({
        ...baseParams,
        amount: 1_000n,
        connection: mockConn({ stealthLamports: null }),
      }),
    ).rejects.toThrow('rent-exempt minimum')
  })

  it('passes when the stealth recipient is already rent-exempt', async () => {
    const res = await buildPrivateSendSolTx({
      ...baseParams,
      amount: 1_000n,
      connection: mockConn({ stealthLamports: 890_880 }),
    })
    expect(res.transaction.instructions).toHaveLength(1)
  })

  it('rejects malformed crypto field lengths', async () => {
    await expect(
      buildPrivateSendSolTx({
        ...baseParams,
        amountCommitment: new Uint8Array(32), // wrong length
        connection: mockConn({ stealthLamports: 1_000_000_000 }),
      }),
    ).rejects.toThrow('amountCommitment must be 33 bytes')
  })
})
