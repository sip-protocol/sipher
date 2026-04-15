import type { AnthropicTool } from '../../pi/tool-adapter.js'
import { Connection, PublicKey } from '@solana/web3.js'

export interface GetVaultBalanceParams { wallet: string }
export interface GetVaultBalanceResult {
  sol: number
  tokens: { mint: string; amount: number }[]
}

export const getVaultBalanceTool: AnthropicTool = {
  name: 'getVaultBalance',
  description: 'Read SOL and SPL token balances held by the vault for a given wallet.',
  input_schema: {
    type: 'object' as const,
    properties: { wallet: { type: 'string' } },
    required: ['wallet'],
  },
}

export async function executeGetVaultBalance(
  params: GetVaultBalanceParams,
): Promise<GetVaultBalanceResult> {
  const rpc = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com'
  const conn = new Connection(rpc, 'confirmed')
  const pubkey = new PublicKey(params.wallet)
  const lamports = await conn.getBalance(pubkey)
  const tokenAccounts = await conn.getParsedTokenAccountsByOwner(pubkey, {
    programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  })
  const tokens = tokenAccounts.value.map((a) => ({
    mint: (a.account.data as { parsed: { info: { mint: string; tokenAmount: { uiAmount: number } } } })
      .parsed.info.mint,
    amount: (a.account.data as { parsed: { info: { mint: string; tokenAmount: { uiAmount: number } } } })
      .parsed.info.tokenAmount.uiAmount,
  }))
  return { sol: lamports / 1e9, tokens }
}
