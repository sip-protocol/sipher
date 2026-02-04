import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { hexToBytes, bytesToHex } from '@noble/hashes/utils'
import { validateRequest } from '../middleware/validation.js'
import { idempotency } from '../middleware/idempotency.js'
import { getCSPLService } from '../services/cspl.js'
import { ErrorCode } from '../errors/codes.js'

const router = Router()

// ─── Schema Helpers ─────────────────────────────────────────────────────────

const solanaAddr = z.string().min(32).max(44)
const positiveIntString = z.string().regex(/^[1-9]\d*$/, 'Positive integer string')
const hexString = z.string().regex(/^0x[0-9a-fA-F]+$/, '0x-prefixed hex string')

// ─── Schemas ────────────────────────────────────────────────────────────────

const wrapSchema = z.object({
  mint: solanaAddr,
  amount: positiveIntString,
  owner: solanaAddr,
  createAccount: z.boolean().optional(),
})

const unwrapSchema = z.object({
  csplMint: z.string().min(1),
  encryptedAmount: hexString,
  owner: solanaAddr,
  proof: hexString.optional(),
})

const transferSchema = z.object({
  csplMint: z.string().min(1),
  from: solanaAddr,
  to: solanaAddr,
  encryptedAmount: hexString,
  memo: z.string().max(256).optional(),
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function toBytes(hex: string): Uint8Array {
  return hexToBytes(hex.slice(2))
}

function toHex(bytes: Uint8Array): string {
  return '0x' + bytesToHex(bytes)
}

// ─── Wrap ───────────────────────────────────────────────────────────────────

router.post(
  '/cspl/wrap',
  idempotency,
  validateRequest({ body: wrapSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = await getCSPLService()
      const { mint, amount, owner, createAccount } = req.body

      const result = await service.wrap({
        mint,
        amount: BigInt(amount),
        owner,
        createAccount: createAccount ?? true,
      })

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCode.CSPL_OPERATION_FAILED,
            message: result.error,
          },
        })
        return
      }

      res.json({
        success: true,
        data: {
          signature: result.signature,
          csplMint: result.csplMint,
          encryptedBalance: result.encryptedBalance ? toHex(result.encryptedBalance) : undefined,
          token: result.token,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

// ─── Unwrap ─────────────────────────────────────────────────────────────────

router.post(
  '/cspl/unwrap',
  idempotency,
  validateRequest({ body: unwrapSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = await getCSPLService()
      const { csplMint, encryptedAmount, owner, proof } = req.body

      const result = await service.unwrap({
        csplMint,
        encryptedAmount: toBytes(encryptedAmount),
        owner,
        proof: proof ? toBytes(proof) : undefined,
      })

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCode.CSPL_OPERATION_FAILED,
            message: result.error,
          },
        })
        return
      }

      res.json({
        success: true,
        data: {
          signature: result.signature,
          amount: result.amount?.toString(),
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

// ─── Transfer ───────────────────────────────────────────────────────────────

router.post(
  '/cspl/transfer',
  idempotency,
  validateRequest({ body: transferSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = await getCSPLService()
      const { csplMint, from, to, encryptedAmount, memo } = req.body

      const result = await service.transfer({
        csplMint,
        from,
        to,
        encryptedAmount: toBytes(encryptedAmount),
        memo,
      })

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCode.CSPL_OPERATION_FAILED,
            message: result.error,
          },
        })
        return
      }

      res.json({
        success: true,
        data: {
          signature: result.signature,
          newSenderBalance: result.newSenderBalance ? toHex(result.newSenderBalance) : undefined,
          recipientPendingUpdated: result.recipientPendingUpdated,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

export default router
