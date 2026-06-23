import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { commit, verifyOpening, addCommitments, subtractCommitments, addBlindings, subtractBlindings } from '@sip-protocol/sdk'
import type { HexString } from '@sip-protocol/types'
import { validateRequest } from '../middleware/validation.js'
import { idempotency } from '../middleware/idempotency.js'
import { hexToBytes } from '@noble/hashes/utils.js'

const router = Router()

const BATCH_MAX = 100

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
  idempotency,
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

// ─── Batch ──────────────────────────────────────────────────────────────────

const batchCreateSchema = z.object({
  items: z.array(
    z.object({
      value: z.string().regex(/^[0-9]+$/, 'Must be a non-negative integer string'),
      blindingFactor: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
    })
  ).min(1).max(BATCH_MAX),
})

router.post(
  '/commitment/create/batch',
  validateRequest({ body: batchCreateSchema }),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { items } = req.body

      const results: Array<{
        index: number
        success: boolean
        data?: { commitment: string; blindingFactor: string }
        error?: string
      }> = []

      for (let i = 0; i < items.length; i++) {
        try {
          const { value, blindingFactor } = items[i]
          const valueBigInt = BigInt(value)

          let blinding: Uint8Array | undefined
          if (blindingFactor) {
            blinding = hexToBytes(blindingFactor.slice(2))
          }

          const result = commit(valueBigInt, blinding)

          results.push({
            index: i,
            success: true,
            data: {
              commitment: result.commitment as string,
              blindingFactor: result.blinding as string,
            },
          })
        } catch (err: unknown) {
          results.push({
            index: i,
            success: false,
            error: err instanceof Error ? err.message : 'Commitment failed',
          })
        }
      }

      const succeeded = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length

      res.json({
        success: true,
        data: {
          results,
          summary: { total: items.length, succeeded, failed },
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

// ─── Homomorphic Operations ──────────────────────────────────────────────────

const homomorphicSchema = z.object({
  commitmentA: z.string().regex(/^0x[0-9a-fA-F]+$/),
  commitmentB: z.string().regex(/^0x[0-9a-fA-F]+$/),
  blindingA: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  blindingB: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
})

router.post(
  '/commitment/add',
  validateRequest({ body: homomorphicSchema }),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { commitmentA, commitmentB, blindingA, blindingB } = req.body

      const result = addCommitments(
        commitmentA as HexString,
        commitmentB as HexString
      )
      const combinedBlinding = addBlindings(
        blindingA as HexString,
        blindingB as HexString
      )

      res.json({
        success: true,
        data: {
          commitment: result.commitment,
          blindingFactor: combinedBlinding,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

router.post(
  '/commitment/subtract',
  validateRequest({ body: homomorphicSchema }),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { commitmentA, commitmentB, blindingA, blindingB } = req.body

      const result = subtractCommitments(
        commitmentA as HexString,
        commitmentB as HexString
      )
      const combinedBlinding = subtractBlindings(
        blindingA as HexString,
        blindingB as HexString
      )

      res.json({
        success: true,
        data: {
          commitment: result.commitment,
          blindingFactor: combinedBlinding,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

export default router
