import { Router, type Request, type Response } from 'express'
import { executeDeposit } from '../tools/deposit.js'
import { loadNetworkConfig } from '../config/network.js'
import { DEFAULT_FEE_BPS } from '@sipher/sdk'

export const vaultDepositTxRouter = Router()

const VALID_TOKENS = ['SOL', 'USDC', 'USDT'] as const
type ValidToken = (typeof VALID_TOKENS)[number]

function isValidToken(token: unknown): token is ValidToken {
  return typeof token === 'string' && (VALID_TOKENS as readonly string[]).includes(token.toUpperCase())
}

vaultDepositTxRouter.post('/deposit-tx', async (req: Request, res: Response) => {
  const wallet = req.wallet
  if (!wallet) {
    res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authenticated wallet required',
      },
    })
    return
  }

  const network = loadNetworkConfig().clusterName
  if (network !== 'devnet') {
    res.status(409).json({
      error: {
        code: 'VAULT_UNAVAILABLE',
        message: 'Sipher Vault is on devnet only — switch network',
      },
    })
    return
  }

  const { amount, token } = req.body as { amount?: number; token?: string }

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({
      error: { code: 'INVALID_AMOUNT', message: 'Amount must be > 0' },
    })
    return
  }

  if (!isValidToken(token)) {
    res.status(400).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token must be SOL, USDC, or USDT',
      },
    })
    return
  }

  try {
    const result = await executeDeposit({ amount, token: token.toUpperCase(), wallet })
    if (!result.serializedTx) {
      res.status(500).json({
        error: {
          code: 'INTERNAL',
          message: 'deposit tool returned no serialized transaction',
        },
      })
      return
    }
    res.json({
      serializedTx: result.serializedTx,
      depositRecordAddress: result.details.depositRecordAddress,
      vaultTokenAddress: result.details.vaultTokenAddress,
      amountBaseUnits: result.details.amountBaseUnits,
      feeBps: DEFAULT_FEE_BPS,
      network,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    res.status(500).json({
      error: { code: 'INTERNAL', message },
    })
  }
})
