import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { checkEd25519StealthAddress } from '@sip-protocol/sdk'
import type { StealthAddress } from '@sip-protocol/sdk'
import { ed25519 } from '@noble/curves/ed25519'
import { sha256 as sha256Hash } from '@noble/hashes/sha256'
import { sha512 } from '@noble/hashes/sha512'
import {
  SIPHER_VAULT_PROGRAM_ID,
  SIP_PRIVACY_PROGRAM_ID,
  VAULT_CONFIG_SEED,
  DEPOSIT_RECORD_SEED,
  VAULT_TOKEN_SEED,
  FEE_TOKEN_SEED,
  SIP_CONFIG_SEED,
  SIP_TRANSFER_RECORD_SEED,
  ANCHOR_DISCRIMINATOR_SIZE,
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
 *   0. config              (ro)   — VaultConfig PDA
 *   1. deposit_record      (mut)  — DepositRecord PDA
 *   2. vault_token         (mut)  — Vault token PDA
 *   3. fee_token           (mut)  — Fee token PDA
 *   4. stealth_token       (mut)  — Stealth recipient's token account
 *   5. token_mint          (ro)   — SPL token mint
 *   6. depositor           (mut, signer)
 *   7. token_program       (ro)
 *   8. sip_config          (mut)  — SIP Privacy Config PDA (for CPI)
 *   9. sip_transfer_record (mut)  — TransferRecord PDA (init by CPI)
 *  10. sip_privacy_program (ro)   — SIP Privacy program
 *  11. system_program      (ro)   — System program (for CPI init)
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

  // Derive sipher_vault PDAs
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

  // Derive sip_privacy PDAs for CPI (create_transfer_announcement)
  const [sipConfigPDA] = PublicKey.findProgramAddressSync(
    [SIP_CONFIG_SEED],
    SIP_PRIVACY_PROGRAM_ID
  )

  // Fetch both configs in parallel: vault (for fee) + sip_privacy (for total_transfers)
  const [configInfo, sipConfigInfo] = await Promise.all([
    connection.getAccountInfo(configPDA),
    connection.getAccountInfo(sipConfigPDA),
  ])

  let feeBps = 10 // fallback to default
  if (configInfo) {
    // fee_bps is at offset 8 (discriminator) + 32 (authority) = 40, u16 LE
    feeBps = configInfo.data.readUInt16LE(40)
  }

  // Read total_transfers from sip_privacy Config to derive the TransferRecord PDA.
  // SIP Privacy Config layout (after 8-byte disc): authority(32) + fee_bps(2) + paused(1) + total_transfers(u64, 8)
  let sipTotalTransfers = 0n
  if (sipConfigInfo) {
    sipTotalTransfers = sipConfigInfo.data.readBigUInt64LE(
      ANCHOR_DISCRIMINATOR_SIZE + 32 + 2 + 1
    )
  }

  // TransferRecord PDA: [b"transfer_record", sender, total_transfers.to_le_bytes()]
  const totalTransfersBuffer = Buffer.alloc(8)
  totalTransfersBuffer.writeBigUInt64LE(sipTotalTransfers)
  const [sipTransferRecordPDA] = PublicKey.findProgramAddressSync(
    [SIP_TRANSFER_RECORD_SEED, depositor.toBuffer(), totalTransfersBuffer],
    SIP_PRIVACY_PROGRAM_ID
  )

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
      // Original WithdrawPrivate accounts
      { pubkey: configPDA, isSigner: false, isWritable: false },
      { pubkey: depositRecordPDA, isSigner: false, isWritable: true },
      { pubkey: vaultTokenPDA, isSigner: false, isWritable: true },
      { pubkey: feeTokenPDA, isSigner: false, isWritable: true },
      { pubkey: stealthTokenAccount, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: depositor, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      // CPI accounts for sip_privacy::create_transfer_announcement
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

// ─────────────────────────────────────────────────────────────────────────────
// Payment scanning
// ─────────────────────────────────────────────────────────────────────────────

export interface ScanParams {
  connection: Connection
  /** The viewing private key used to derive shared secrets for stealth matching */
  viewingPrivateKey: Uint8Array
  /** The spending private key used to verify stealth address ownership */
  spendingPrivateKey: Uint8Array
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
 * For each event, it reconstructs a StealthAddress from the on-chain data
 * and calls checkEd25519StealthAddress to verify the payment is addressed
 * to our keypair. Only matching payments are returned.
 */
export async function scanForPayments(
  params: ScanParams
): Promise<ScanResult> {
  const {
    connection,
    viewingPrivateKey,
    spendingPrivateKey,
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

  // Convert keypair bytes to 0x-prefixed hex for @sip-protocol/sdk
  const spendingKeyHex = bytesToHex(spendingPrivateKey) as `0x${string}`
  const viewingKeyHex = bytesToHex(viewingPrivateKey) as `0x${string}`

  // Pre-compute the spending scalar for viewTag derivation.
  // checkEd25519StealthAddress uses viewTag as an early-exit filter,
  // but on-chain events don't store the viewTag. We compute it here
  // so the check function doesn't reject valid payments.
  const spendingScalar = deriveEd25519Scalar(spendingPrivateKey)

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
        if (!payment) continue

        // Check if this payment is addressed to us using stealth address matching.
        // The ephemeral pubkey is stored as 33 bytes on-chain (0x00 prefix + 32-byte ed25519).
        // Strip the prefix to get the raw 32-byte ed25519 pubkey for matching.
        const ephRaw = payment.ephemeralPubkey[0] === 0x00
          ? payment.ephemeralPubkey.slice(1)
          : payment.ephemeralPubkey

        // Skip events with zero-filled ephemeral keys (pre-integration placeholder sends)
        if (ephRaw.every((b) => b === 0)) continue

        // Compute viewTag: sha256(spendingScalar * ephemeralPub)[0]
        // This matches what checkEd25519StealthAddress does internally.
        const ephPoint = ed25519.ExtendedPoint.fromHex(ephRaw)
        const sharedSecretPoint = ephPoint.multiply(spendingScalar)
        const sharedSecretHash = sha256Hash(sharedSecretPoint.toRawBytes())
        const viewTag = sharedSecretHash[0]

        const stealthAddr: StealthAddress = {
          address: bytesToHex(payment.stealthAddress.toBytes()) as `0x${string}`,
          ephemeralPublicKey: bytesToHex(ephRaw) as `0x${string}`,
          viewTag,
        }

        if (checkEd25519StealthAddress(stealthAddr, spendingKeyHex, viewingKeyHex)) {
          payments.push(payment)
        }
      } catch {
        // Skip malformed events or failed stealth checks
      }
    }
  }

  return {
    payments,
    eventsScanned: signatures.length,
    hasMore: signatures.length === limit,
  }
}

/** Convert Uint8Array to 0x-prefixed hex string */
function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** ed25519 curve order */
const ED25519_ORDER = 2n ** 252n + 27742317777372353535851937790883648493n

/**
 * Derive the ed25519 scalar from a raw private key (matches @sip-protocol/sdk internals).
 * SHA-512 hash -> clamp lower 32 bytes -> convert to little-endian bigint -> mod n
 */
function deriveEd25519Scalar(privateKey: Uint8Array): bigint {
  const hash = sha512(privateKey)
  const scalar = hash.slice(0, 32)
  scalar[0] &= 248
  scalar[31] &= 127
  scalar[31] |= 64
  let value = 0n
  for (let i = 0; i < 32; i++) {
    value |= BigInt(scalar[i]) << BigInt(i * 8)
  }
  return value % ED25519_ORDER
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
