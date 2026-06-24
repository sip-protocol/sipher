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
} from './vault.js'
import type { SolDepositResult } from './types.js'

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
