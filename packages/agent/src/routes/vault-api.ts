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

// Known decimals for common mints (avoids extra RPC call)
const KNOWN_DECIMALS: Record<string, number> = {
  [WSOL_MINT.toBase58()]: 9,
  [USDC_MINT.toBase58()]: 6,
  [USDT_MINT.toBase58()]: 6,
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
  let balanceStatus: 'ok' | 'unavailable' = 'ok'
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

    // Collect unknown mints to batch-fetch decimals
    const unknownMints: PublicKey[] = []
    const tokenEntries: { mint: PublicKey; mintStr: string; rawAmount: bigint }[] = []

    for (const { account } of tokenAccounts.value) {
      const data = account.data
      const mint = new PublicKey(data.subarray(0, 32))
      const mintStr = mint.toBase58()
      const rawAmount = data.readBigUInt64LE(64)

      if (rawAmount === 0n || mint.equals(WSOL_MINT)) continue

      tokenEntries.push({ mint, mintStr, rawAmount })
      if (!(mintStr in KNOWN_DECIMALS)) {
        unknownMints.push(mint)
      }
    }

    // Batch-fetch decimals for unknown mints (SPL mint layout: decimals at offset 44)
    const fetchedDecimals: Record<string, number> = {}
    if (unknownMints.length > 0) {
      try {
        const mintAccounts = await connection.getMultipleAccountsInfo(unknownMints)
        for (let i = 0; i < unknownMints.length; i++) {
          const info = mintAccounts[i]
          if (info?.data && info.data.length >= 45) {
            fetchedDecimals[unknownMints[i].toBase58()] = info.data[44]
          }
        }
      } catch {
        // Non-fatal — fall back to 9 for unknown mints
      }
    }

    for (const { mintStr, rawAmount } of tokenEntries) {
      const symbol = MINT_LABELS[mintStr] ?? mintStr.slice(0, 8) + '...'
      const decimals = KNOWN_DECIMALS[mintStr] ?? fetchedDecimals[mintStr] ?? 9
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
    balanceStatus = 'unavailable'
    console.warn('[vault] balance fetch failed:', err instanceof Error ? err.message : err)
  }

  const activity = getActivity(wallet, { limit: 20 })

  res.json({
    wallet,
    network,
    balances: {
      sol: solBalance,
      tokens,
      status: balanceStatus,
    },
    activity,
  })
})
