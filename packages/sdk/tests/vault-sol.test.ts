import { describe, it, expect } from 'vitest'
import { PublicKey, Connection, SystemProgram } from '@solana/web3.js'
import {
  NATIVE_SOL_MINT,
  VAULT_SOL_SEED,
  FEE_SOL_SEED,
  deriveSolVaultPDA,
  deriveSolFeePDA,
  buildDepositSolTx,
  buildRefundSolTx,
  buildAuthorityRefundSolTx,
  deriveVaultConfigPDA,
  deriveDepositRecordPDA,
  anchorDiscriminator,
  SIPHER_VAULT_PROGRAM_ID,
} from '../src/index.js'

describe('native-SOL constants', () => {
  it('NATIVE_SOL_MINT is the all-zeros sentinel (not wSOL)', () => {
    expect(NATIVE_SOL_MINT.toBase58()).toBe('11111111111111111111111111111111')
    expect(NATIVE_SOL_MINT.toBytes().every((b) => b === 0)).toBe(true)
  })

  it('SOL vault seeds match the on-chain constants', () => {
    expect(VAULT_SOL_SEED.toString()).toBe('vault_sol')
    expect(FEE_SOL_SEED.toString()).toBe('fee_sol')
  })
})

describe('native-SOL PDA derivation', () => {
  it('deriveSolVaultPDA matches the live devnet SolVault', () => {
    const [pda] = deriveSolVaultPDA()
    expect(pda.toBase58()).toBe('8ZG46epBDrRbZ2oDneuemmSuQNNG3R58LhFo8Do2p6sq')
  })

  it('deriveSolFeePDA matches the live devnet SolFee', () => {
    const [pda] = deriveSolFeePDA()
    expect(pda.toBase58()).toBe('519L2NQN16H1fnN9iPu2r2ipmjPj156yWMPQumw8PkZ4')
  })

  it('derivations honor a programId override', () => {
    const custom = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    const [vault] = deriveSolVaultPDA(custom)
    const [expected] = PublicKey.findProgramAddressSync([VAULT_SOL_SEED], custom)
    expect(vault.equals(expected)).toBe(true)
  })
})

const BLOCKHASH = 'GfVcyD4kkTrj4bKc7WA9sZCin9JDbdT458zqL4zjxx2v'
const DEPOSITOR = new PublicKey('FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr')

// Minimal Connection stub: only getLatestBlockhash is exercised by the deposit builder.
function mockConnDeposit(): Connection {
  return {
    getLatestBlockhash: async () => ({ blockhash: BLOCKHASH, lastValidBlockHeight: 1 }),
  } as unknown as Connection
}

describe('buildDepositSolTx', () => {
  it('builds deposit_sol with the exact DepositSol account order + flags', async () => {
    const res = await buildDepositSolTx(mockConnDeposit(), DEPOSITOR, 5_000_000n)
    const ix = res.transaction.instructions[0]

    const [config] = deriveVaultConfigPDA()
    const [record] = deriveDepositRecordPDA(DEPOSITOR, NATIVE_SOL_MINT)
    const [solVault] = deriveSolVaultPDA()

    expect(ix.programId.equals(SIPHER_VAULT_PROGRAM_ID)).toBe(true)
    expect(ix.keys.map((k) => k.pubkey.toBase58())).toEqual([
      config.toBase58(),
      record.toBase58(),
      solVault.toBase58(),
      DEPOSITOR.toBase58(),
      SystemProgram.programId.toBase58(),
    ])
    expect(ix.keys.map((k) => k.isSigner)).toEqual([false, false, false, true, false])
    expect(ix.keys.map((k) => k.isWritable)).toEqual([true, true, true, true, false])
  })

  it('encodes discriminator + amount and sets feePayer/blockhash', async () => {
    const res = await buildDepositSolTx(mockConnDeposit(), DEPOSITOR, 5_000_000n)
    const data = res.transaction.instructions[0].data
    expect(data.length).toBe(16)
    expect(data.subarray(0, 8).equals(anchorDiscriminator('deposit_sol'))).toBe(true)
    expect(data.readBigUInt64LE(8)).toBe(5_000_000n)
    expect(res.transaction.feePayer?.toBase58()).toBe(DEPOSITOR.toBase58())
    expect(res.transaction.recentBlockhash).toBe(BLOCKHASH)
    expect(res.amount).toBe(5_000_000n)
    expect(res.solVaultAddress.equals(deriveSolVaultPDA()[0])).toBe(true)
  })

  it('rejects a non-positive amount', async () => {
    await expect(buildDepositSolTx(mockConnDeposit(), DEPOSITOR, 0n)).rejects.toThrow(
      'Deposit amount must be greater than zero',
    )
  })
})

const AUTHORITY = new PublicKey('S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd')

// DepositRecord buffer: 8 disc + depositor(32) + mint(32) + balance(8)
// + cumulative(8) + last_deposit(8) + bump(1) = 97 bytes. balance at offset 72.
function depositRecordBuf(balance: bigint): Buffer {
  const buf = Buffer.alloc(8 + 89)
  buf.writeBigUInt64LE(balance, 72)
  return buf
}

function mockConnRefund(recordBuf: Buffer | null): Connection {
  return {
    getLatestBlockhash: async () => ({ blockhash: BLOCKHASH, lastValidBlockHeight: 1 }),
    getAccountInfo: async () => (recordBuf ? ({ data: recordBuf } as never) : null),
  } as unknown as Connection
}

describe('buildRefundSolTx', () => {
  it('builds refund_sol with the exact RefundSol account order + flags', async () => {
    const res = await buildRefundSolTx(mockConnRefund(depositRecordBuf(3_000_000n)), DEPOSITOR)
    const ix = res.transaction.instructions[0]
    const [config] = deriveVaultConfigPDA()
    const [record] = deriveDepositRecordPDA(DEPOSITOR, NATIVE_SOL_MINT)
    const [solVault] = deriveSolVaultPDA()

    expect(ix.keys.map((k) => k.pubkey.toBase58())).toEqual([
      config.toBase58(),
      record.toBase58(),
      solVault.toBase58(),
      DEPOSITOR.toBase58(),
    ])
    expect(ix.keys.map((k) => k.isSigner)).toEqual([false, false, false, true])
    expect(ix.keys.map((k) => k.isWritable)).toEqual([false, true, true, true])
    expect(ix.data.equals(anchorDiscriminator('refund_sol'))).toBe(true)
    expect(res.refundAmount).toBe(3_000_000n)
    expect(res.depositorAddress.toBase58()).toBe(DEPOSITOR.toBase58())
  })

  it('throws when there is no deposit record', async () => {
    await expect(buildRefundSolTx(mockConnRefund(null), DEPOSITOR)).rejects.toThrow(
      'nothing to refund',
    )
  })

  it('throws when the balance is zero', async () => {
    await expect(
      buildRefundSolTx(mockConnRefund(depositRecordBuf(0n)), DEPOSITOR),
    ).rejects.toThrow('No balance to refund')
  })
})

describe('buildAuthorityRefundSolTx', () => {
  it('makes authority the signer and depositor a non-signer destination', async () => {
    const res = await buildAuthorityRefundSolTx(
      mockConnRefund(depositRecordBuf(4_000_000n)),
      AUTHORITY,
      DEPOSITOR,
    )
    const ix = res.transaction.instructions[0]
    const [config] = deriveVaultConfigPDA()
    const [record] = deriveDepositRecordPDA(DEPOSITOR, NATIVE_SOL_MINT)
    const [solVault] = deriveSolVaultPDA()

    expect(ix.keys.map((k) => k.pubkey.toBase58())).toEqual([
      config.toBase58(),
      record.toBase58(),
      solVault.toBase58(),
      DEPOSITOR.toBase58(),
      AUTHORITY.toBase58(),
    ])
    expect(ix.keys.map((k) => k.isSigner)).toEqual([false, false, false, false, true])
    expect(ix.keys.map((k) => k.isWritable)).toEqual([false, true, true, true, true])
    expect(ix.data.equals(anchorDiscriminator('authority_refund_sol'))).toBe(true)
    expect(res.transaction.feePayer?.toBase58()).toBe(AUTHORITY.toBase58())
    expect(res.refundAmount).toBe(4_000_000n)
  })
})
