import { Router, type Request, type Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import {
  WSOL_MINT,
  USDC_MINT,
  USDT_MINT,
  getVaultBalance,
  deriveDepositRecordPDA,
  createConnection,
  SIPHER_VAULT_PROGRAM_ID,
  DEFAULT_REFUND_TIMEOUT,
} from '@sipher/sdk'
import { loadNetworkConfig } from '../config/network.js'

const KNOWN_MINTS: { mint: PublicKey; symbol: string; decimals: number }[] = [
  { mint: WSOL_MINT, symbol: 'SOL', decimals: 9 },
  { mint: USDC_MINT, symbol: 'USDC', decimals: 6 },
  { mint: USDT_MINT, symbol: 'USDT', decimals: 6 },
]

interface Position {
  mint: string
  symbol: string
  balance: string
  balanceUiAmount: number
  decimals: number
  lastDepositAt: number
  refundableAt: number
  cooldownActive: boolean
  depositRecordAddress: string
}

export const vaultPositionsRouter = Router()

vaultPositionsRouter.get('/positions', async (req: Request, res: Response) => {
  const wallet = req.wallet
  if (!wallet) {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Authenticated wallet required' },
    })
    return
  }

  const network = loadNetworkConfig().clusterName
  if (network !== 'devnet') {
    res.json({
      positions: [],
      network,
      available: false,
      reason: 'mainnet-beta_no_vault',
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

  const connection = createConnection(network)
  const positions: Position[] = []
  const nowSeconds = Math.floor(Date.now() / 1000)

  try {
    for (const { mint, symbol, decimals } of KNOWN_MINTS) {
      const balance = await getVaultBalance(connection, depositor, mint, SIPHER_VAULT_PROGRAM_ID)

      if (!balance.exists || balance.balance === 0n) continue

      const [pda] = deriveDepositRecordPDA(depositor, mint, SIPHER_VAULT_PROGRAM_ID)
      const refundableAt = balance.lastDepositAt + DEFAULT_REFUND_TIMEOUT

      positions.push({
        mint: mint.toBase58(),
        symbol,
        balance: balance.balance.toString(),
        balanceUiAmount: Number(balance.balance) / 10 ** decimals,
        decimals,
        lastDepositAt: balance.lastDepositAt,
        refundableAt,
        cooldownActive: nowSeconds < refundableAt,
        depositRecordAddress: pda.toBase58(),
      })
    }
  } catch (err) {
    console.warn('[vault-positions] fetch failed:', err instanceof Error ? err.message : err)
    res.json({
      positions: [],
      network,
      available: false,
      reason: 'rpc_unavailable',
    })
    return
  }

  res.json({
    positions,
    network,
    available: true,
  })
})
