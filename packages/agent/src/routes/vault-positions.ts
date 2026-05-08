import { Router, type Request, type Response } from 'express'
import { PublicKey } from '@solana/web3.js'
import {
  WSOL_MINT,
  USDC_MINT,
  USDT_MINT,
  fetchDepositRecord,
  deriveDepositRecordPDA,
  createConnection,
  SIPHER_VAULT_PROGRAM_ID,
} from '@sipher/sdk'
import { loadNetworkConfig } from '../config/network.js'

const REFUND_TIMEOUT_SECONDS = 86400 // matches sipher_vault devnet config

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
  lockedAmount: string
  decimals: number
  lastDepositAt: number
  refundableAt: number
  cooldownActive: boolean
  depositRecordAddress: string
}

/** SDK throws this exact message prefix when a DepositRecord PDA has no on-chain account. */
const NOT_FOUND_PREFIX = 'DepositRecord not found'

function isAccountNotFound(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return err.message.startsWith(NOT_FOUND_PREFIX)
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
      const [pda] = deriveDepositRecordPDA(depositor, mint, SIPHER_VAULT_PROGRAM_ID)

      let record
      try {
        record = await fetchDepositRecord(connection, pda)
      } catch (err) {
        if (isAccountNotFound(err)) continue // no deposit for this mint — normal
        throw err // real RPC error — bubble to outer catch
      }

      if (!record || record.balance === 0n) continue

      const lastDepositAt = Number(record.lastDepositAt)
      const refundableAt = lastDepositAt + REFUND_TIMEOUT_SECONDS

      positions.push({
        mint: mint.toBase58(),
        symbol,
        balance: record.balance.toString(),
        balanceUiAmount: Number(record.balance) / 10 ** decimals,
        lockedAmount: record.lockedAmount.toString(),
        decimals,
        lastDepositAt,
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
