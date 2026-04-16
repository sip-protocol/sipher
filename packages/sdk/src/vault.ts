import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { createHash } from 'crypto'
import {
  SIPHER_VAULT_PROGRAM_ID,
  VAULT_CONFIG_SEED,
  DEPOSIT_RECORD_SEED,
  VAULT_TOKEN_SEED,
  FEE_TOKEN_SEED,
  ANCHOR_DISCRIMINATOR_SIZE,
} from './config.js'
import type {
  VaultConfig,
  DepositRecord,
  VaultBalance,
  DepositResult,
  RefundResult,
} from './types.js'

// ─────────────────────────────────────────────────────────────────────────────
// PDA derivation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive the VaultConfig PDA address.
 * Seeds: [b"vault_config"]
 */
export function deriveVaultConfigPDA(
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_CONFIG_SEED],
    programId
  )
}

/**
 * Derive a DepositRecord PDA for a given depositor + token mint.
 * Seeds: [b"deposit_record", depositor, token_mint]
 */
export function deriveDepositRecordPDA(
  depositor: PublicKey,
  tokenMint: PublicKey,
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [DEPOSIT_RECORD_SEED, depositor.toBuffer(), tokenMint.toBuffer()],
    programId
  )
}

/**
 * Derive the vault token account PDA for a given mint.
 * Seeds: [b"vault_token", token_mint]
 */
export function deriveVaultTokenPDA(
  tokenMint: PublicKey,
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_TOKEN_SEED, tokenMint.toBuffer()],
    programId
  )
}

/**
 * Derive the fee token account PDA for a given mint.
 * Seeds: [b"fee_token", token_mint]
 */
export function deriveFeeTokenPDA(
  tokenMint: PublicKey,
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [FEE_TOKEN_SEED, tokenMint.toBuffer()],
    programId
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Anchor instruction discriminator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the 8-byte Anchor instruction discriminator.
 * SHA-256("global:<instruction_name>")[0..8]
 */
export function anchorDiscriminator(instructionName: string): Buffer {
  const hash = createHash('sha256')
    .update(`global:${instructionName}`)
    .digest()
  return Buffer.from(hash.subarray(0, 8))
}

// ─────────────────────────────────────────────────────────────────────────────
// Account deserialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deserialize raw account data into VaultConfig.
 * Layout (after 8-byte discriminator):
 *   authority:         Pubkey  (32 bytes)
 *   fee_bps:           u16    (2 bytes, LE)
 *   refund_timeout:    i64    (8 bytes, LE)
 *   paused:            bool   (1 byte)
 *   total_deposits:    u64    (8 bytes, LE)
 *   total_depositors:  u64    (8 bytes, LE)
 *   bump:              u8     (1 byte)
 */
export function deserializeVaultConfig(data: Buffer): VaultConfig {
  if (data.length < ANCHOR_DISCRIMINATOR_SIZE + 60) {
    throw new Error(
      `VaultConfig data too short: expected ${ANCHOR_DISCRIMINATOR_SIZE + 60} bytes, got ${data.length}`
    )
  }

  let offset = ANCHOR_DISCRIMINATOR_SIZE

  const authority = new PublicKey(data.subarray(offset, offset + 32))
  offset += 32

  const feeBps = data.readUInt16LE(offset)
  offset += 2

  const refundTimeout = Number(data.readBigInt64LE(offset))
  offset += 8

  const paused = data[offset] !== 0
  offset += 1

  const totalDeposits = Number(data.readBigUInt64LE(offset))
  offset += 8

  const totalDepositors = Number(data.readBigUInt64LE(offset))
  offset += 8

  const bump = data[offset]

  return {
    authority,
    feeBps,
    refundTimeout,
    paused,
    totalDeposits,
    totalDepositors,
    bump,
  }
}

/**
 * Deserialize raw account data into DepositRecord.
 * Layout (after 8-byte discriminator):
 *   depositor:          Pubkey  (32 bytes)
 *   token_mint:         Pubkey  (32 bytes)
 *   balance:            u64    (8 bytes, LE)
 *   locked_amount:      u64    (8 bytes, LE)
 *   cumulative_volume:  u64    (8 bytes, LE)
 *   last_deposit_at:    i64    (8 bytes, LE)
 *   bump:               u8     (1 byte)
 */
export function deserializeDepositRecord(data: Buffer): DepositRecord {
  if (data.length < ANCHOR_DISCRIMINATOR_SIZE + 97) {
    throw new Error(
      `DepositRecord data too short: expected ${ANCHOR_DISCRIMINATOR_SIZE + 97} bytes, got ${data.length}`
    )
  }

  let offset = ANCHOR_DISCRIMINATOR_SIZE

  const depositor = new PublicKey(data.subarray(offset, offset + 32))
  offset += 32

  const tokenMint = new PublicKey(data.subarray(offset, offset + 32))
  offset += 32

  const balance = data.readBigUInt64LE(offset)
  offset += 8

  const lockedAmount = data.readBigUInt64LE(offset)
  offset += 8

  const cumulativeVolume = data.readBigUInt64LE(offset)
  offset += 8

  const lastDepositAt = Number(data.readBigInt64LE(offset))
  offset += 8

  const bump = data[offset]

  return {
    depositor,
    tokenMint,
    balance,
    lockedAmount,
    cumulativeVolume,
    lastDepositAt,
    bump,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Read operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch and deserialize VaultConfig from on-chain.
 * Returns null if the account doesn't exist.
 */
export async function getVaultConfig(
  connection: Connection,
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): Promise<VaultConfig | null> {
  const [configPDA] = deriveVaultConfigPDA(programId)
  const info = await connection.getAccountInfo(configPDA)
  if (!info) return null
  return deserializeVaultConfig(Buffer.from(info.data))
}

/**
 * Fetch the vault balance for a depositor + token mint pair.
 * Returns a VaultBalance with exists=false if no DepositRecord exists.
 */
export async function getVaultBalance(
  connection: Connection,
  depositor: PublicKey,
  tokenMint: PublicKey,
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): Promise<VaultBalance> {
  const [recordPDA] = deriveDepositRecordPDA(depositor, tokenMint, programId)
  const info = await connection.getAccountInfo(recordPDA)

  if (!info) {
    return {
      depositor,
      tokenMint,
      balance: 0n,
      lockedAmount: 0n,
      available: 0n,
      cumulativeVolume: 0n,
      lastDepositAt: 0,
      exists: false,
    }
  }

  const record = deserializeDepositRecord(Buffer.from(info.data))
  return {
    depositor: record.depositor,
    tokenMint: record.tokenMint,
    balance: record.balance,
    lockedAmount: record.lockedAmount,
    available: record.balance - record.lockedAmount,
    cumulativeVolume: record.cumulativeVolume,
    lastDepositAt: record.lastDepositAt,
    exists: true,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build an unsigned deposit transaction.
 *
 * Accounts (order matters — matches Deposit context in lib.rs):
 *   0. config           (mut)  — VaultConfig PDA
 *   1. deposit_record   (mut)  — DepositRecord PDA (init_if_needed)
 *   2. vault_token      (mut)  — Vault token PDA
 *   3. depositor_token  (mut)  — Depositor's token account
 *   4. token_mint       (ro)   — SPL token mint
 *   5. depositor        (mut, signer)
 *   6. token_program    (ro)
 *   7. system_program   (ro)
 */
export async function buildDepositTx(
  connection: Connection,
  depositor: PublicKey,
  tokenMint: PublicKey,
  depositorTokenAccount: PublicKey,
  amount: bigint,
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): Promise<DepositResult> {
  if (amount <= 0n) {
    throw new Error('Deposit amount must be greater than zero')
  }

  const [configPDA] = deriveVaultConfigPDA(programId)
  const [depositRecordPDA] = deriveDepositRecordPDA(depositor, tokenMint, programId)
  const [vaultTokenPDA] = deriveVaultTokenPDA(tokenMint, programId)

  // Encode: discriminator(8) + amount(u64 LE, 8) = 16 bytes
  const discriminator = anchorDiscriminator('deposit')
  const data = Buffer.alloc(16)
  discriminator.copy(data, 0)
  data.writeBigUInt64LE(amount, 8)

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: true },
      { pubkey: depositRecordPDA, isSigner: false, isWritable: true },
      { pubkey: vaultTokenPDA, isSigner: false, isWritable: true },
      { pubkey: depositorTokenAccount, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: depositor, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
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
    vaultTokenAddress: vaultTokenPDA,
    amount,
  }
}

/**
 * Build an unsigned refund transaction.
 *
 * Accounts (order matters — matches Refund context in lib.rs):
 *   0. config           (ro)   — VaultConfig PDA
 *   1. deposit_record   (mut)  — DepositRecord PDA
 *   2. vault_token      (mut)  — Vault token PDA
 *   3. depositor_token  (mut)  — Depositor's token account
 *   4. depositor        (mut, signer)
 *   5. token_program    (ro)
 */
export async function buildRefundTx(
  connection: Connection,
  depositor: PublicKey,
  tokenMint: PublicKey,
  depositorTokenAccount: PublicKey,
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): Promise<RefundResult> {
  const [configPDA] = deriveVaultConfigPDA(programId)
  const [depositRecordPDA] = deriveDepositRecordPDA(depositor, tokenMint, programId)
  const [vaultTokenPDA] = deriveVaultTokenPDA(tokenMint, programId)

  // Pre-fetch balance to compute refund amount for the result
  const recordInfo = await connection.getAccountInfo(depositRecordPDA)
  if (!recordInfo) {
    throw new Error('No deposit record found — nothing to refund')
  }
  const record = deserializeDepositRecord(Buffer.from(recordInfo.data))
  const refundAmount = record.balance - record.lockedAmount
  if (refundAmount <= 0n) {
    throw new Error('No available balance to refund (all funds locked or zero)')
  }

  // Encode: discriminator(8) only — refund has no params
  const data = anchorDiscriminator('refund')

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: false },
      { pubkey: depositRecordPDA, isSigner: false, isWritable: true },
      { pubkey: vaultTokenPDA, isSigner: false, isWritable: true },
      { pubkey: depositorTokenAccount, isSigner: false, isWritable: true },
      { pubkey: depositor, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
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
    refundAmount,
    depositorTokenAddress: depositorTokenAccount,
  }
}

/**
 * Fetch and deserialize a DepositRecord from chain.
 * Used by SENTINEL's performVaultRefund to derive depositor + mint from a PDA.
 */
export async function fetchDepositRecord(
  connection: Connection,
  depositRecordPDA: PublicKey,
): Promise<DepositRecord> {
  const info = await connection.getAccountInfo(depositRecordPDA)
  if (!info) {
    throw new Error(`DepositRecord not found at ${depositRecordPDA.toBase58()}`)
  }
  return deserializeDepositRecord(Buffer.from(info.data))
}

/**
 * Build an authority-signed refund transaction (sipher_vault.authority_refund).
 *
 * Unlike buildRefundTx (depositor signs), this is signed by the vault authority.
 * Used by SENTINEL for autonomous refunds of expired deposits after the
 * refund_timeout cooldown. Timeout is still enforced on-chain.
 *
 * Accounts (order matters — matches AuthorityRefund context in lib.rs):
 *   0. config           (ro)   — VaultConfig PDA
 *   1. deposit_record   (mut)  — DepositRecord PDA
 *   2. vault_token      (mut)  — Vault token PDA
 *   3. depositor_token  (mut)  — Depositor's token account
 *   4. depositor        (ro)   — NOT signer, validated by has_one on deposit_record
 *   5. authority        (mut, signer)
 *   6. token_program    (ro)
 */
export async function buildAuthorityRefundTx(
  connection: Connection,
  authority: PublicKey,
  depositor: PublicKey,
  tokenMint: PublicKey,
  depositorTokenAccount: PublicKey,
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): Promise<RefundResult> {
  const [configPDA] = deriveVaultConfigPDA(programId)
  const [depositRecordPDA] = deriveDepositRecordPDA(depositor, tokenMint, programId)
  const [vaultTokenPDA] = deriveVaultTokenPDA(tokenMint, programId)

  // Pre-fetch balance to compute refund amount
  const recordInfo = await connection.getAccountInfo(depositRecordPDA)
  if (!recordInfo) {
    throw new Error('No deposit record found — nothing to refund')
  }
  const record = deserializeDepositRecord(Buffer.from(recordInfo.data))
  const refundAmount = record.balance - record.lockedAmount
  if (refundAmount <= 0n) {
    throw new Error('No available balance to refund (all funds locked or zero)')
  }

  // Encode: discriminator(8) only — authority_refund has no params
  const data = anchorDiscriminator('authority_refund')

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: false },           // config
      { pubkey: depositRecordPDA, isSigner: false, isWritable: true },     // deposit_record
      { pubkey: vaultTokenPDA, isSigner: false, isWritable: true },        // vault_token
      { pubkey: depositorTokenAccount, isSigner: false, isWritable: true }, // depositor_token
      { pubkey: depositor, isSigner: false, isWritable: false },           // depositor (NOT signer)
      { pubkey: authority, isSigner: true, isWritable: true },             // authority (signer)
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },    // token_program
    ],
    data,
  })

  const tx = new Transaction()
  tx.add(ix)
  tx.feePayer = authority

  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash

  return {
    transaction: tx,
    refundAmount,
    depositorTokenAddress: depositorTokenAccount,
  }
}
