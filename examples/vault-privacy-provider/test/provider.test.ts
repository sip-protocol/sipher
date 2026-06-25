import { describe, it, expect } from 'vitest'
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
} from '@solana/web3.js'
import {
  deriveVaultConfigPDA, deriveDepositRecordPDA, NATIVE_SOL_MINT,
} from '@sipher/sdk'
import { SipherVaultPrivacyProvider } from '../src/provider.js'
import { parseStealthMetaAddress } from '../src/stealth.js'

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

const VALID_SPENDING = 'bed3f000fd20cb20a8186ae9a9da609c8f01198e1c6e8c18f0bfff9c94f7d17e'
const VALID_VIEWING  = '33e39eaad6d8924030fa1540ee80de1c212d68d12d53570eb3d6bb39aa4b15e4'
const RECIPIENT = parseStealthMetaAddress(`sip:solana:0x${VALID_SPENDING}:0x${VALID_VIEWING}`)

describe('SipherVaultPrivacyProvider — privateWithdraw', () => {
  it('builds withdraw_private_sol to a derived stealth recipient and returns fee/net', async () => {
    const p = new SipherVaultPrivacyProvider(mockConn({ feeBps: 10 }))
    const res = await p.privateWithdraw({ depositorKp: DEPOSITOR_KP, recipient: RECIPIENT, lamports: 2_000_000n })
    expect(res.feeLamports).toBe(2_000n)
    expect(res.withdrawnLamports).toBe(1_998_000n)
    expect(res.txSignature).toMatch(/^SIG_/)
    // stealthAddress is a derived one-time address (not the depositor)
    expect(res.stealthAddress).not.toBe(DEPOSITOR_KP.publicKey.toBase58())
    expect(() => new PublicKey(res.stealthAddress)).not.toThrow()
  })

  it('signs every flow with the SAME shared depositor (depositor-as-vault)', async () => {
    const seen: string[] = []
    const conn = mockConn()
    ;(conn as unknown as { sendRawTransaction: (raw: Uint8Array) => Promise<string> })
      .sendRawTransaction = async (raw) => {
        const tx = Transaction.from(raw)
        expect(tx.signatures).toHaveLength(1)              // depositor is the SOLE signer
        seen.push(tx.feePayer!.toBase58())
        return 'SIG_x'
      }
    const p = new SipherVaultPrivacyProvider(conn)
    await p.privateWithdraw({ depositorKp: DEPOSITOR_KP, recipient: RECIPIENT, lamports: 2_000_000n })
    await p.privateWithdraw({ depositorKp: DEPOSITOR_KP, recipient: RECIPIENT, lamports: 1_500_000n })
    expect(seen).toEqual([DEPOSITOR_KP.publicKey.toBase58(), DEPOSITOR_KP.publicKey.toBase58()])
  })

  it('derives a unique one-time stealth address per flow', async () => {
    const p = new SipherVaultPrivacyProvider(mockConn())
    const a = await p.privateWithdraw({ depositorKp: DEPOSITOR_KP, recipient: RECIPIENT, lamports: 2_000_000n })
    const b = await p.privateWithdraw({ depositorKp: DEPOSITOR_KP, recipient: RECIPIENT, lamports: 1_500_000n })
    expect(a.stealthAddress).not.toBe(b.stealthAddress)
    expect(() => new PublicKey(a.stealthAddress)).not.toThrow()
    expect(() => new PublicKey(b.stealthAddress)).not.toThrow()
    expect(a.stealthAddress).not.toBe(DEPOSITOR_KP.publicKey.toBase58())
  })

  it('propagates the rent-exempt guard for a tiny payout to a fresh stealth', async () => {
    // stealth account does not exist (0 lamports); a 1000-lamport net is below the floor
    const conn = mockConn()
    ;(conn as unknown as { getAccountInfo: (pk: PublicKey) => Promise<unknown> }).getAccountInfo =
      (() => {
        const base = mockConn()
        const orig = base.getAccountInfo.bind(base)
        return async (pk: PublicKey) => {
          const [cfg] = deriveVaultConfigPDA()
          const [rec] = deriveDepositRecordPDA(DEPOSITOR_KP.publicKey, NATIVE_SOL_MINT)
          if (pk.equals(cfg) || pk.equals(rec)) return orig(pk)
          return null // stealth + everything else: not found
        }
      })()
    const p = new SipherVaultPrivacyProvider(conn)
    await expect(p.privateWithdraw({ depositorKp: DEPOSITOR_KP, recipient: RECIPIENT, lamports: 1_000n }))
      .rejects.toThrow('rent-exempt minimum')
  })
})

describe('barrel', () => {
  it('re-exports the public surface', async () => {
    const m = await import('../src/index.js')
    expect(typeof m.SipherVaultPrivacyProvider).toBe('function')
    expect(typeof m.assembleWithdrawArtifacts).toBe('function')
    expect(typeof m.parseStealthMetaAddress).toBe('function')
  })
})
