import { describe, it, expect } from 'vitest'
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
} from '@solana/web3.js'
import {
  deriveVaultConfigPDA, deriveDepositRecordPDA, NATIVE_SOL_MINT,
} from '@sipher/sdk'
import { SipherVaultPrivacyProvider } from '../src/provider.js'

const BLOCKHASH = 'GfVcyD4kkTrj4bKc7WA9sZCin9JDbdT458zqL4zjxx2v'
const DEPOSITOR_KP = Keypair.generate()

// Mock Connection: dispatches getAccountInfo by pubkey (config carries fee_bps at
// offset 40); records the last raw tx submitted; returns a deterministic signature.
function mockConn(opts: { feeBps?: number; recordBalance?: bigint } = {}): Connection {
  const { feeBps = 10, recordBalance = 5_000_000n } = opts
  // VaultConfig layout (60-byte fixed prefix, but deserializeVaultConfig needs 68 — pad to 68+):
  // disc(8) + authority(32) + fee_bps(u16 at offset 40) + ...
  const configBuf = Buffer.alloc(68); configBuf.writeUInt16LE(feeBps, 40)
  // DepositRecord layout: disc(8)+depositor(32)+mint(32)+balance(u64 LE at 72)+
  //   cumulativeVolume(u64)+lastDepositAt(i64)+bump(u8) = 97 bytes total.
  // deserializeDepositRecord requires exactly 97 bytes minimum.
  const recordBuf = Buffer.alloc(8 + 32 + 32 + 8 + 8 + 8 + 1)
  recordBuf.writeBigUInt64LE(recordBalance, 72)
  const [cfg] = deriveVaultConfigPDA()
  const [rec] = deriveDepositRecordPDA(DEPOSITOR_KP.publicKey, NATIVE_SOL_MINT)
  return {
    getLatestBlockhash: async () => ({ blockhash: BLOCKHASH, lastValidBlockHeight: 1 }),
    getMinimumBalanceForRentExemption: async () => 890_880,
    getAccountInfo: async (pk: PublicKey) => {
      if (pk.equals(cfg)) return { data: configBuf } as never
      if (pk.equals(rec)) return { data: recordBuf } as never
      return { lamports: 1_000_000_000, data: Buffer.alloc(0) } as never
    },
    getTransaction: async () => ({ meta: { err: null } }) as never,
    sendRawTransaction: async () => 'SIG_' + BLOCKHASH.slice(0, 8),
    confirmTransaction: async () => ({ value: { err: null } }) as never,
  } as unknown as Connection
}

describe('SipherVaultPrivacyProvider — funding/verify/deposit/refund/preview', () => {
  it('feeBps defaults to the vault default and previewWithdraw splits fee/net', () => {
    const p = new SipherVaultPrivacyProvider(mockConn())
    expect(p.feeBps).toBe(10)
    expect(p.previewWithdraw(2_000_000n)).toEqual({ feeLamports: 2_000n, netLamports: 1_998_000n })
  })

  it('buildFundingTx is a plain SystemProgram.transfer to the depositor wallet', async () => {
    const p = new SipherVaultPrivacyProvider(mockConn())
    const from = Keypair.generate().publicKey.toBase58()
    const dep = DEPOSITOR_KP.publicKey.toBase58()
    const tx = await p.buildFundingTx({ fromPk: from, depositorPk: dep, amountLamports: 3_000_000n, recentBlockhash: BLOCKHASH })
    const ix = tx.instructions[0]
    expect(ix.programId.equals(SystemProgram.programId)).toBe(true)
    expect(ix.keys[0].pubkey.toBase58()).toBe(from)
    expect(ix.keys[1].pubkey.toBase58()).toBe(dep)
  })

  it('verifyFunding throws when the tx is missing', async () => {
    const conn = mockConn()
    ;(conn as unknown as { getTransaction: () => Promise<unknown> }).getTransaction = async () => null
    const p = new SipherVaultPrivacyProvider(conn)
    await expect(p.verifyFunding({ depositorPk: DEPOSITOR_KP.publicKey.toBase58(), expectedLamports: 1n, txSignature: 'x' }))
      .rejects.toThrow('not found')
  })

  it('deposit builds deposit_sol, signs with the depositor, and returns the signature', async () => {
    const p = new SipherVaultPrivacyProvider(mockConn())
    const res = await p.deposit({ depositorKp: DEPOSITOR_KP, lamports: 4_000_000n })
    expect(res.depositedLamports).toBe(4_000_000n)
    expect(res.txSignature).toMatch(/^SIG_/)
  })

  it('refund returns the on-chain record balance', async () => {
    const p = new SipherVaultPrivacyProvider(mockConn({ recordBalance: 4_242n }))
    const res = await p.refund({ depositorKp: DEPOSITOR_KP })
    expect(res.refundedLamports).toBe(4_242n)
    expect(res.txSignature).toMatch(/^SIG_/)
  })
})
