import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { commit, verifyOpening } from '@sip-protocol/sdk'
import type { HexString } from '@sip-protocol/types'
import { validateRequest } from '../middleware/validation.js'
import { hexToBytes } from '@noble/hashes/utils'

const router = Router()

// ─── Schemas ────────────────────────────────────────────────────────────────

const createSchema = z.object({
  value: z.string().regex(/^[0-9]+$/, 'Must be a non-negative integer string'),
  blindingFactor: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
})

const verifySchema = z.object({
  commitment: z.string().regex(/^0x[0-9a-fA-F]+$/),
  value: z.string().regex(/^[0-9]+$/, 'Must be a non-negative integer string'),
  blindingFactor: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
})

// ─── Routes ─────────────────────────────────────────────────────────────────

router.post(
  '/commitment/create',
  validateRequest({ body: createSchema }),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { value, blindingFactor } = req.body
      const valueBigInt = BigInt(value)

      let blinding: Uint8Array | undefined
      if (blindingFactor) {
        blinding = hexToBytes(blindingFactor.slice(2))
      }

      const result = commit(valueBigInt, blinding)

      res.json({
        success: true,
        data: {
          commitment: result.commitment,
          blindingFactor: result.blinding,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

router.post(
  '/commitment/verify',
  validateRequest({ body: verifySchema }),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { commitment, value, blindingFactor } = req.body

      const valid = verifyOpening(
        commitment as HexString,
        BigInt(value),
        blindingFactor as HexString
      )

      res.json({
        success: true,
        data: { valid },
      })
    } catch (err) {
      next(err)
    }
  }
)

export default router
