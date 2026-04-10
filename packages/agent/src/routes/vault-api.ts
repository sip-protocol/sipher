import { Router, type Request, type Response } from 'express'
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { createConnection, WSOL_MINT, USDC_MINT, USDT_MINT } from '@sipher/sdk'
import { getActivity } from '../db.js'

export const vaultRouter = Router()

// Reverse lookup: mint address → human-readable symbol
const MINT_LABELS: Record<string, string> = {
  [WSOL_MINT.toBase58()]: 'SOL',
  [USDC_MINT.toBase58()]: 'USDC',
  [USDT_MINT.toBase58()]: 'USDT',
}

interface TokenBalance {
  mint: string
  symbol: string
  amount: string
  decimals: number
  uiAmount: number
}

/**
 * GET /api/vault
 * Returns the authenticated wallet's on-chain balances and recent activity.
 * Requires verifyJwt middleware upstream — wallet is attached to req by it.
 */
vaultRouter.get('/', async (req: Request, res: Response) => {
  const wallet = (req as unknown as Record<string, unknown>).wallet as string
  const network = (process.env.SOLANA_NETWORK ?? 'mainnet-beta') as 'devnet' | 'mainnet-beta'
  const connection = createConnection(network)

  let solBalance = 0
  const tokens: TokenBalance[] = []

  try {
    const pubkey = new PublicKey(wallet)

    // Fetch native SOL balance
    const lamports = await connection.getBalance(pubkey)
    solBalance = lamports / LAMPORTS_PER_SOL

    // Fetch SPL token accounts
    const tokenAccounts = await connection.getTokenAccountsByOwner(pubkey, {
      programId: TOKEN_PROGRAM_ID,
    })

    for (const { account } of tokenAccounts.value) {
      // SPL token account data layout: mint(32) + owner(32) + amount(8) + ...
      const data = account.data
      const mint = new PublicKey(data.subarray(0, 32))
      const mintStr = mint.toBase58()
      const rawAmount = data.readBigUInt64LE(64)

      // Skip zero-balance accounts and wrapped SOL (shown as native SOL above)
      if (rawAmount === 0n || mint.equals(WSOL_MINT)) continue

      const symbol = MINT_LABELS[mintStr] ?? mintStr.slice(0, 8) + '...'
      const decimals = mint.equals(USDC_MINT) || mint.equals(USDT_MINT) ? 6 : 9
      const uiAmount = Number(rawAmount) / 10 ** decimals

      tokens.push({
        mint: mintStr,
        symbol,
        amount: rawAmount.toString(),
        decimals,
        uiAmount,
      })
    }
  } catch (err) {
    // RPC failures should not block the entire response — return what we have
    console.warn('[vault] balance fetch failed:', err instanceof Error ? err.message : err)
  }

  const activity = getActivity(wallet, { limit: 20 })

  res.json({
    wallet,
    network,
    balances: {
      sol: solBalance,
      tokens,
    },
    activity,
  })
})
