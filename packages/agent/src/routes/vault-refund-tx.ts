import { Router, type Request, type Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import {
  getVaultBalance,
  buildRefundTx,
  createConnection,
  resolveTokenMint,
  SIPHER_VAULT_PROGRAM_ID,
  DEFAULT_REFUND_TIMEOUT,
} from '@sipher/sdk'
import { loadNetworkConfig } from '../config/network.js'

const VALID_TOKENS = ['SOL', 'USDC', 'USDT'] as const
type ValidToken = (typeof VALID_TOKENS)[number]

function isValidToken(token: unknown): token is ValidToken {
  return typeof token === 'string' && (VALID_TOKENS as readonly string[]).includes(token.toUpperCase())
}

export const vaultRefundTxRouter = Router()

vaultRefundTxRouter.post('/refund-tx', async (req: Request, res: Response) => {
  const wallet = req.wallet
  if (!wallet) {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Authenticated wallet required' },
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

  const { token } = req.body as { token?: string }

  if (!isValidToken(token)) {
    res.status(400).json({
      error: { code: 'INVALID_TOKEN', message: 'Token must be SOL, USDC, or USDT' },
    })
    return
  }

  let depositor: PublicKey
  try {
    depositor = new PublicKey(wallet)
  } catch {
    res.status(400).json({
      error: { code: 'INVALID_WALLET', message: 'Wallet is not a valid base58 pubkey' },
    })
    return
  }

  const tokenMint = resolveTokenMint(token.toUpperCase())
  const connection = createConnection(network)

  try {
    const balance = await getVaultBalance(connection, depositor, tokenMint, SIPHER_VAULT_PROGRAM_ID)

    if (!balance.exists || balance.balance === 0n) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'No deposit record with available balance for this token',
        },
      })
      return
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    const refundableAt = balance.lastDepositAt + DEFAULT_REFUND_TIMEOUT
    if (nowSeconds < refundableAt) {
      res.status(409).json({
        error: {
          code: 'COOLDOWN_ACTIVE',
          message: 'Refund cooldown still active — wait for the 24h window to elapse',
          secondsRemaining: refundableAt - nowSeconds,
          refundableAt,
        },
      })
      return
    }

    const depositorTokenAccount = await getAssociatedTokenAddress(tokenMint, depositor)
    const result = await buildRefundTx(
      connection,
      depositor,
      tokenMint,
      depositorTokenAccount,
      SIPHER_VAULT_PROGRAM_ID,
    )

    const serializedTx = result.transaction
      .serialize({ requireAllSignatures: false })
      .toString('base64')

    res.json({
      serializedTx,
      refundAmount: result.refundAmount.toString(),
      network,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    res.status(500).json({
      error: { code: 'INTERNAL', message },
    })
  }
})
