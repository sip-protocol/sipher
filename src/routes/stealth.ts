import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import {
  generateEd25519StealthMetaAddress,
  generateEd25519StealthAddress,
  checkEd25519StealthAddress,
} from '@sip-protocol/sdk'
import type { StealthMetaAddress, HexString } from '@sip-protocol/types'
import { validateRequest } from '../middleware/validation.js'

const router = Router()

// ─── Schemas ────────────────────────────────────────────────────────────────

const hexString = z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Must be a 0x-prefixed 32-byte hex string')

const generateSchema = z.object({
  label: z.string().optional(),
})

const deriveSchema = z.object({
  recipientMetaAddress: z.object({
    spendingKey: hexString,
    viewingKey: hexString,
    chain: z.literal('solana'),
    label: z.string().optional(),
  }),
})

const checkSchema = z.object({
  stealthAddress: z.object({
    address: hexString,
    ephemeralPublicKey: hexString,
    viewTag: z.number().int().min(0).max(255),
  }),
  spendingPrivateKey: hexString,
  viewingPrivateKey: hexString,
})

// ─── Routes ─────────────────────────────────────────────────────────────────

router.post(
  '/stealth/generate',
  validateRequest({ body: generateSchema }),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { label } = req.body

      const result = generateEd25519StealthMetaAddress('solana', label)

      res.json({
        success: true,
        data: {
          metaAddress: result.metaAddress,
          spendingPrivateKey: result.spendingPrivateKey,
          viewingPrivateKey: result.viewingPrivateKey,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

router.post(
  '/stealth/derive',
  validateRequest({ body: deriveSchema }),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { recipientMetaAddress } = req.body

      const meta: StealthMetaAddress = {
        spendingKey: recipientMetaAddress.spendingKey as HexString,
        viewingKey: recipientMetaAddress.viewingKey as HexString,
        chain: recipientMetaAddress.chain,
        label: recipientMetaAddress.label,
      }

      const result = generateEd25519StealthAddress(meta)

      res.json({
        success: true,
        data: {
          stealthAddress: result.stealthAddress,
          sharedSecret: result.sharedSecret,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

router.post(
  '/stealth/check',
  validateRequest({ body: checkSchema }),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { stealthAddress, spendingPrivateKey, viewingPrivateKey } = req.body

      const isOwner = checkEd25519StealthAddress(
        {
          address: stealthAddress.address as HexString,
          ephemeralPublicKey: stealthAddress.ephemeralPublicKey as HexString,
          viewTag: stealthAddress.viewTag,
        },
        spendingPrivateKey as HexString,
        viewingPrivateKey as HexString
      )

      res.json({
        success: true,
        data: { isOwner },
      })
    } catch (err) {
      next(err)
    }
  }
)

export default router
