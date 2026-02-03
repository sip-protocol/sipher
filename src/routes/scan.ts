import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { checkEd25519StealthAddress } from '@sip-protocol/sdk'
import type { StealthAddress, HexString } from '@sip-protocol/types'
import { validateRequest } from '../middleware/validation.js'
import { getConnection } from '../services/solana.js'
import { PublicKey } from '@solana/web3.js'
import { bytesToHex } from '@noble/hashes/utils'

const router = Router()

const SIP_MEMO_PREFIX = 'SIP:'

// ─── Schemas ────────────────────────────────────────────────────────────────

const hexString = z.string().regex(/^0x[0-9a-fA-F]{64}$/)

const scanSchema = z.object({
  viewingPrivateKey: hexString,
  spendingPublicKey: hexString,
  fromSlot: z.number().int().min(0).optional(),
  toSlot: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(1000).default(100),
})

// ─── Routes ─────────────────────────────────────────────────────────────────

router.post(
  '/scan/payments',
  validateRequest({ body: scanSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { viewingPrivateKey, spendingPublicKey, fromSlot, toSlot, limit } = req.body
      const connection = getConnection()

      // Scan memo program for SIP announcements
      const memoProgram = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

      const signatures = await connection.getSignaturesForAddress(memoProgram, {
        limit,
        minContextSlot: fromSlot,
      })

      const filtered = toSlot
        ? signatures.filter(s => s.slot <= toSlot)
        : signatures

      const results: Array<{
        stealthAddress: string
        ephemeralPublicKey: string
        txSignature: string
        slot: number
        timestamp: number
      }> = []

      for (const sigInfo of filtered) {
        try {
          const tx = await connection.getTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0,
          })

          if (!tx?.meta?.logMessages) continue

          for (const log of tx.meta.logMessages) {
            if (!log.includes(SIP_MEMO_PREFIX)) continue

            const memoMatch = log.match(/Program log: (.+)/)
            if (!memoMatch) continue

            // Parse announcement: SIP:<ephemeralPubKey>:<viewTag>:<stealthAddress>
            const parts = memoMatch[1].replace(SIP_MEMO_PREFIX, '').split(':')
            if (parts.length < 3) continue

            const [ephemeralB58, viewTagHex, stealthB58] = parts

            let ephemeralHex: HexString
            let stealthHex: HexString
            try {
              const ephPubkey = new PublicKey(ephemeralB58)
              const stPubkey = new PublicKey(stealthB58)
              ephemeralHex = `0x${bytesToHex(ephPubkey.toBytes())}` as HexString
              stealthHex = `0x${bytesToHex(stPubkey.toBytes())}` as HexString
            } catch {
              continue
            }

            const viewTagNumber = parseInt(viewTagHex, 16)
            if (isNaN(viewTagNumber) || viewTagNumber < 0 || viewTagNumber > 255) continue

            const stealthAddressObj: StealthAddress = {
              address: stealthHex,
              ephemeralPublicKey: ephemeralHex,
              viewTag: viewTagNumber,
            }

            let isOurs = false
            try {
              isOurs = checkEd25519StealthAddress(
                stealthAddressObj,
                viewingPrivateKey as HexString,
                spendingPublicKey as HexString
              )
            } catch {
              continue
            }

            if (isOurs) {
              results.push({
                stealthAddress: stealthB58,
                ephemeralPublicKey: ephemeralB58,
                txSignature: sigInfo.signature,
                slot: sigInfo.slot,
                timestamp: sigInfo.blockTime || 0,
              })
            }
          }
        } catch {
          // Skip failed tx parsing
        }
      }

      res.json({
        success: true,
        data: {
          payments: results,
          scanned: filtered.length,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

export default router
