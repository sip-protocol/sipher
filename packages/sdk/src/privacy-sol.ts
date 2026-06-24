import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import {
  SIPHER_VAULT_PROGRAM_ID,
  SIP_PRIVACY_PROGRAM_ID,
  SIP_CONFIG_SEED,
  SIP_TRANSFER_RECORD_SEED,
  NATIVE_SOL_MINT,
  ANCHOR_DISCRIMINATOR_SIZE,
} from './config.js'
import {
  anchorDiscriminator,
  deriveVaultConfigPDA,
  deriveDepositRecordPDA,
} from './vault.js'
import { deriveSolVaultPDA, deriveSolFeePDA } from './vault-sol.js'
import type { WithdrawResult } from './types.js'

export interface PrivateSendSolParams {
  connection: Connection
  /** The depositor who owns the native-SOL vault balance */
  depositor: PublicKey
  /** Amount of lamports to withdraw (gross, before fees) */
  amount: bigint
  /** The stealth recipient pubkey — also the plain SystemAccount that receives lamports */
  stealthPubkey: PublicKey
  /** Pedersen commitment: C = amount*G + blinding*H (33 bytes compressed) */
  amountCommitment: Uint8Array
  /** Ephemeral pubkey for ECDH (33 bytes compressed) */
  ephemeralPubkey: Uint8Array
  /** SHA-256 hash of the viewing key (32 bytes) */
  viewingKeyHash: Uint8Array
  /** Encrypted amount blob (for recipient to decrypt with viewing key) */
  encryptedAmount: Uint8Array
  /** ZK proof bytes (verified off-chain; may be empty) */
  proof: Uint8Array
  /** Program ID override */
  programId?: PublicKey
}

/**
 * Build an unsigned native-SOL withdraw_private_sol transaction: withdraw lamports
 * from the shared SolVault to a stealth recipient, with a Pedersen commitment hiding
 * the amount and a sip_privacy announcement CPI. Mirrors buildPrivateSendTx with the
 * token accounts replaced by sol_vault / sol_fee and a plain SystemAccount recipient.
 *
 * Accounts (order matches the WithdrawPrivateSol context in lib.rs):
 *   0. config              (ro)   — VaultConfig PDA
 *   1. deposit_record      (mut)  — DepositRecord PDA [.., depositor, NATIVE_SOL_MINT]
 *   2. sol_vault           (mut)  — SolVault PDA
 *   3. sol_fee             (mut)  — SolFee PDA
 *   4. stealth             (mut)  — stealth recipient (SystemAccount)
 *   5. depositor           (mut, signer)
 *   6. sip_config          (mut)  — SIP Privacy Config PDA (CPI)
 *   7. sip_transfer_record (mut)  — TransferRecord PDA (init by CPI)
 *   8. sip_privacy_program (ro)
 *   9. system_program      (ro)
 */
export async function buildPrivateSendSolTx(
  params: PrivateSendSolParams
): Promise<WithdrawResult> {
  const {
    connection,
    depositor,
    amount,
    stealthPubkey,
    amountCommitment,
    ephemeralPubkey,
    viewingKeyHash,
    encryptedAmount,
    proof,
    programId = SIPHER_VAULT_PROGRAM_ID,
  } = params

  if (amount <= 0n) {
    throw new Error('Withdrawal amount must be greater than zero')
  }
  if (amountCommitment.length !== 33) {
    throw new Error(`amountCommitment must be 33 bytes, got ${amountCommitment.length}`)
  }
  if (ephemeralPubkey.length !== 33) {
    throw new Error(`ephemeralPubkey must be 33 bytes, got ${ephemeralPubkey.length}`)
  }
  if (viewingKeyHash.length !== 32) {
    throw new Error(`viewingKeyHash must be 32 bytes, got ${viewingKeyHash.length}`)
  }

  const [configPDA] = deriveVaultConfigPDA(programId)
  const [depositRecordPDA] = deriveDepositRecordPDA(depositor, NATIVE_SOL_MINT, programId)
  const [solVaultPDA] = deriveSolVaultPDA(programId)
  const [solFeePDA] = deriveSolFeePDA(programId)
  const [sipConfigPDA] = PublicKey.findProgramAddressSync(
    [SIP_CONFIG_SEED],
    SIP_PRIVACY_PROGRAM_ID
  )

  // Parallel reads: vault config (fee), sip config (total_transfers), rent floor,
  // and the stealth recipient's current balance (for the rent-exempt guard).
  const [configInfo, sipConfigInfo, rentExemptMin, stealthInfo] = await Promise.all([
    connection.getAccountInfo(configPDA),
    connection.getAccountInfo(sipConfigPDA),
    connection.getMinimumBalanceForRentExemption(0),
    connection.getAccountInfo(stealthPubkey),
  ])

  let feeBps = 10 // fallback to default
  if (configInfo) {
    // fee_bps at offset 8 (disc) + 32 (authority) = 40, u16 LE
    feeBps = configInfo.data.readUInt16LE(40)
  }

  let sipTotalTransfers = 0n
  if (sipConfigInfo) {
    // after 8-byte disc: authority(32) + fee_bps(2) + paused(1) + total_transfers(u64)
    sipTotalTransfers = sipConfigInfo.data.readBigUInt64LE(
      ANCHOR_DISCRIMINATOR_SIZE + 32 + 2 + 1
    )
  }

  const totalTransfersBuffer = Buffer.alloc(8)
  totalTransfersBuffer.writeBigUInt64LE(sipTotalTransfers)
  const [sipTransferRecordPDA] = PublicKey.findProgramAddressSync(
    [SIP_TRANSFER_RECORD_SEED, depositor.toBuffer(), totalTransfersBuffer],
    SIP_PRIVACY_PROGRAM_ID
  )

  const feeAmount = (amount * BigInt(feeBps)) / 10_000n
  const netAmount = amount - feeAmount

  // Rent-exempt guard: the stealth recipient is a plain system account. The runtime
  // rejects a tx that leaves a touched account with a non-zero balance below the
  // rent-exempt minimum, so a small payout to a never-funded stealth would fail.
  // Surface it with an actionable error instead of an opaque runtime reject.
  const currentLamports = BigInt(stealthInfo?.lamports ?? 0)
  if (currentLamports + netAmount < BigInt(rentExemptMin)) {
    throw new Error(
      `Stealth recipient ${stealthPubkey.toBase58()} would be left below the ` +
        `rent-exempt minimum (needs >= ${rentExemptMin} lamports after the payout; ` +
        `would have ${currentLamports + netAmount}). Pre-fund the stealth account to ` +
        `at least ${rentExemptMin} lamports before withdrawing.`
    )
  }

  // Serialize: disc(8) + amount(8) + commitment(33) + stealth_pubkey(32)
  //          + ephemeral(33) + vk_hash(32) + encrypted(4+len) + proof(4+len)
  const fixedSize = 8 + 8 + 33 + 32 + 33 + 32
  const vecOverhead = 4 + encryptedAmount.length + 4 + proof.length
  const data = Buffer.alloc(fixedSize + vecOverhead)
  let offset = 0

  anchorDiscriminator('withdraw_private_sol').copy(data, offset)
  offset += 8
  data.writeBigUInt64LE(amount, offset)
  offset += 8
  Buffer.from(amountCommitment).copy(data, offset)
  offset += 33
  stealthPubkey.toBuffer().copy(data, offset)
  offset += 32
  Buffer.from(ephemeralPubkey).copy(data, offset)
  offset += 33
  Buffer.from(viewingKeyHash).copy(data, offset)
  offset += 32
  data.writeUInt32LE(encryptedAmount.length, offset)
  offset += 4
  Buffer.from(encryptedAmount).copy(data, offset)
  offset += encryptedAmount.length
  data.writeUInt32LE(proof.length, offset)
  offset += 4
  Buffer.from(proof).copy(data, offset)

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: false },
      { pubkey: depositRecordPDA, isSigner: false, isWritable: true },
      { pubkey: solVaultPDA, isSigner: false, isWritable: true },
      { pubkey: solFeePDA, isSigner: false, isWritable: true },
      { pubkey: stealthPubkey, isSigner: false, isWritable: true },
      { pubkey: depositor, isSigner: true, isWritable: true },
      { pubkey: sipConfigPDA, isSigner: false, isWritable: true },
      { pubkey: sipTransferRecordPDA, isSigner: false, isWritable: true },
      { pubkey: SIP_PRIVACY_PROGRAM_ID, isSigner: false, isWritable: false },
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
    netAmount,
    feeAmount,
    stealthAddress: stealthPubkey,
  }
}
