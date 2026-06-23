import {
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { sha256 } from '@noble/hashes/sha2.js'
import { getConnection } from './solana.js'

export interface UnsignedTransferResult {
  transaction: string // base64-encoded unsigned transaction
  stealthAddress: string
  ephemeralPublicKey: string
  commitment: string
  viewTag: string
  viewingKeyHash: string
}

// ─── SIP Privacy Program Constants ────────────────────────────────────────────

const SIP_PRIVACY_PROGRAM_ID = new PublicKey('S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at')
const CONFIG_PDA = new PublicKey('BVawZkppFewygA5nxdrLma4ThKx8Th7bW4KTCkcWTZwZ')
const FEE_COLLECTOR = new PublicKey('S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd')
const TRANSFER_RECORD_SEED = Buffer.from('transfer_record')
const SHIELDED_TRANSFER_DISCRIMINATOR = Buffer.from([0x9d, 0x2a, 0x42, 0x93, 0xee, 0x75, 0x61, 0x5c])

// ─── Anchor Shield Types ──────────────────────────────────────────────────────

export interface AnchorShieldParams {
  sender: string
  stealthAddress: string
  amount: bigint
  commitment: string        // hex, 33-byte compressed point
  blindingFactor: string    // hex
  ephemeralPublicKey: string // hex
  viewingKeyHash: string    // hex
}

export interface AnchorShieldResult {
  transaction: string       // base64 unsigned
  noteId: string            // transfer record PDA (base58)
  encryptedAmount: string   // hex
  instructionType: 'anchor'
}

// ─── Anchor Helpers ───────────────────────────────────────────────────────────

function bigintToLeBytes(value: bigint, size = 8): Uint8Array {
  const buf = new Uint8Array(size)
  let v = value
  for (let i = 0; i < size; i++) {
    buf[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return buf
}

function encryptAmount(amount: bigint, viewingKeyHash: Uint8Array): Uint8Array {
  const amountBytes = bigintToLeBytes(amount)
  const mask = sha256(viewingKeyHash)
  const encrypted = new Uint8Array(8)
  for (let i = 0; i < 8; i++) {
    encrypted[i] = amountBytes[i] ^ mask[i]
  }
  return encrypted
}

function createMockProof(commitment: Uint8Array, amount: bigint, blinding: Uint8Array): Uint8Array {
  // Deterministic 128-byte proof: sha256(commitment || amount || blinding) repeated 4x
  const amountBytes = bigintToLeBytes(amount)
  const input = new Uint8Array(commitment.length + amountBytes.length + blinding.length)
  input.set(commitment, 0)
  input.set(amountBytes, commitment.length)
  input.set(blinding, commitment.length + amountBytes.length)
  const hash = sha256(input)
  const proof = new Uint8Array(128)
  for (let i = 0; i < 4; i++) {
    proof.set(hash, i * 32)
  }
  return proof
}

function buildShieldedTransferData(
  commitment: Uint8Array,
  stealthPubkey: Uint8Array,
  ephemeralPubkey: Uint8Array,
  viewingKeyHash: Uint8Array,
  encryptedAmount: Uint8Array,
  proof: Uint8Array,
  amount: bigint,
): Buffer {
  // Layout: discriminator(8) + commitment(33) + stealth(32) + ephemeral(32) +
  //         viewingKeyHash(32) + encryptedAmount(8) + proof(128) + amount(8)
  const totalSize = 8 + 33 + 32 + 32 + 32 + 8 + 128 + 8
  const buf = Buffer.alloc(totalSize)
  let offset = 0

  // Discriminator
  SHIELDED_TRANSFER_DISCRIMINATOR.copy(buf, offset)
  offset += 8

  // Commitment (33 bytes — compressed point)
  Buffer.from(commitment).copy(buf, offset)
  offset += 33

  // Stealth public key (32 bytes)
  Buffer.from(stealthPubkey).copy(buf, offset)
  offset += 32

  // Ephemeral public key (32 bytes)
  Buffer.from(ephemeralPubkey).copy(buf, offset)
  offset += 32

  // Viewing key hash (32 bytes)
  Buffer.from(viewingKeyHash).copy(buf, offset)
  offset += 32

  // Encrypted amount (8 bytes)
  Buffer.from(encryptedAmount).copy(buf, offset)
  offset += 8

  // Proof (128 bytes)
  Buffer.from(proof).copy(buf, offset)
  offset += 128

  // Amount in lamports (8 bytes LE)
  const amountLeBytes = bigintToLeBytes(amount)
  Buffer.from(amountLeBytes).copy(buf, offset)

  return buf
}

/**
 * Build an unsigned shielded SOL transfer through the SIP Privacy Anchor program.
 * Creates a transfer record PDA on-chain with commitment, encrypted amount, and viewing key hash.
 */
export async function buildAnchorShieldedSolTransfer(params: AnchorShieldParams): Promise<AnchorShieldResult> {
  const connection = getConnection()
  const senderPubkey = new PublicKey(params.sender)
  const stealthPubkey = new PublicKey(params.stealthAddress)

  // Fetch CONFIG_PDA to read total_transfers counter
  const configAccount = await connection.getAccountInfo(CONFIG_PDA)
  if (!configAccount) {
    throw new Error('CONFIG_PDA account not found — Anchor program may not be deployed')
  }

  // Parse total_transfers at byte offset 43 as u64 LE
  const totalTransfersBytes = configAccount.data.subarray(43, 51)
  let totalTransfers = 0n
  for (let i = 7; i >= 0; i--) {
    totalTransfers = (totalTransfers << 8n) | BigInt(totalTransfersBytes[i])
  }

  // Derive transfer record PDA
  const totalTransfersLeBytes = bigintToLeBytes(totalTransfers)
  const [transferRecordPda] = PublicKey.findProgramAddressSync(
    [TRANSFER_RECORD_SEED, senderPubkey.toBuffer(), Buffer.from(totalTransfersLeBytes)],
    SIP_PRIVACY_PROGRAM_ID,
  )

  // Parse hex inputs
  const commitmentHex = params.commitment.startsWith('0x') ? params.commitment.slice(2) : params.commitment
  const commitmentBytes = Uint8Array.from(Buffer.from(commitmentHex, 'hex'))

  const blindingHex = params.blindingFactor.startsWith('0x') ? params.blindingFactor.slice(2) : params.blindingFactor
  const blindingBytes = Uint8Array.from(Buffer.from(blindingHex, 'hex'))

  const ephemeralHex = params.ephemeralPublicKey.startsWith('0x') ? params.ephemeralPublicKey.slice(2) : params.ephemeralPublicKey
  const ephemeralBytes = Uint8Array.from(Buffer.from(ephemeralHex, 'hex'))

  const vkHashHex = params.viewingKeyHash.startsWith('0x') ? params.viewingKeyHash.slice(2) : params.viewingKeyHash
  const vkHashBytes = Uint8Array.from(Buffer.from(vkHashHex, 'hex'))

  // Encrypt amount with viewing key hash
  const encryptedAmountBytes = encryptAmount(params.amount, vkHashBytes)

  // Create mock proof
  const proof = createMockProof(commitmentBytes, params.amount, blindingBytes)

  // Build instruction data
  const data = buildShieldedTransferData(
    commitmentBytes,
    stealthPubkey.toBytes(),
    ephemeralBytes,
    vkHashBytes,
    encryptedAmountBytes,
    proof,
    params.amount,
  )

  // Build instruction with 6 accounts
  const instruction = new TransactionInstruction({
    programId: SIP_PRIVACY_PROGRAM_ID,
    keys: [
      { pubkey: CONFIG_PDA, isSigner: false, isWritable: true },
      { pubkey: transferRecordPda, isSigner: false, isWritable: true },
      { pubkey: senderPubkey, isSigner: true, isWritable: true },
      { pubkey: stealthPubkey, isSigner: false, isWritable: true },
      { pubkey: FEE_COLLECTOR, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })

  // Build unsigned transaction
  const tx = new Transaction()
  tx.add(instruction)

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.lastValidBlockHeight = lastValidBlockHeight
  tx.feePayer = senderPubkey

  const transaction = Buffer.from(tx.serialize({ requireAllSignatures: false })).toString('base64')
  const encryptedAmountHex = `0x${Buffer.from(encryptedAmountBytes).toString('hex')}`

  return {
    transaction,
    noteId: transferRecordPda.toBase58(),
    encryptedAmount: encryptedAmountHex,
    instructionType: 'anchor',
  }
}

/**
 * Build an unsigned SOL transfer to a stealth address
 */
export async function buildShieldedSolTransfer(params: {
  sender: string
  stealthAddress: string
  amount: bigint
}): Promise<string> {
  const connection = getConnection()
  const senderPubkey = new PublicKey(params.sender)
  const stealthPubkey = new PublicKey(params.stealthAddress)

  const tx = new Transaction()
  tx.add(
    SystemProgram.transfer({
      fromPubkey: senderPubkey,
      toPubkey: stealthPubkey,
      lamports: params.amount,
    })
  )

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.lastValidBlockHeight = lastValidBlockHeight
  tx.feePayer = senderPubkey

  return Buffer.from(tx.serialize({ requireAllSignatures: false })).toString('base64')
}

/**
 * Build an unsigned SPL token transfer to a stealth address
 */
export async function buildShieldedSplTransfer(params: {
  sender: string
  stealthAddress: string
  mint: string
  amount: bigint
}): Promise<string> {
  const connection = getConnection()
  const senderPubkey = new PublicKey(params.sender)
  const stealthPubkey = new PublicKey(params.stealthAddress)
  const mintPubkey = new PublicKey(params.mint)

  const senderATA = await getAssociatedTokenAddress(mintPubkey, senderPubkey)
  const stealthATA = await getAssociatedTokenAddress(mintPubkey, stealthPubkey, true)

  const tx = new Transaction()

  // Check if stealth ATA exists, if not create it
  const stealthATAInfo = await connection.getAccountInfo(stealthATA)
  if (!stealthATAInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        senderPubkey,
        stealthATA,
        stealthPubkey,
        mintPubkey
      )
    )
  }

  tx.add(
    createTransferInstruction(
      senderATA,
      stealthATA,
      senderPubkey,
      params.amount
    )
  )

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.lastValidBlockHeight = lastValidBlockHeight
  tx.feePayer = senderPubkey

  return Buffer.from(tx.serialize({ requireAllSignatures: false })).toString('base64')
}
