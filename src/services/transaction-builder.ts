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
import { getConnection } from './solana.js'

export interface UnsignedTransferResult {
  transaction: string // base64-encoded unsigned transaction
  stealthAddress: string
  ephemeralPublicKey: string
  commitment: string
  viewTag: string
  viewingKeyHash: string
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
