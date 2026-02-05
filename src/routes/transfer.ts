import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import {
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
  deriveEd25519StealthPrivateKey,
  checkEd25519StealthAddress,
} from '@sip-protocol/sdk'
import { commit } from '@sip-protocol/sdk'
import type { StealthMetaAddress, StealthAddress, HexString } from '@sip-protocol/types'
import { validateRequest } from '../middleware/validation.js'
import { idempotency } from '../middleware/idempotency.js'
import { buildShieldedSolTransfer, buildShieldedSplTransfer } from '../services/transaction-builder.js'
import { getConnection } from '../services/solana.js'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { PublicKey, Keypair, Transaction } from '@solana/web3.js'
import { getAssociatedTokenAddress, createTransferInstruction, getAccount } from '@solana/spl-token'
import { ed25519 } from '@noble/curves/ed25519'

const router = Router()

// ─── Schemas ────────────────────────────────────────────────────────────────

const hexString = z.string().regex(/^0x[0-9a-fA-F]{64}$/)

const shieldSchema = z.object({
  sender: z.string().min(32).max(44),
  recipientMetaAddress: z.object({
    spendingKey: hexString,
    viewingKey: hexString,
    chain: z.literal('solana'),
    label: z.string().optional(),
  }),
  amount: z.string().regex(/^[1-9]\d*$/, 'Must be a positive integer'),
  mint: z.string().min(32).max(44).optional(),
})

const claimSchema = z.object({
  stealthAddress: z.string().min(32).max(44),
  ephemeralPublicKey: z.string().min(32).max(44),
  spendingPrivateKey: hexString,
  viewingPrivateKey: hexString,
  destinationAddress: z.string().min(32).max(44),
  mint: z.string().min(32).max(44),
  dryRun: z.boolean().optional().default(false),
})

// ─── Routes ─────────────────────────────────────────────────────────────────

router.post(
  '/transfer/shield',
  idempotency,
  validateRequest({ body: shieldSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sender, recipientMetaAddress, amount, mint } = req.body
      const amountBigInt = BigInt(amount)

      // Build stealth address
      const meta: StealthMetaAddress = {
        spendingKey: recipientMetaAddress.spendingKey as HexString,
        viewingKey: recipientMetaAddress.viewingKey as HexString,
        chain: 'solana',
        label: recipientMetaAddress.label,
      }

      const stealthResult = generateEd25519StealthAddress(meta)
      const stealthSolanaAddr = ed25519PublicKeyToSolanaAddress(stealthResult.stealthAddress.address)

      // Pedersen commitment
      const { commitment, blinding } = commit(amountBigInt)

      // Viewing key hash
      const viewingKeyBytes = hexToBytes(recipientMetaAddress.viewingKey.slice(2))
      const viewingKeyHash = `0x${bytesToHex(sha256(viewingKeyBytes))}`

      // Build unsigned transaction
      let transaction: string
      if (mint) {
        transaction = await buildShieldedSplTransfer({
          sender,
          stealthAddress: stealthSolanaAddr,
          mint,
          amount: amountBigInt,
        })
      } else {
        transaction = await buildShieldedSolTransfer({
          sender,
          stealthAddress: stealthSolanaAddr,
          amount: amountBigInt,
        })
      }

      res.json({
        success: true,
        data: {
          transaction,
          stealthAddress: stealthSolanaAddr,
          ephemeralPublicKey: stealthResult.stealthAddress.ephemeralPublicKey,
          viewTag: stealthResult.stealthAddress.viewTag,
          commitment,
          blindingFactor: blinding,
          viewingKeyHash,
          sharedSecret: stealthResult.sharedSecret,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

router.post(
  '/transfer/claim',
  idempotency,
  validateRequest({ body: claimSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        stealthAddress,
        ephemeralPublicKey,
        spendingPrivateKey,
        viewingPrivateKey,
        destinationAddress,
        mint,
        dryRun,
      } = req.body

      const connection = getConnection()

      // Convert Solana base58 addresses to ed25519 hex for SDK
      const stealthPubkey = new PublicKey(stealthAddress)
      const ephemeralPubkey = new PublicKey(ephemeralPublicKey)

      const stealthHex = `0x${bytesToHex(stealthPubkey.toBytes())}` as HexString
      const ephemeralHex = `0x${bytesToHex(ephemeralPubkey.toBytes())}` as HexString

      const stealthAddressObj: StealthAddress = {
        address: stealthHex,
        ephemeralPublicKey: ephemeralHex,
        viewTag: 0,
      }

      // Derive stealth private key
      const recovery = deriveEd25519StealthPrivateKey(
        stealthAddressObj,
        spendingPrivateKey as HexString,
        viewingPrivateKey as HexString
      )

      // Build and sign claim transaction
      const stealthPrivKeyBytes = hexToBytes(recovery.privateKey.slice(2))
      const expectedPubKeyBytes = stealthPubkey.toBytes()

      // Validate derived key
      const scalarBigInt = bytesToBigIntLE(stealthPrivKeyBytes)
      const ED25519_ORDER = 2n ** 252n + 27742317777372353535851937790883648493n
      let validScalar = scalarBigInt % ED25519_ORDER
      if (validScalar === 0n) validScalar = 1n

      const derivedPubKeyBytes = ed25519.ExtendedPoint.BASE.multiply(validScalar).toRawBytes()
      if (!derivedPubKeyBytes.every((b, i) => b === expectedPubKeyBytes[i])) {
        throw new Error('Stealth key derivation failed: derived key does not match expected public key')
      }

      const stealthKeypair = Keypair.fromSecretKey(
        new Uint8Array([...stealthPrivKeyBytes, ...expectedPubKeyBytes])
      )

      const mintPubkey = new PublicKey(mint)
      const stealthATA = await getAssociatedTokenAddress(mintPubkey, stealthPubkey, true)
      const destinationPubkey = new PublicKey(destinationAddress)
      const destinationATA = await getAssociatedTokenAddress(mintPubkey, destinationPubkey)

      const stealthAccount = await getAccount(connection, stealthATA)
      const tokenAmount = stealthAccount.amount

      const tx = new Transaction()
      tx.add(
        createTransferInstruction(stealthATA, destinationATA, stealthPubkey, tokenAmount)
      )

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash
      tx.lastValidBlockHeight = lastValidBlockHeight
      tx.feePayer = stealthPubkey

      tx.sign(stealthKeypair)

      // DRY RUN: Simulate transaction without sending
      if (dryRun) {
        const simulation = await connection.simulateTransaction(tx, [stealthKeypair])

        const estimatedFee = await connection.getFeeForMessage(tx.compileMessage())

        res.json({
          success: true,
          data: {
            dryRun: true,
            simulation: {
              success: simulation.value.err === null,
              error: simulation.value.err,
              logs: simulation.value.logs,
              unitsConsumed: simulation.value.unitsConsumed,
            },
            transaction: {
              stealthAddress,
              destinationAddress,
              amount: tokenAmount.toString(),
              estimatedFee: estimatedFee.value?.toString() ?? null,
            },
            warning: 'This was a simulation. No tokens were transferred. Set dryRun: false to execute.',
          },
        })
        return
      }

      // REAL EXECUTION: Send and confirm transaction
      const txSignature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      })

      await connection.confirmTransaction(
        { signature: txSignature, blockhash, lastValidBlockHeight },
        'confirmed'
      )

      res.json({
        success: true,
        data: {
          dryRun: false,
          txSignature,
          destinationAddress,
          amount: tokenAmount.toString(),
          explorerUrl: `https://solscan.io/tx/${txSignature}`,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

function bytesToBigIntLE(bytes: Uint8Array): bigint {
  let result = 0n
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i])
  }
  return result
}

export default router
