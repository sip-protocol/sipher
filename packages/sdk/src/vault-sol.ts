import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import {
  SIPHER_VAULT_PROGRAM_ID,
  VAULT_SOL_SEED,
  FEE_SOL_SEED,
  NATIVE_SOL_MINT,
} from './config.js'
import {
  anchorDiscriminator,
  deriveVaultConfigPDA,
  deriveDepositRecordPDA,
  deserializeDepositRecord,
} from './vault.js'
import type { SolDepositResult, SolRefundResult } from './types.js'

// ─────────────────────────────────────────────────────────────────────────────
// Native-SOL PDA derivation
//
// The native-SOL DepositRecord uses the EXISTING deriveDepositRecordPDA helper
// with NATIVE_SOL_MINT as the mint seed — no dedicated helper is needed here.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive the singleton SolVault PDA (holds native lamports).
 * Seeds: [b"vault_sol"]
 */
export function deriveSolVaultPDA(
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([VAULT_SOL_SEED], programId)
}

/**
 * Derive the singleton SolFee PDA (native-SOL fee sink).
 * Seeds: [b"fee_sol"]
 */
export function deriveSolFeePDA(
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([FEE_SOL_SEED], programId)
}

/**
 * Build an unsigned native-SOL deposit transaction (deposit_sol).
 *
 * Accounts (order matches the DepositSol context in lib.rs):
 *   0. config         (mut)         — VaultConfig PDA
 *   1. deposit_record (mut)         — DepositRecord PDA [.., depositor, NATIVE_SOL_MINT]
 *   2. sol_vault      (mut)         — SolVault PDA
 *   3. depositor      (mut, signer)
 *   4. system_program (ro)
 */
export async function buildDepositSolTx(
  connection: Connection,
  depositor: PublicKey,
  amount: bigint,
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): Promise<SolDepositResult> {
  if (amount <= 0n) {
    throw new Error('Deposit amount must be greater than zero')
  }

  const [configPDA] = deriveVaultConfigPDA(programId)
  const [depositRecordPDA] = deriveDepositRecordPDA(depositor, NATIVE_SOL_MINT, programId)
  const [solVaultPDA] = deriveSolVaultPDA(programId)

  // disc(8) + amount(u64 LE, 8) = 16 bytes
  const data = Buffer.alloc(16)
  anchorDiscriminator('deposit_sol').copy(data, 0)
  data.writeBigUInt64LE(amount, 8)

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: true },
      { pubkey: depositRecordPDA, isSigner: false, isWritable: true },
      { pubkey: solVaultPDA, isSigner: false, isWritable: true },
      { pubkey: depositor, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })

  const tx = new Transaction()
  tx.add(ix)
  tx.feePayer = depositor

  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash

  return {
    transaction: tx,
    depositRecordAddress: depositRecordPDA,
    solVaultAddress: solVaultPDA,
    amount,
  }
}

/**
 * Build an unsigned native-SOL refund transaction (refund_sol). Depositor signs.
 *
 * Accounts (order matches the RefundSol context in lib.rs):
 *   0. config         (ro)          — VaultConfig PDA
 *   1. deposit_record (mut)         — DepositRecord PDA [.., depositor, NATIVE_SOL_MINT]
 *   2. sol_vault      (mut)         — SolVault PDA
 *   3. depositor      (mut, signer)
 */
export async function buildRefundSolTx(
  connection: Connection,
  depositor: PublicKey,
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): Promise<SolRefundResult> {
  const [configPDA] = deriveVaultConfigPDA(programId)
  const [depositRecordPDA] = deriveDepositRecordPDA(depositor, NATIVE_SOL_MINT, programId)
  const [solVaultPDA] = deriveSolVaultPDA(programId)

  const recordInfo = await connection.getAccountInfo(depositRecordPDA)
  if (!recordInfo) {
    throw new Error('No deposit record found — nothing to refund')
  }
  const record = deserializeDepositRecord(Buffer.from(recordInfo.data))
  const refundAmount = record.balance
  if (refundAmount <= 0n) {
    throw new Error('No balance to refund')
  }

  const data = anchorDiscriminator('refund_sol')

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: false },
      { pubkey: depositRecordPDA, isSigner: false, isWritable: true },
      { pubkey: solVaultPDA, isSigner: false, isWritable: true },
      { pubkey: depositor, isSigner: true, isWritable: true },
    ],
    data,
  })

  const tx = new Transaction()
  tx.add(ix)
  tx.feePayer = depositor

  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash

  return { transaction: tx, refundAmount, depositorAddress: depositor }
}

/**
 * Build an unsigned authority-signed native-SOL refund (authority_refund_sol).
 * The authority signs on the depositor's behalf; the depositor is a non-signer
 * lamport destination. The on-chain `has_one = depositor` guarantees principal
 * returns to the original depositor, and the timeout is still enforced on-chain.
 *
 * Accounts (order matches the AuthorityRefundSol context in lib.rs):
 *   0. config         (ro)          — VaultConfig PDA (has_one = authority)
 *   1. deposit_record (mut)         — DepositRecord PDA [.., depositor, NATIVE_SOL_MINT]
 *   2. sol_vault      (mut)         — SolVault PDA
 *   3. depositor      (mut)         — NOT signer; validated by has_one
 *   4. authority      (mut, signer)
 */
export async function buildAuthorityRefundSolTx(
  connection: Connection,
  authority: PublicKey,
  depositor: PublicKey,
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): Promise<SolRefundResult> {
  const [configPDA] = deriveVaultConfigPDA(programId)
  const [depositRecordPDA] = deriveDepositRecordPDA(depositor, NATIVE_SOL_MINT, programId)
  const [solVaultPDA] = deriveSolVaultPDA(programId)

  const recordInfo = await connection.getAccountInfo(depositRecordPDA)
  if (!recordInfo) {
    throw new Error('No deposit record found — nothing to refund')
  }
  const record = deserializeDepositRecord(Buffer.from(recordInfo.data))
  const refundAmount = record.balance
  if (refundAmount <= 0n) {
    throw new Error('No balance to refund')
  }

  const data = anchorDiscriminator('authority_refund_sol')

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: false },
      { pubkey: depositRecordPDA, isSigner: false, isWritable: true },
      { pubkey: solVaultPDA, isSigner: false, isWritable: true },
      { pubkey: depositor, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
    ],
    data,
  })

  const tx = new Transaction()
  tx.add(ix)
  tx.feePayer = authority

  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash

  return { transaction: tx, refundAmount, depositorAddress: depositor }
}

/**
 * Build an unsigned create_sol_vault transaction — one-time init of the singleton
 * SolVault + SolFee PDAs. Payer funds the rent-exempt reserve for both. No args.
 *
 * Accounts (order matches the CreateSolVault context in lib.rs):
 *   0. config         (ro)          — VaultConfig PDA
 *   1. sol_vault      (init, mut)   — SolVault PDA
 *   2. sol_fee        (init, mut)   — SolFee PDA
 *   3. payer          (mut, signer)
 *   4. system_program (ro)
 */
export async function buildCreateSolVaultTx(
  connection: Connection,
  payer: PublicKey,
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): Promise<Transaction> {
  const [configPDA] = deriveVaultConfigPDA(programId)
  const [solVaultPDA] = deriveSolVaultPDA(programId)
  const [solFeePDA] = deriveSolFeePDA(programId)

  const data = anchorDiscriminator('create_sol_vault')

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: false },
      { pubkey: solVaultPDA, isSigner: false, isWritable: true },
      { pubkey: solFeePDA, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })

  const tx = new Transaction()
  tx.add(ix)
  tx.feePayer = payer

  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash

  return tx
}
