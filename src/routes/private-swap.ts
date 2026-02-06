import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { validateRequest } from '../middleware/validation.js'
import { idempotency } from '../middleware/idempotency.js'
import { betaEndpoint, getBetaWarning } from '../middleware/beta.js'
import { buildPrivateSwap } from '../services/private-swap-builder.js'
import { isTokenSupported, getSupportedTokens } from '../services/jupiter-provider.js'
import { ErrorCode, getErrorEntry } from '../errors/codes.js'

const swapBeta = betaEndpoint('Private Swap uses a mock Jupiter provider. Real Jupiter integration coming soon.')

const router = Router()

// ─── Schema ────────────────────────────────────────────────────────────────

const hexString32 = z.string().regex(
  /^0x[0-9a-fA-F]{64}$/,
  'Must be 0x-prefixed 32-byte hex',
)

const solanaAddr = z.string().min(32).max(44)

const privateSwapSchema = z.object({
  sender: solanaAddr,
  inputMint: solanaAddr,
  inputAmount: z.string().regex(/^[1-9]\d*$/, 'Must be a positive integer'),
  outputMint: solanaAddr,
  slippageBps: z.number().int().min(1).max(10000).default(50),
  recipientMetaAddress: z.object({
    spendingKey: hexString32,
    viewingKey: hexString32,
    chain: z.literal('solana'),
    label: z.string().optional(),
  }).optional(),
})

// ─── POST /swap/private ─────────────────────────────────────────────────────

router.post(
  '/swap/private',
  swapBeta,
  idempotency,
  validateRequest({ body: privateSwapSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sender, inputMint, inputAmount, outputMint, slippageBps, recipientMetaAddress } = req.body

      // Pre-flight: same mint check
      if (inputMint === outputMint) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCode.SWAP_UNSUPPORTED_TOKEN,
            message: 'Input and output mints must be different',
          },
        })
        return
      }

      // Pre-flight: token support check
      const supported = getSupportedTokens()
      if (!isTokenSupported(inputMint)) {
        const entry = getErrorEntry(ErrorCode.SWAP_UNSUPPORTED_TOKEN)
        res.status(entry?.httpStatus ?? 400).json({
          success: false,
          error: {
            code: ErrorCode.SWAP_UNSUPPORTED_TOKEN,
            message: `Unsupported input token: ${inputMint}`,
            supportedTokens: Object.keys(supported),
          },
        })
        return
      }
      if (!isTokenSupported(outputMint)) {
        const entry = getErrorEntry(ErrorCode.SWAP_UNSUPPORTED_TOKEN)
        res.status(entry?.httpStatus ?? 400).json({
          success: false,
          error: {
            code: ErrorCode.SWAP_UNSUPPORTED_TOKEN,
            message: `Unsupported output token: ${outputMint}`,
            supportedTokens: Object.keys(supported),
          },
        })
        return
      }

      const result = await buildPrivateSwap({
        sender,
        inputMint,
        inputAmount,
        outputMint,
        slippageBps,
        recipientMetaAddress,
      })

      res.json({
        success: true,
        beta: true,
        warning: getBetaWarning(req),
        data: result,
      })
    } catch (err) {
      next(err)
    }
  }
)

export default router
