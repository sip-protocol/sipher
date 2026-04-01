import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import {
  SIPHER_VAULT_PROGRAM_ID,
  VAULT_CONFIG_SEED,
  DEPOSIT_RECORD_SEED,
  VAULT_TOKEN_SEED,
  FEE_TOKEN_SEED,
} from './config.js'
import { anchorDiscriminator, deriveVaultConfigPDA } from './vault.js'
import type { WithdrawResult, ScanResult, StealthPayment } from './types.js'

// ─────────────────────────────────────────────────────────────────────────────
// Private send (withdraw_private instruction)
// ─────────────────────────────────────────────────────────────────────────────

export interface PrivateSendParams {
  connection: Connection
  /** The depositor who owns the vault balance */
  depositor: PublicKey
  /** SPL token mint */
  tokenMint: PublicKey
  /** Amount to withdraw (gross, before fees) */
  amount: bigint
  /** The stealth recipient's token account (already created) */
  stealthTokenAccount: PublicKey
  /** The stealth recipient's pubkey */
  stealthPubkey: PublicKey
  /** Pedersen commitment: C = amount*G + blinding*H (33 bytes compressed) */
  amountCommitment: Uint8Array
  /** Ephemeral pubkey for ECDH (33 bytes compressed) */
  ephemeralPubkey: Uint8Array
  /** SHA-256 hash of the viewing key (32 bytes) */
  viewingKeyHash: Uint8Array
  /** Encrypted amount blob (for recipient to decrypt with viewing key) */
  encryptedAmount: Uint8Array
  /** ZK proof bytes (for on-chain verification, can be empty for now) */
  proof: Uint8Array
  /** Program ID override */
  programId?: PublicKey
}

/**
 * Build an unsigned withdraw_private transaction.
 *
 * This is the core privacy operation: withdraw from the shared vault
 * to a stealth address, with a Pedersen commitment hiding the amount.
 *
 * Accounts (order matches WithdrawPrivate context in lib.rs):
 *   0. config           (ro)   — VaultConfig PDA
 *   1. deposit_record   (mut)  — DepositRecord PDA
 *   2. vault_token      (mut)  — Vault token PDA
 *   3. fee_token        (mut)  — Fee token PDA
 *   4. stealth_token    (mut)  — Stealth recipient's token account
 *   5. token_mint       (ro)   — SPL token mint
 *   6. depositor        (mut, signer)
 *   7. token_program    (ro)
 *
 * Instruction data layout:
 *   discriminator(8) + amount(u64, 8) + amount_commitment([u8;33], 33)
 *   + stealth_pubkey(Pubkey, 32) + ephemeral_pubkey([u8;33], 33)
 *   + viewing_key_hash([u8;32], 32) + encrypted_amount(Vec<u8>, 4+len)
 *   + proof(Vec<u8>, 4+len)
 */
export async function buildPrivateSendTx(
  params: PrivateSendParams
): Promise<WithdrawResult> {
  const {
    connection,
    depositor,
    tokenMint,
    amount,
    stealthTokenAccount,
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

  // Derive PDAs
  const [configPDA] = deriveVaultConfigPDA(programId)
  const [depositRecordPDA] = PublicKey.findProgramAddressSync(
    [DEPOSIT_RECORD_SEED, depositor.toBuffer(), tokenMint.toBuffer()],
    programId
  )
  const [vaultTokenPDA] = PublicKey.findProgramAddressSync(
    [VAULT_TOKEN_SEED, tokenMint.toBuffer()],
    programId
  )
  const [feeTokenPDA] = PublicKey.findProgramAddressSync(
    [FEE_TOKEN_SEED, tokenMint.toBuffer()],
    programId
  )

  // Fetch config to compute fee
  const configInfo = await connection.getAccountInfo(configPDA)
  let feeBps = 10 // fallback to default
  if (configInfo) {
    // fee_bps is at offset 8 (discriminator) + 32 (authority) = 40, u16 LE
    feeBps = configInfo.data.readUInt16LE(40)
  }

  const feeAmount = (amount * BigInt(feeBps)) / 10_000n
  const netAmount = amount - feeAmount

  // Serialize instruction data
  // Layout: disc(8) + amount(8) + commitment(33) + stealth_pubkey(32)
  //       + ephemeral(33) + vk_hash(32) + encrypted_amount(4+len) + proof(4+len)
  const fixedSize = 8 + 8 + 33 + 32 + 33 + 32
  const vecOverhead = 4 + encryptedAmount.length + 4 + proof.length
  const data = Buffer.alloc(fixedSize + vecOverhead)
  let offset = 0

  // Discriminator
  anchorDiscriminator('withdraw_private').copy(data, offset)
  offset += 8

  // amount: u64 LE
  data.writeBigUInt64LE(amount, offset)
  offset += 8

  // amount_commitment: [u8; 33]
  Buffer.from(amountCommitment).copy(data, offset)
  offset += 33

  // stealth_pubkey: Pubkey (32 bytes)
  stealthPubkey.toBuffer().copy(data, offset)
  offset += 32

  // ephemeral_pubkey: [u8; 33]
  Buffer.from(ephemeralPubkey).copy(data, offset)
  offset += 33

  // viewing_key_hash: [u8; 32]
  Buffer.from(viewingKeyHash).copy(data, offset)
  offset += 32

  // encrypted_amount: Vec<u8> (4-byte LE length prefix + data)
  data.writeUInt32LE(encryptedAmount.length, offset)
  offset += 4
  Buffer.from(encryptedAmount).copy(data, offset)
  offset += encryptedAmount.length

  // proof: Vec<u8> (4-byte LE length prefix + data)
  data.writeUInt32LE(proof.length, offset)
  offset += 4
  Buffer.from(proof).copy(data, offset)

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: false },
      { pubkey: depositRecordPDA, isSigner: false, isWritable: true },
      { pubkey: vaultTokenPDA, isSigner: false, isWritable: true },
      { pubkey: feeTokenPDA, isSigner: false, isWritable: true },
      { pubkey: stealthTokenAccount, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
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
    netAmount,
    feeAmount,
    stealthAddress: stealthPubkey,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment scanning
// ─────────────────────────────────────────────────────────────────────────────

export interface ScanParams {
  connection: Connection
  /** The viewing private key used to check if payments are addressed to us */
  viewingPrivateKey: Uint8Array
  /** The spending public key to match against stealth addresses */
  spendingPublicKey: Uint8Array
  /** Maximum number of signatures to scan (default: 100) */
  limit?: number
  /** Signature to start scanning before (for pagination) */
  before?: string
  /** Program ID override */
  programId?: PublicKey
}

/**
 * Scan for payments addressed to the given viewing/spending keypair.
 *
 * This scans VaultWithdrawEvent logs emitted by the sipher_vault program.
 * For each event, it checks if the ephemeral pubkey + viewing private key
 * derives the stealth address matching our spending public key.
 *
 * NOTE: The actual stealth address matching requires @sip-protocol/sdk's
 * checkStealthAddress function. Task 5 (Integration) will wire this to
 * the real @sip-protocol/sdk. For now, this returns the raw parsed events
 * without filtering — callers can apply their own matching logic.
 */
export async function scanForPayments(
  params: ScanParams
): Promise<ScanResult> {
  const {
    connection,
    limit = 100,
    before,
    programId = SIPHER_VAULT_PROGRAM_ID,
  } = params

  // Fetch recent transaction signatures for the program
  const signatures = await connection.getSignaturesForAddress(
    programId,
    { limit, before },
    'confirmed'
  )

  if (signatures.length === 0) {
    return { payments: [], eventsScanned: 0, hasMore: false }
  }

  const payments: StealthPayment[] = []

  // Fetch transactions in batches to parse event logs
  const txSignatures = signatures.map((s) => s.signature)
  const transactions = await connection.getParsedTransactions(
    txSignatures,
    { maxSupportedTransactionVersion: 0 }
  )

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i]
    if (!tx?.meta?.logMessages) continue

    // Look for the Anchor event discriminator in logs
    // Anchor emits events as base64-encoded data after "Program data: " prefix
    for (const log of tx.meta.logMessages) {
      if (!log.startsWith('Program data: ')) continue

      const eventData = Buffer.from(log.slice('Program data: '.length), 'base64')

      // VaultWithdrawEvent discriminator check
      // Skip events that are too small to be a VaultWithdrawEvent
      // Min size: 8 (disc) + 32 (depositor) + 32 (stealth) + 33 (commitment)
      //         + 33 (ephemeral) + 32 (vk_hash) + 8 (amount) + 8 (fee) + 8 (ts) = 194
      if (eventData.length < 194) continue

      try {
        const payment = parseWithdrawEvent(eventData, txSignatures[i])
        if (payment) {
          payments.push(payment)
        }
      } catch {
        // Skip malformed events
      }
    }
  }

  return {
    payments,
    eventsScanned: signatures.length,
    hasMore: signatures.length === limit,
  }
}

/**
 * Parse a VaultWithdrawEvent from Anchor event data.
 *
 * Event layout (after 8-byte discriminator):
 *   depositor:          Pubkey  (32)
 *   stealth_recipient:  Pubkey  (32)
 *   amount_commitment:  [u8;33] (33)
 *   ephemeral_pubkey:   [u8;33] (33)
 *   viewing_key_hash:   [u8;32] (32)
 *   transfer_amount:    u64     (8)
 *   fee_amount:         u64     (8)
 *   timestamp:          i64     (8)
 */
function parseWithdrawEvent(
  data: Buffer,
  txSignature: string
): StealthPayment | null {
  if (data.length < 194) return null

  let offset = 8 // skip discriminator

  // depositor (skip, not needed in StealthPayment)
  offset += 32

  const stealthAddress = new PublicKey(data.subarray(offset, offset + 32))
  offset += 32

  const amountCommitment = new Uint8Array(data.subarray(offset, offset + 33))
  offset += 33

  const ephemeralPubkey = new Uint8Array(data.subarray(offset, offset + 33))
  offset += 33

  const viewingKeyHash = new Uint8Array(data.subarray(offset, offset + 32))
  offset += 32

  const transferAmount = data.readBigUInt64LE(offset)
  offset += 8

  const feeAmount = data.readBigUInt64LE(offset)
  offset += 8

  const timestamp = Number(data.readBigInt64LE(offset))

  return {
    stealthAddress,
    amountCommitment,
    ephemeralPubkey,
    viewingKeyHash,
    transferAmount,
    feeAmount,
    timestamp,
    txSignature,
  }
}
